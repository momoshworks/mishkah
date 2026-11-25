import express from 'express';
import { matchesArabicQuery } from '../arabic.js';
import { requireAuth, recalculateUserPoints } from '../auth.js';

function safeParseArray(str) {
  try {
    const parsed = JSON.parse(str || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => (typeof t === 'string' ? t.trim().slice(0, 30) : ''))
    .filter(Boolean)
    .slice(0, 6);
}

function getLinkedItem(db, linkedType, linkedId) {
  if (!linkedType || !linkedId) return null;
  if (linkedType === 'hadith') {
    const h = db.prepare('SELECT id, title, text_diacritics, source, grade FROM hadiths WHERE id = ? AND is_published = 1').get(linkedId);
    return h ? { type: 'hadith', ...h } : null;
  }
  if (linkedType === 'story') {
    const s = db.prepare('SELECT id, slug, title, summary FROM stories WHERE id = ? AND is_published = 1').get(linkedId);
    return s ? { type: 'story', ...s } : null;
  }
  if (linkedType === 'sermon') {
    const m = db.prepare('SELECT id, title, excerpt FROM sermons WHERE id = ? AND is_published = 1').get(linkedId);
    return m ? { type: 'sermon', ...m } : null;
  }
  return null;
}

export function createForumRouter(db, { writeLimiter } = {}) {
  const router = express.Router();
  const limit = writeLimiter || ((_req, _res, next) => next());

  router.get('/forum/categories', (_req, res) => {
    const items = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM forum_topics t WHERE t.category_id = c.id AND t.is_hidden = 0) AS topics_count
         FROM forum_categories c
         ORDER BY c.sort_order ASC, c.id ASC`
      )
      .all();
    res.json({ items });
  });

  router.get('/forum/topics', (req, res) => {
    const {
      category = '',
      sort = 'recent',
      q = '',
      tag = '',
      linked_type = '',
      linked_id = '',
      author_id = '',
    } = req.query;

    const rows = db
      .prepare(
        `SELECT t.*, c.name AS category_name, c.slug AS category_slug,
                u.username AS author_username, u.display_name AS author_name,
                u.badge AS author_badge, u.avatar_color AS author_color, u.role AS author_role,
                (SELECT COUNT(*) FROM forum_replies r WHERE r.topic_id = t.id AND r.is_hidden = 0) AS replies_count
         FROM forum_topics t
         JOIN forum_categories c ON c.id = t.category_id
         JOIN users u ON u.id = t.author_id
         WHERE t.is_hidden = 0`
      )
      .all();

    let items = rows.map((r) => ({
      ...r,
      tags: safeParseArray(r.tags_json),
      is_pinned: Boolean(r.is_pinned),
      is_locked: Boolean(r.is_locked),
    }));

    items = items.filter((t) => {
      if (category && t.category_slug !== category && String(t.category_id) !== String(category)) return false;
      if (author_id && String(t.author_id) !== String(author_id)) return false;
      if (linked_type && t.linked_type !== linked_type) return false;
      if (linked_id && String(t.linked_id) !== String(linked_id)) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (sort === 'unanswered' && t.replies_count > 0) return false;
      if (sort === 'pinned' && !t.is_pinned) return false;
      if (q && !matchesArabicQuery(`${t.title} ${t.body} ${t.tags.join(' ')}`, String(q))) return false;
      return true;
    });

    items.sort((a, b) => {
      if (sort === 'active') {
        if (b.is_pinned !== a.is_pinned) return Number(b.is_pinned) - Number(a.is_pinned);
        return (b.replies_count + b.thanks_count) - (a.replies_count + a.thanks_count) || b.id - a.id;
      }
      if (Number(b.is_pinned) !== Number(a.is_pinned)) {
        return Number(b.is_pinned) - Number(a.is_pinned);
      }
      return b.updated_at.localeCompare(a.updated_at) || b.id - a.id;
    });

    res.json({ items });
  });

  router.post('/forum/topics', requireAuth, limit, (req, res) => {
    const { category_id, title, body, tags = [], linked_type = null, linked_id = null } = req.body || {};
    const catId = Number(category_id);
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanBody = typeof body === 'string' ? body.trim() : '';

    if (!Number.isInteger(catId) || !db.prepare('SELECT id FROM forum_categories WHERE id = ?').get(catId)) {
      return res.status(400).json({ error: 'يرجى اختيار قسم صحيح للموضوع' });
    }
    if (cleanTitle.length < 4 || cleanTitle.length > 160) {
      return res.status(400).json({ error: 'عنوان الموضوع يجب أن يكون بين 4 و160 حرفاً' });
    }
    if (cleanBody.length < 8 || cleanBody.length > 10000) {
      return res.status(400).json({ error: 'محتوى الموضوع يجب ألا يقل عن 8 أحرف' });
    }

    let validLinkedType = null;
    let validLinkedId = null;
    if (linked_type && linked_id) {
      if (!['hadith', 'story', 'sermon'].includes(linked_type)) {
        return res.status(400).json({ error: 'نوع المحتوى المرتبط غير صالح' });
      }
      const linked = getLinkedItem(db, linked_type, Number(linked_id));
      if (!linked) {
        return res.status(400).json({ error: 'المحتوى المرتبط غير موجود' });
      }
      validLinkedType = linked_type;
      validLinkedId = Number(linked_id);
    }

    const cleanTags = sanitizeTags(tags);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO forum_topics (category_id, author_id, title, body, tags_json, linked_type, linked_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(catId, req.user.id, cleanTitle, cleanBody, JSON.stringify(cleanTags), validLinkedType, validLinkedId);

    recalculateUserPoints(db, req.user.id);
    const item = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(Number(lastInsertRowid));
    res.status(201).json({ item: { ...item, tags: cleanTags } });
  });

  router.get('/forum/topics/:id', (req, res) => {
    const topicId = Number(req.params.id);
    if (!Number.isInteger(topicId)) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }

    const topic = db
      .prepare(
        `SELECT t.*, c.name AS category_name, c.slug AS category_slug,
                u.username AS author_username, u.display_name AS author_name,
                u.badge AS author_badge, u.avatar_color AS author_color,
                u.role AS author_role, u.points AS author_points
         FROM forum_topics t
         JOIN forum_categories c ON c.id = t.category_id
         JOIN users u ON u.id = t.author_id
         WHERE t.id = ?`
      )
      .get(topicId);

    const isStaff = req.user && ['moderator', 'admin'].includes(req.user.role);
    if (!topic || (topic.is_hidden && !isStaff)) {
      return res.status(404).json({ error: 'الموضوع غير موجود أو تم إخفاؤه' });
    }

    db.prepare('UPDATE forum_topics SET views_count = views_count + 1 WHERE id = ?').run(topicId);

    const repliesRows = db
      .prepare(
        `SELECT r.*, u.username AS author_username, u.display_name AS author_name,
                u.badge AS author_badge, u.avatar_color AS author_color,
                u.role AS author_role, u.points AS author_points
         FROM forum_replies r
         JOIN users u ON u.id = r.author_id
         WHERE r.topic_id = ? AND r.is_hidden = 0
         ORDER BY r.created_at ASC, r.id ASC`
      )
      .all(topicId);

    const userVotes = req.user
      ? db.prepare('SELECT target_type, target_id FROM thanks_votes WHERE user_id = ?').all(req.user.id)
      : [];
    const voteSet = new Set(userVotes.map((v) => `${v.target_type}:${v.target_id}`));
    const bookmarked = req.user
      ? Boolean(
          db
            .prepare("SELECT id FROM bookmarks WHERE user_id = ? AND item_type = 'topic' AND item_id = ?")
            .get(req.user.id, topicId)
        )
      : false;

    const replies = repliesRows.map((r) => ({
      ...r,
      userThanked: voteSet.has(`reply:${r.id}`),
      isBestAnswer: topic.best_reply_id === r.id,
    }));

    res.json({
      item: {
        ...topic,
        views_count: topic.views_count + 1,
        tags: safeParseArray(topic.tags_json),
        is_pinned: Boolean(topic.is_pinned),
        is_locked: Boolean(topic.is_locked),
        userThanked: voteSet.has(`topic:${topic.id}`),
        bookmarked,
        linkedItem: getLinkedItem(db, topic.linked_type, topic.linked_id),
      },
      replies,
    });
  });

  router.patch('/forum/topics/:id', requireAuth, limit, (req, res) => {
    const topicId = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_hidden = 0').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }
    if (topic.author_id !== req.user.id) {
      return res.status(403).json({ error: 'لا يمكنك تعديل موضوع لا يخصك' });
    }
    if (topic.is_locked) {
      return res.status(403).json({ error: 'الموضوع مغلق من قبل الإشراف' });
    }

    const cleanTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : topic.title;
    const cleanBody = typeof req.body?.body === 'string' ? req.body.body.trim() : topic.body;
    const cleanTags = req.body?.tags !== undefined ? sanitizeTags(req.body.tags) : safeParseArray(topic.tags_json);

    if (cleanTitle.length < 4 || cleanTitle.length > 160 || cleanBody.length < 8) {
      return res.status(400).json({ error: 'يرجى التأكد من طول العنوان والمحتوى' });
    }

    db.prepare(
      "UPDATE forum_topics SET title = ?, body = ?, tags_json = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(cleanTitle, cleanBody, JSON.stringify(cleanTags), topicId);

    const updated = db.prepare('SELECT * FROM forum_topics WHERE id = ?').get(topicId);
    res.json({ item: { ...updated, tags: cleanTags } });
  });

  router.delete('/forum/topics/:id', requireAuth, limit, (req, res) => {
    const topicId = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_hidden = 0').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }
    const isStaff = ['moderator', 'admin'].includes(req.user.role);
    if (topic.author_id !== req.user.id && !isStaff) {
      return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا الموضوع' });
    }

    const replyAuthors = db
      .prepare('SELECT DISTINCT author_id FROM forum_replies WHERE topic_id = ?')
      .all(topicId)
      .map((r) => r.author_id);

    db.prepare("UPDATE forum_topics SET is_hidden = 1, best_reply_id = NULL, updated_at = datetime('now') WHERE id = ?").run(
      topicId
    );
    const affectedUsers = new Set([topic.author_id, ...replyAuthors]);
    for (const uid of affectedUsers) {
      recalculateUserPoints(db, uid);
    }

    res.json({ ok: true });
  });

  router.post('/forum/topics/:id/replies', requireAuth, limit, (req, res) => {
    const topicId = Number(req.params.id);
    const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_hidden = 0').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }
    if (topic.is_locked) {
      return res.status(403).json({ error: 'تم إغلاق هذا الموضوع عن الردود الجديدة' });
    }

    const cleanBody = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (cleanBody.length < 2 || cleanBody.length > 5000) {
      return res.status(400).json({ error: 'يرجى كتابة رد لا يقل عن حرفين' });
    }

    let parentReplyId = null;
    let parentAuthorId = null;
    if (req.body?.parent_reply_id) {
      const pid = Number(req.body.parent_reply_id);
      const parent = db
        .prepare('SELECT id, author_id FROM forum_replies WHERE id = ? AND topic_id = ? AND is_hidden = 0')
        .get(pid, topicId);
      if (!parent) {
        return res.status(400).json({ error: 'الرد المقتبس غير موجود في هذا الموضوع' });
      }
      parentReplyId = parent.id;
      parentAuthorId = parent.author_id;
    }

    const { lastInsertRowid } = db
      .prepare('INSERT INTO forum_replies (topic_id, author_id, parent_reply_id, body) VALUES (?, ?, ?, ?)')
      .run(topicId, req.user.id, parentReplyId, cleanBody);
    const replyId = Number(lastInsertRowid);

    db.prepare("UPDATE forum_topics SET updated_at = datetime('now') WHERE id = ?").run(topicId);
    recalculateUserPoints(db, req.user.id);

    if (topic.author_id !== req.user.id) {
      db.prepare('INSERT INTO notifications (user_id, type, title, link) VALUES (?, ?, ?, ?)').run(
        topic.author_id,
        'reply',
        `ردّ ${req.user.display_name} على موضوعك: ${topic.title}`,
        `/forum/topic/${topicId}`
      );
    }
    if (parentAuthorId && parentAuthorId !== req.user.id && parentAuthorId !== topic.author_id) {
      db.prepare('INSERT INTO notifications (user_id, type, title, link) VALUES (?, ?, ?, ?)').run(
        parentAuthorId,
        'reply',
        `ردّ ${req.user.display_name} على مشاركتك في: ${topic.title}`,
        `/forum/topic/${topicId}`
      );
    }

    const item = db
      .prepare(
        `SELECT r.*, u.username AS author_username, u.display_name AS author_name,
                u.badge AS author_badge, u.avatar_color AS author_color,
                u.role AS author_role, u.points AS author_points
         FROM forum_replies r JOIN users u ON u.id = r.author_id WHERE r.id = ?`
      )
      .get(replyId);

    res.status(201).json({ item });
  });

  router.patch('/forum/replies/:id', requireAuth, limit, (req, res) => {
    const replyId = Number(req.params.id);
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ? AND is_hidden = 0').get(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'الرد غير موجود' });
    }
    if (reply.author_id !== req.user.id) {
      return res.status(403).json({ error: 'لا يمكنك تعديل مشاركة عضو آخر' });
    }
    const cleanBody = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (cleanBody.length < 2 || cleanBody.length > 5000) {
      return res.status(400).json({ error: 'يرجى كتابة نص صالح للرد' });
    }

    db.prepare("UPDATE forum_replies SET body = ?, updated_at = datetime('now') WHERE id = ?").run(
      cleanBody,
      replyId
    );
    const updated = db.prepare('SELECT * FROM forum_replies WHERE id = ?').get(replyId);
    res.json({ item: updated });
  });

  router.delete('/forum/replies/:id', requireAuth, limit, (req, res) => {
    const replyId = Number(req.params.id);
    const reply = db.prepare('SELECT * FROM forum_replies WHERE id = ? AND is_hidden = 0').get(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'الرد غير موجود' });
    }
    const isStaff = ['moderator', 'admin'].includes(req.user.role);
    if (reply.author_id !== req.user.id && !isStaff) {
      return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا الرد' });
    }

    db.prepare("UPDATE forum_replies SET is_hidden = 1, updated_at = datetime('now') WHERE id = ?").run(replyId);
    db.prepare('UPDATE forum_topics SET best_reply_id = NULL WHERE id = ? AND best_reply_id = ?').run(
      reply.topic_id,
      replyId
    );
    recalculateUserPoints(db, reply.author_id);

    res.json({ ok: true });
  });

  router.post('/forum/thanks', requireAuth, limit, (req, res) => {
    const { target_type, target_id } = req.body || {};
    const tid = Number(target_id);
    if (!['topic', 'reply'].includes(target_type) || !Number.isInteger(tid) || tid <= 0) {
      return res.status(400).json({ error: 'بيانات التقدير غير صالحة' });
    }

    const table = target_type === 'topic' ? 'forum_topics' : 'forum_replies';
    const target = db.prepare(`SELECT id, author_id, is_hidden FROM ${table} WHERE id = ?`).get(tid);
    if (!target || target.is_hidden) {
      return res.status(404).json({ error: 'المحتوى غير موجود' });
    }

    const existing = db
      .prepare('SELECT id FROM thanks_votes WHERE user_id = ? AND target_type = ? AND target_id = ?')
      .get(req.user.id, target_type, tid);

    let thanked;
    if (existing) {
      db.prepare('DELETE FROM thanks_votes WHERE id = ?').run(existing.id);
      thanked = false;
    } else {
      db.prepare('INSERT INTO thanks_votes (user_id, target_type, target_id) VALUES (?, ?, ?)').run(
        req.user.id,
        target_type,
        tid
      );
      thanked = true;
      if (target.author_id !== req.user.id) {
        const link =
          target_type === 'topic'
            ? `/forum/topic/${tid}`
            : `/forum/topic/${db.prepare('SELECT topic_id FROM forum_replies WHERE id = ?').get(tid).topic_id}`;
        db.prepare('INSERT INTO notifications (user_id, type, title, link) VALUES (?, ?, ?, ?)').run(
          target.author_id,
          'thanks',
          `دعا لك ${req.user.display_name}: «جزاك الله خيراً»`,
          link
        );
      }
    }

    const count = db
      .prepare('SELECT COUNT(*) AS c FROM thanks_votes WHERE target_type = ? AND target_id = ?')
      .get(target_type, tid).c;
    db.prepare(`UPDATE ${table} SET thanks_count = ? WHERE id = ?`).run(count, tid);
    recalculateUserPoints(db, target.author_id);

    res.json({ thanked, thanks_count: count });
  });

  router.post('/forum/topics/:id/best-reply', requireAuth, limit, (req, res) => {
    const topicId = Number(req.params.id);
    const replyId = req.body?.reply_id === null ? null : Number(req.body?.reply_id);
    const topic = db.prepare('SELECT * FROM forum_topics WHERE id = ? AND is_hidden = 0').get(topicId);
    if (!topic) {
      return res.status(404).json({ error: 'الموضوع غير موجود' });
    }
    const isStaff = ['moderator', 'admin'].includes(req.user.role);
    if (topic.author_id !== req.user.id && !isStaff) {
      return res.status(403).json({ error: 'فقط صاحب الموضوع أو المشرف يمكنه تحديد أفضل إجابة' });
    }

    const prevBestReply = topic.best_reply_id
      ? db.prepare('SELECT author_id FROM forum_replies WHERE id = ?').get(topic.best_reply_id)
      : null;

    if (replyId === null) {
      db.prepare('UPDATE forum_topics SET best_reply_id = NULL WHERE id = ?').run(topicId);
      if (prevBestReply) recalculateUserPoints(db, prevBestReply.author_id);
      return res.json({ best_reply_id: null });
    }

    const reply = db
      .prepare('SELECT id, author_id FROM forum_replies WHERE id = ? AND topic_id = ? AND is_hidden = 0')
      .get(replyId, topicId);
    if (!reply) {
      return res.status(400).json({ error: 'الرد المحدد غير موجود في هذا الموضوع' });
    }

    const nextBest = topic.best_reply_id === replyId ? null : replyId;
    db.prepare('UPDATE forum_topics SET best_reply_id = ? WHERE id = ?').run(nextBest, topicId);

    if (prevBestReply) recalculateUserPoints(db, prevBestReply.author_id);
    recalculateUserPoints(db, reply.author_id);

    if (nextBest && reply.author_id !== req.user.id) {
      db.prepare('INSERT INTO notifications (user_id, type, title, link) VALUES (?, ?, ?, ?)').run(
        reply.author_id,
        'best_answer',
        `تم اختيار ردك كأفضل إجابة في: ${topic.title}`,
        `/forum/topic/${topicId}`
      );
    }

    res.json({ best_reply_id: nextBest });
  });

  router.post('/forum/reports', requireAuth, limit, (req, res) => {
    const { target_type, target_id, reason } = req.body || {};
    const tid = Number(target_id);
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';

    if (!['topic', 'reply'].includes(target_type) || !Number.isInteger(tid) || tid <= 0) {
      return res.status(400).json({ error: 'بيانات البلاغ غير صالحة' });
    }
    if (cleanReason.length < 4 || cleanReason.length > 500) {
      return res.status(400).json({ error: 'يرجى كتابة سبب البلاغ (4 أحرف على الأقل)' });
    }

    const table = target_type === 'topic' ? 'forum_topics' : 'forum_replies';
    if (!db.prepare(`SELECT id FROM ${table} WHERE id = ? AND is_hidden = 0`).get(tid)) {
      return res.status(404).json({ error: 'المحتوى المبلغ عنه غير موجود' });
    }

    const { lastInsertRowid } = db
      .prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)')
      .run(req.user.id, target_type, tid, cleanReason);

    res.status(201).json({ id: Number(lastInsertRowid), status: 'open' });
  });

  router.get('/notifications', requireAuth, (req, res) => {
    const items = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30')
      .all(req.user.id);
    const unreadCount = db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id).c;
    res.json({ items, unreadCount });
  });

  router.post('/notifications/read', requireAuth, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  });

  return router;
}
