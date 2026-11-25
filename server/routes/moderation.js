import express from 'express';
import { normalizeArabic } from '../arabic.js';
import { invalidateUserSessions, recalculateUserPoints, requireRole } from '../auth.js';
import { formatHadith, formatSermon, formatStory } from './library.js';

function isStringArray(val) {
  return Array.isArray(val) && val.every((x) => typeof x === 'string' && x.trim().length > 0);
}

function makeSlug(input) {
  const ascii = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return ascii || `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createModerationRouter(db) {
  const router = express.Router();

  // ========== Moderator + Admin Routes ==========
  const modGuard = requireRole('moderator', 'admin');

  router.get('/moderation/reports', modGuard, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT rp.*, u.display_name AS reporter_name, u.username AS reporter_username
         FROM reports rp
         JOIN users u ON u.id = rp.reporter_id
         ORDER BY CASE WHEN rp.status = 'open' THEN 0 ELSE 1 END, rp.created_at DESC, rp.id DESC`
      )
      .all();

    const items = rows.map((r) => {
      let targetPreview = '';
      let topicId = null;
      let targetHidden = false;
      if (r.target_type === 'topic') {
        const t = db.prepare('SELECT id, title, is_hidden FROM forum_topics WHERE id = ?').get(r.target_id);
        targetPreview = t ? t.title : 'موضوع محذوف';
        topicId = t ? t.id : null;
        targetHidden = t ? Boolean(t.is_hidden) : true;
      } else {
        const rep = db.prepare('SELECT id, topic_id, body, is_hidden FROM forum_replies WHERE id = ?').get(r.target_id);
        targetPreview = rep ? rep.body.slice(0, 120) : 'رد محذوف';
        topicId = rep ? rep.topic_id : null;
        targetHidden = rep ? Boolean(rep.is_hidden) : true;
      }
      return { ...r, targetPreview, topicId, targetHidden };
    });

    res.json({ items });
  });

  router.patch('/moderation/reports/:id', modGuard, (req, res) => {
    const reportId = Number(req.params.id);
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ error: 'البلاغ غير موجود' });
    }

    const { status = 'resolved', hideTarget = false } = req.body || {};
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'حالة البلاغ غير صالحة' });
    }

    db.prepare('UPDATE reports SET status = ?, resolved_by = ? WHERE id = ?').run(
      status,
      req.user.id,
      reportId
    );

    if (hideTarget) {
      if (report.target_type === 'topic') {
        const topic = db.prepare('SELECT author_id FROM forum_topics WHERE id = ?').get(report.target_id);
        const replyAuthors = db
          .prepare('SELECT DISTINCT author_id FROM forum_replies WHERE topic_id = ?')
          .all(report.target_id)
          .map((x) => x.author_id);
        db.prepare('UPDATE forum_topics SET is_hidden = 1, best_reply_id = NULL WHERE id = ?').run(report.target_id);
        if (topic) recalculateUserPoints(db, topic.author_id);
        for (const uid of replyAuthors) recalculateUserPoints(db, uid);
      } else {
        const reply = db.prepare('SELECT topic_id, author_id FROM forum_replies WHERE id = ?').get(report.target_id);
        if (reply) {
          db.prepare('UPDATE forum_replies SET is_hidden = 1 WHERE id = ?').run(report.target_id);
          db.prepare('UPDATE forum_topics SET best_reply_id = NULL WHERE id = ? AND best_reply_id = ?').run(
            reply.topic_id,
            report.target_id
          );
          recalculateUserPoints(db, reply.author_id);
        }
      }
    }

    const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    res.json({ item: updated });
  });

  router.patch('/moderation/topics/:id', modGuard, (req, res) => {
    const topicId = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }

    const isPinned = req.body?.is_pinned !== undefined ? (req.body.is_pinned ? 1 : 0) : topic.is_pinned;
    const isLocked = req.body?.is_locked !== undefined ? (req.body.is_locked ? 1 : 0) : topic.is_locked;
    const isHidden = req.body?.is_hidden !== undefined ? (req.body.is_hidden ? 1 : 0) : topic.is_hidden;

    db.prepare(
      `UPDATE forum_topics
       SET is_pinned = ?, is_locked = ?, is_hidden = ?,
           best_reply_id = CASE WHEN ? = 1 THEN NULL ELSE best_reply_id END,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(isPinned, isLocked, isHidden, isHidden, topicId);

    if (isHidden !== topic.is_hidden) {
      const replyAuthors = db
        .prepare('SELECT DISTINCT author_id FROM forum_replies WHERE topic_id = ?')
        .all(topicId)
        .map((x) => x.author_id);
      recalculateUserPoints(db, topic.author_id);
      for (const uid of replyAuthors) recalculateUserPoints(db, uid);
    }

    const updated = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(topicId);
    res.json({
      item: {
        ...updated,
        is_pinned: Boolean(updated.is_pinned),
        is_locked: Boolean(updated.is_locked),
        is_hidden: Boolean(updated.is_hidden),
      },
    });
  });

  router.patch('/moderation/replies/:id', modGuard, (req, res) => {
    const replyId = Number(req.params.id);
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'الرد غير موجود' });
    }

    const isHidden = req.body?.is_hidden !== undefined ? (req.body.is_hidden ? 1 : 0) : reply.is_hidden;
    db.prepare("UPDATE forum_replies SET is_hidden = ?, updated_at = datetime('now') WHERE id = ?").run(
      isHidden,
      replyId
    );
    if (isHidden) {
      db.prepare('UPDATE forum_topics SET best_reply_id = NULL WHERE id = ? AND best_reply_id = ?').run(
        reply.topic_id,
        replyId
      );
    }
    if (isHidden !== reply.is_hidden) {
      recalculateUserPoints(db, reply.author_id);
    }

    const updated = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(replyId);
    res.json({ item: { ...updated, is_hidden: Boolean(updated.is_hidden) } });
  });

  router.get('/moderation/users', modGuard, (_req, res) => {
    const items = db
      .prepare(
        `SELECT id, username, display_name, email, role, badge, points,
                is_banned, ban_reason, banned_at, created_at
         FROM users
         ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, points DESC, id ASC`
      )
      .all()
      .map((u) => ({ ...u, is_banned: Boolean(u.is_banned) }));
    res.json({ items });
  });

  router.patch('/moderation/users/:id/ban', modGuard, (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حظر حسابك الشخصي' });
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!target) {
      return res.status(404).json({ error: 'العضو غير موجود' });
    }
    if (target.role === 'admin' || (target.role === 'moderator' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'لا تملك صلاحية حظر هذا الحساب' });
    }

    const banFlag = Boolean(req.body?.is_banned);
    const reason = typeof req.body?.ban_reason === 'string' ? req.body.ban_reason.trim().slice(0, 300) : '';

    if (banFlag) {
      db.prepare(
        "UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = datetime('now') WHERE id = ?"
      ).run(reason || 'مخالفة ضوابط المنتدى', targetId);
      invalidateUserSessions(db, targetId);
    } else {
      db.prepare("UPDATE users SET is_banned = 0, ban_reason = '', banned_at = NULL WHERE id = ?").run(targetId);
    }

    const updated = db
      .prepare(
        'SELECT id, username, display_name, email, role, badge, points, is_banned, ban_reason, banned_at FROM users WHERE id = ?'
      )
      .get(targetId);
    res.json({ item: { ...updated, is_banned: Boolean(updated.is_banned) } });
  });

  // ========== Admin-Only CMS & Role Routes ==========
  const adminGuard = requireRole('admin');

  router.patch('/admin/users/:id/role', adminGuard, (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك تغيير رتبتك بنفسك' });
    }
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!target) {
      return res.status(404).json({ error: 'العضو غير موجود' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'لا يمكن تعديل رتبة مدير عام' });
    }
    const nextRole = req.body?.role;
    if (!['member', 'moderator'].includes(nextRole)) {
      return res.status(400).json({ error: 'الرتبة المحددة غير صالحة' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, targetId);
    recalculateUserPoints(db, targetId);

    const updated = db
      .prepare('SELECT id, username, display_name, email, role, badge, points, is_banned FROM users WHERE id = ?')
      .get(targetId);
    res.json({ item: { ...updated, is_banned: Boolean(updated.is_banned) } });
  });

  // Hadiths CMS
  router.get('/admin/hadiths', adminGuard, (_req, res) => {
    const rows = db.prepare('SELECT * FROM hadiths ORDER BY id DESC').all();
    res.json({ items: rows.map((r) => formatHadith(r)) });
  });

  router.post('/admin/hadiths', adminGuard, (req, res) => {
    const b = req.body || {};
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    const textDiacritics = typeof b.text_diacritics === 'string' ? b.text_diacritics.trim() : '';
    const narrator = typeof b.narrator === 'string' ? b.narrator.trim() : '';
    const source = typeof b.source === 'string' ? b.source.trim() : '';
    const grade = typeof b.grade === 'string' ? b.grade.trim() : '';
    const category = typeof b.category === 'string' ? b.category.trim() : '';
    const explanation = typeof b.explanation === 'string' ? b.explanation.trim() : '';
    const benefits = b.benefits !== undefined ? b.benefits : [];
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : [];

    if (!title || !textDiacritics || !narrator || !source || !grade || !category || !explanation) {
      return res.status(400).json({ error: 'جميع الحقول الأساسية للحديث مطلوبة (العنوان، النص، الراوي، المصدر، الدرجة، التصنيف، الشرح)' });
    }
    if (!Array.isArray(benefits) || !isStringArray(benefits) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'الفوائد والوسوم الشعورية يجب أن تكون مصفوفات نصوص صالحة' });
    }

    const isFeatured = b.is_featured ? 1 : 0;
    const isPublished = b.is_published === false ? 0 : 1;
    if (isFeatured) db.prepare('UPDATE hadiths SET is_featured = 0').run();

    const textPlain = normalizeArabic(`${title} ${textDiacritics} ${narrator} ${source} ${category} ${explanation}`);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO hadiths (
          title, text_diacritics, text_plain, narrator, source, grade, category,
          mood_tags, explanation, benefits_json, is_featured, is_published, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        textDiacritics,
        textPlain,
        narrator,
        source,
        grade,
        category,
        JSON.stringify(moodTags),
        explanation,
        JSON.stringify(benefits),
        isFeatured,
        isPublished,
        req.user.id
      );

    const row = db.prepare('SELECT * FROM hadiths WHERE id = ?').get(Number(lastInsertRowid));
    res.status(201).json({ item: formatHadith(row) });
  });

  router.patch('/admin/hadiths/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM hadiths WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'الحديث غير موجود' });

    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : existing.title;
    const textDiacritics = b.text_diacritics !== undefined ? String(b.text_diacritics).trim() : existing.text_diacritics;
    const narrator = b.narrator !== undefined ? String(b.narrator).trim() : existing.narrator;
    const source = b.source !== undefined ? String(b.source).trim() : existing.source;
    const grade = b.grade !== undefined ? String(b.grade).trim() : existing.grade;
    const category = b.category !== undefined ? String(b.category).trim() : existing.category;
    const explanation = b.explanation !== undefined ? String(b.explanation).trim() : existing.explanation;
    const benefits = b.benefits !== undefined ? b.benefits : JSON.parse(existing.benefits_json);
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : JSON.parse(existing.mood_tags);

    if (!title || !textDiacritics || !narrator || !source || !grade || !category || !explanation) {
      return res.status(400).json({ error: 'لا يمكن ترك حقول الحديث الأساسية فارغة' });
    }
    if (!Array.isArray(benefits) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'صيغة الفوائد أو الوسوم غير صالحة' });
    }

    const isFeatured = b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : existing.is_featured;
    const isPublished = b.is_published !== undefined ? (b.is_published ? 1 : 0) : existing.is_published;
    if (isFeatured && !existing.is_featured) db.prepare('UPDATE hadiths SET is_featured = 0').run();

    const textPlain = normalizeArabic(`${title} ${textDiacritics} ${narrator} ${source} ${category} ${explanation}`);
    db.prepare(
      `UPDATE hadiths
       SET title = ?, text_diacritics = ?, text_plain = ?, narrator = ?, source = ?, grade = ?,
           category = ?, mood_tags = ?, explanation = ?, benefits_json = ?,
           is_featured = ?, is_published = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title,
      textDiacritics,
      textPlain,
      narrator,
      source,
      grade,
      category,
      JSON.stringify(moodTags),
      explanation,
      JSON.stringify(benefits),
      isFeatured,
      isPublished,
      id
    );

    const row = db.prepare('SELECT * FROM hadiths WHERE id = ?').get(id);
    res.json({ item: formatHadith(row) });
  });

  router.delete('/admin/hadiths/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const resDel = db.prepare('DELETE FROM hadiths WHERE id = ?').run(id);
    if (resDel.changes === 0) return res.status(404).json({ error: 'الحديث غير موجود' });
    res.json({ ok: true });
  });

  // Stories CMS
  router.get('/admin/stories', adminGuard, (_req, res) => {
    const rows = db.prepare('SELECT * FROM stories ORDER BY id DESC').all();
    res.json({ items: rows.map((r) => formatStory(r)) });
  });

  router.post('/admin/stories', adminGuard, (req, res) => {
    const b = req.body || {};
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    const category = b.category;
    const summary = typeof b.summary === 'string' ? b.summary.trim() : '';
    const paragraphs = b.paragraphs;
    const lessons = b.lessons !== undefined ? b.lessons : [];
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : [];

    if (!title || !['prophets', 'companions', 'seerah', 'lessons'].includes(category) || !summary) {
      return res.status(400).json({ error: 'يرجى إدخال العنوان والتصنيف والملخص للقصة بشكل صحيح' });
    }
    if (!isStringArray(paragraphs) || !Array.isArray(lessons) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'فقرات القصة يجب أن تكون مصفوفة نصوص غير فارغة' });
    }

    let slug = makeSlug(b.slug || title);
    while (db.prepare('SELECT id FROM stories WHERE slug = ?').get(slug)) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    }

    const readingMinutes = Math.max(1, Number(b.reading_minutes) || 4);
    const accentColor = typeof b.accent_color === 'string' ? b.accent_color : '#10b981';
    const isPublished = b.is_published === false ? 0 : 1;

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO stories (
          slug, title, category, summary, paragraphs_json, lessons_json,
          reading_minutes, mood_tags, accent_color, is_published, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug,
        title,
        category,
        summary,
        JSON.stringify(paragraphs),
        JSON.stringify(lessons),
        readingMinutes,
        JSON.stringify(moodTags),
        accentColor,
        isPublished,
        req.user.id
      );

    const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(Number(lastInsertRowid));
    res.status(201).json({ item: formatStory(row) });
  });

  router.patch('/admin/stories/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM stories WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'القصة غير موجودة' });

    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : existing.title;
    const category = b.category !== undefined ? b.category : existing.category;
    const summary = b.summary !== undefined ? String(b.summary).trim() : existing.summary;
    const paragraphs = b.paragraphs !== undefined ? b.paragraphs : JSON.parse(existing.paragraphs_json);
    const lessons = b.lessons !== undefined ? b.lessons : JSON.parse(existing.lessons_json);
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : JSON.parse(existing.mood_tags);

    if (!title || !['prophets', 'companions', 'seerah', 'lessons'].includes(category) || !summary || !isStringArray(paragraphs)) {
      return res.status(400).json({ error: 'بيانات القصة غير صالحة' });
    }
    if (!Array.isArray(lessons) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'صيغة الدروس أو الوسوم غير صالحة' });
    }

    const readingMinutes = b.reading_minutes !== undefined ? Math.max(1, Number(b.reading_minutes) || 4) : existing.reading_minutes;
    const accentColor = b.accent_color !== undefined ? String(b.accent_color) : existing.accent_color;
    const isPublished = b.is_published !== undefined ? (b.is_published ? 1 : 0) : existing.is_published;

    db.prepare(
      `UPDATE stories
       SET title = ?, category = ?, summary = ?, paragraphs_json = ?, lessons_json = ?,
           reading_minutes = ?, mood_tags = ?, accent_color = ?, is_published = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title,
      category,
      summary,
      JSON.stringify(paragraphs),
      JSON.stringify(lessons),
      readingMinutes,
      JSON.stringify(moodTags),
      accentColor,
      isPublished,
      id
    );

    const row = db.prepare('SELECT * FROM stories WHERE id = ?').get(id);
    res.json({ item: formatStory(row) });
  });

  router.delete('/admin/stories/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const resDel = db.prepare('DELETE FROM stories WHERE id = ?').run(id);
    if (resDel.changes === 0) return res.status(404).json({ error: 'القصة غير موجودة' });
    res.json({ ok: true });
  });

  // Sermons CMS
  router.get('/admin/sermons', adminGuard, (_req, res) => {
    const rows = db.prepare('SELECT * FROM sermons ORDER BY id DESC').all();
    res.json({ items: rows.map((r) => formatSermon(r)) });
  });

  router.post('/admin/sermons', adminGuard, (req, res) => {
    const b = req.body || {};
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    const category = typeof b.category === 'string' ? b.category.trim() : '';
    const excerpt = typeof b.excerpt === 'string' ? b.excerpt.trim() : '';
    const bodyParagraphs = b.body_paragraphs;
    const reflectionQuestion = typeof b.reflection_question === 'string' ? b.reflection_question.trim() : '';
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : [];

    if (!title || !category || !excerpt || !isStringArray(bodyParagraphs) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'يرجى إدخال عنوان الموعظة وتصنيفها ومقتطفها وفقراتها بشكل صحيح' });
    }

    const readingMinutes = Math.max(1, Number(b.reading_minutes) || 3);
    const isPublished = b.is_published === false ? 0 : 1;

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO sermons (
          title, category, excerpt, body_paragraphs_json, reflection_question,
          mood_tags, reading_minutes, is_published, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        category,
        excerpt,
        JSON.stringify(bodyParagraphs),
        reflectionQuestion,
        JSON.stringify(moodTags),
        readingMinutes,
        isPublished,
        req.user.id
      );

    const row = db.prepare('SELECT * FROM sermons WHERE id = ?').get(Number(lastInsertRowid));
    res.status(201).json({ item: formatSermon(row) });
  });

  router.patch('/admin/sermons/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM sermons WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'الموعظة غير موجودة' });

    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title).trim() : existing.title;
    const category = b.category !== undefined ? String(b.category).trim() : existing.category;
    const excerpt = b.excerpt !== undefined ? String(b.excerpt).trim() : existing.excerpt;
    const bodyParagraphs = b.body_paragraphs !== undefined ? b.body_paragraphs : JSON.parse(existing.body_paragraphs_json);
    const reflectionQuestion = b.reflection_question !== undefined ? String(b.reflection_question).trim() : existing.reflection_question;
    const moodTags = b.mood_tags !== undefined ? b.mood_tags : JSON.parse(existing.mood_tags);

    if (!title || !category || !excerpt || !isStringArray(bodyParagraphs) || !Array.isArray(moodTags)) {
      return res.status(400).json({ error: 'بيانات الموعظة غير صالحة' });
    }

    const readingMinutes = b.reading_minutes !== undefined ? Math.max(1, Number(b.reading_minutes) || 3) : existing.reading_minutes;
    const isPublished = b.is_published !== undefined ? (b.is_published ? 1 : 0) : existing.is_published;

    db.prepare(
      `UPDATE sermons
       SET title = ?, category = ?, excerpt = ?, body_paragraphs_json = ?, reflection_question = ?,
           mood_tags = ?, reading_minutes = ?, is_published = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title,
      category,
      excerpt,
      JSON.stringify(bodyParagraphs),
      reflectionQuestion,
      JSON.stringify(moodTags),
      readingMinutes,
      isPublished,
      id
    );

    const row = db.prepare('SELECT * FROM sermons WHERE id = ?').get(id);
    res.json({ item: formatSermon(row) });
  });

  router.delete('/admin/sermons/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const resDel = db.prepare('DELETE FROM sermons WHERE id = ?').run(id);
    if (resDel.changes === 0) return res.status(404).json({ error: 'الموعظة غير موجودة' });
    res.json({ ok: true });
  });

  // Categories CMS
  router.post('/admin/categories', adminGuard, (req, res) => {
    const { slug, name, description, icon = 'MessageSquare', sort_order = 10 } = req.body || {};
    const cleanSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDesc = typeof description === 'string' ? description.trim() : '';

    if (!/^[a-z0-9-]{2,40}$/.test(cleanSlug) || cleanName.length < 2 || cleanDesc.length < 4) {
      return res.status(400).json({ error: 'بيانات قسم المنتدى غير صالحة' });
    }
    if (db.prepare('SELECT id FROM forum_categories WHERE slug = ?').get(cleanSlug)) {
      return res.status(409).json({ error: 'معرف القسم مستخدم بالفعل' });
    }

    const { lastInsertRowid } = db
      .prepare('INSERT INTO forum_categories (slug, name, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
      .run(cleanSlug, cleanName, cleanDesc, String(icon), Number(sort_order) || 10);

    const item = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(Number(lastInsertRowid));
    res.status(201).json({ item });
  });

  router.patch('/admin/categories/:id', adminGuard, (req, res) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'القسم غير موجود' });

    const name = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
    const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
    const icon = req.body?.icon !== undefined ? String(req.body.icon).trim() : existing.icon;
    const sortOrder = req.body?.sort_order !== undefined ? Number(req.body.sort_order) : existing.sort_order;

    if (name.length < 2 || description.length < 4) {
      return res.status(400).json({ error: 'يرجى إدخال اسم ووصف صحيحين للقسم' });
    }
    db.prepare('UPDATE forum_categories SET name = ?, description = ?, icon = ?, sort_order = ? WHERE id = ?').run(
      name,
      description,
      icon,
      sortOrder,
      id
    );
    res.json({ item: db.prepare('SELECT * FROM forum_categories WHERE id = ?').get(id) });
  });

  return router;
}
