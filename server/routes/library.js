import express from 'express';
import { matchesArabicQuery, normalizeArabic } from '../arabic.js';
import { requireAuth } from '../auth.js';

function safeParseArray(str) {
  try {
    const parsed = JSON.parse(str || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getUserBookmarkSet(db, userId) {
  if (!userId) return new Set();
  const rows = db.prepare('SELECT item_type, item_id FROM bookmarks WHERE user_id = ?').all(userId);
  return new Set(rows.map((r) => `${r.item_type}:${r.item_id}`));
}

export function formatHadith(row, bookmarkSet) {
  return {
    id: row.id,
    title: row.title,
    text_diacritics: row.text_diacritics,
    narrator: row.narrator,
    source: row.source,
    grade: row.grade,
    category: row.category,
    mood_tags: safeParseArray(row.mood_tags),
    explanation: row.explanation,
    benefits: safeParseArray(row.benefits_json),
    is_featured: Boolean(row.is_featured),
    is_published: Boolean(row.is_published),
    bookmarked: bookmarkSet ? bookmarkSet.has(`hadith:${row.id}`) : false,
    created_at: row.created_at,
  };
}

export function formatStory(row, bookmarkSet) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: row.summary,
    paragraphs: safeParseArray(row.paragraphs_json),
    lessons: safeParseArray(row.lessons_json),
    reading_minutes: row.reading_minutes,
    mood_tags: safeParseArray(row.mood_tags),
    accent_color: row.accent_color,
    is_published: Boolean(row.is_published),
    bookmarked: bookmarkSet ? bookmarkSet.has(`story:${row.id}`) : false,
    created_at: row.created_at,
  };
}

export function formatSermon(row, bookmarkSet) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    excerpt: row.excerpt,
    body_paragraphs: safeParseArray(row.body_paragraphs_json),
    reflection_question: row.reflection_question,
    mood_tags: safeParseArray(row.mood_tags),
    reading_minutes: row.reading_minutes,
    is_published: Boolean(row.is_published),
    bookmarked: bookmarkSet ? bookmarkSet.has(`sermon:${row.id}`) : false,
    created_at: row.created_at,
  };
}

export function createLibraryRouter(db, { writeLimiter } = {}) {
  const router = express.Router();
  const limit = writeLimiter || ((_req, _res, next) => next());

  router.get('/home', (req, res) => {
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);
    const featuredRow =
      db.prepare('SELECT * FROM hadiths WHERE is_published = 1 AND is_featured = 1 ORDER BY id DESC LIMIT 1').get() ||
      db.prepare('SELECT * FROM hadiths WHERE is_published = 1 ORDER BY id ASC LIMIT 1').get();

    const storyRows = db.prepare('SELECT * FROM stories WHERE is_published = 1 ORDER BY id DESC LIMIT 4').all();
    const sermonRows = db.prepare('SELECT * FROM sermons WHERE is_published = 1 ORDER BY id DESC LIMIT 4').all();

    const activeTopics = db
      .prepare(
        `SELECT t.id, t.title, t.is_pinned, t.thanks_count, t.views_count, t.best_reply_id,
                t.created_at, t.updated_at, c.name AS category_name, c.slug AS category_slug,
                u.display_name AS author_name, u.badge AS author_badge, u.avatar_color AS author_color,
                (SELECT COUNT(*) FROM forum_replies r WHERE r.topic_id = t.id AND r.is_hidden = 0) AS replies_count
         FROM forum_topics t
         JOIN forum_categories c ON c.id = t.category_id
         JOIN users u ON u.id = t.author_id
         WHERE t.is_hidden = 0
         ORDER BY t.is_pinned DESC, t.updated_at DESC, t.id DESC
         LIMIT 5`
      )
      .all();

    const stats = {
      hadiths: db.prepare('SELECT COUNT(*) AS c FROM hadiths WHERE is_published = 1').get().c,
      stories: db.prepare('SELECT COUNT(*) AS c FROM stories WHERE is_published = 1').get().c,
      sermons: db.prepare('SELECT COUNT(*) AS c FROM sermons WHERE is_published = 1').get().c,
      topics: db.prepare('SELECT COUNT(*) AS c FROM forum_topics WHERE is_hidden = 0').get().c,
      members: db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_banned = 0').get().c,
    };

    res.json({
      featuredHadith: featuredRow ? formatHadith(featuredRow, bookmarkSet) : null,
      stories: storyRows.map((s) => formatStory(s, bookmarkSet)),
      sermons: sermonRows.map((m) => formatSermon(m, bookmarkSet)),
      activeTopics,
      stats,
    });
  });

  router.get('/hadiths', (req, res) => {
    const { q = '', category = '', mood = '', grade = '' } = req.query;
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);
    const rows = db.prepare('SELECT * FROM hadiths WHERE is_published = 1 ORDER BY is_featured DESC, id ASC').all();

    const filtered = rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (grade && r.grade !== grade) return false;
      if (mood && !safeParseArray(r.mood_tags).includes(mood)) return false;
      if (q && !matchesArabicQuery(`${r.text_plain} ${r.title} ${r.text_diacritics} ${r.narrator} ${r.explanation}`, String(q))) {
        return false;
      }
      return true;
    });

    const categories = [...new Set(rows.map((r) => r.category))];
    const grades = [...new Set(rows.map((r) => r.grade))];
    res.json({
      items: filtered.map((r) => formatHadith(r, bookmarkSet)),
      categories,
      grades,
    });
  });

  router.get('/stories', (req, res) => {
    const { q = '', category = '', mood = '' } = req.query;
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);
    const rows = db.prepare('SELECT * FROM stories WHERE is_published = 1 ORDER BY id ASC').all();

    const filtered = rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (mood && !safeParseArray(r.mood_tags).includes(mood)) return false;
      if (q && !matchesArabicQuery(`${r.title} ${r.summary} ${r.paragraphs_json}`, String(q))) {
        return false;
      }
      return true;
    });

    res.json({ items: filtered.map((r) => formatStory(r, bookmarkSet)) });
  });

  router.get('/stories/:slug', (req, res) => {
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);
    const row = db
      .prepare('SELECT * FROM stories WHERE slug = ? AND is_published = 1')
      .get(req.params.slug);
    if (!row) {
      return res.status(404).json({ error: 'القصة المطلوبة غير موجودة' });
    }
    const related = db
      .prepare('SELECT * FROM stories WHERE is_published = 1 AND id != ? AND category = ? LIMIT 3')
      .all(row.id, row.category);
    const linkedTopic = db
      .prepare("SELECT id, title FROM forum_topics WHERE linked_type = 'story' AND linked_id = ? AND is_hidden = 0 LIMIT 1")
      .get(row.id);

    res.json({
      item: formatStory(row, bookmarkSet),
      related: related.map((s) => formatStory(s, bookmarkSet)),
      linkedTopic: linkedTopic || null,
    });
  });

  router.get('/sermons', (req, res) => {
    const { q = '', category = '', mood = '' } = req.query;
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);
    const rows = db.prepare('SELECT * FROM sermons WHERE is_published = 1 ORDER BY id ASC').all();

    const filtered = rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (mood && !safeParseArray(r.mood_tags).includes(mood)) return false;
      if (q && !matchesArabicQuery(`${r.title} ${r.excerpt} ${r.body_paragraphs_json}`, String(q))) {
        return false;
      }
      return true;
    });

    const categories = [...new Set(rows.map((r) => r.category))];
    res.json({
      items: filtered.map((r) => formatSermon(r, bookmarkSet)),
      categories,
    });
  });

  router.get('/companion', (req, res) => {
    const mood = String(req.query.mood || 'serenity');
    const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);

    const pickByMood = (rows) => {
      const matched = rows.filter((r) => safeParseArray(r.mood_tags).includes(mood));
      const pool = matched.length > 0 ? matched : rows;
      if (pool.length === 0) return null;
      return pool[offset % pool.length];
    };

    const hadithRow = pickByMood(db.prepare('SELECT * FROM hadiths WHERE is_published = 1 ORDER BY id ASC').all());
    const storyRow = pickByMood(db.prepare('SELECT * FROM stories WHERE is_published = 1 ORDER BY id ASC').all());
    const sermonRow = pickByMood(db.prepare('SELECT * FROM sermons WHERE is_published = 1 ORDER BY id ASC').all());

    res.json({
      mood,
      hadith: hadithRow ? formatHadith(hadithRow, bookmarkSet) : null,
      story: storyRow ? formatStory(storyRow, bookmarkSet) : null,
      sermon: sermonRow ? formatSermon(sermonRow, bookmarkSet) : null,
    });
  });

  router.post('/bookmarks/toggle', requireAuth, limit, (req, res) => {
    const { item_type, item_id } = req.body || {};
    const idNum = Number(item_id);
    if (!['hadith', 'story', 'sermon', 'topic'].includes(item_type) || !Number.isInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ error: 'بيانات المفضلة غير صالحة' });
    }

    const existing = db
      .prepare('SELECT id FROM bookmarks WHERE user_id = ? AND item_type = ? AND item_id = ?')
      .get(req.user.id, item_type, idNum);

    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
      return res.json({ bookmarked: false });
    }

    db.prepare('INSERT INTO bookmarks (user_id, item_type, item_id) VALUES (?, ?, ?)').run(
      req.user.id,
      item_type,
      idNum
    );
    return res.json({ bookmarked: true });
  });

  router.get('/bookmarks', requireAuth, (req, res) => {
    const bookmarkSet = getUserBookmarkSet(db, req.user.id);
    const rows = db
      .prepare('SELECT item_type, item_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    const hadiths = [];
    const stories = [];
    const sermons = [];
    const topics = [];

    for (const b of rows) {
      if (b.item_type === 'hadith') {
        const row = db.prepare('SELECT * FROM hadiths WHERE id = ? AND is_published = 1').get(b.item_id);
        if (row) hadiths.push(formatHadith(row, bookmarkSet));
      } else if (b.item_type === 'story') {
        const row = db.prepare('SELECT * FROM stories WHERE id = ? AND is_published = 1').get(b.item_id);
        if (row) stories.push(formatStory(row, bookmarkSet));
      } else if (b.item_type === 'sermon') {
        const row = db.prepare('SELECT * FROM sermons WHERE id = ? AND is_published = 1').get(b.item_id);
        if (row) sermons.push(formatSermon(row, bookmarkSet));
      } else if (b.item_type === 'topic') {
        const row = db
          .prepare(
            `SELECT t.id, t.title, t.created_at, c.name AS category_name
             FROM forum_topics t JOIN forum_categories c ON c.id = t.category_id
             WHERE t.id = ? AND t.is_hidden = 0`
          )
          .get(b.item_id);
        if (row) topics.push(row);
      }
    }

    res.json({ hadiths, stories, sermons, topics });
  });

  router.get('/search', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!normalizeArabic(q)) {
      return res.json({ hadiths: [], stories: [], sermons: [], topics: [] });
    }
    const bookmarkSet = getUserBookmarkSet(db, req.user?.id);

    const hadiths = db
      .prepare('SELECT * FROM hadiths WHERE is_published = 1')
      .all()
      .filter((r) => matchesArabicQuery(`${r.text_plain} ${r.title} ${r.narrator} ${r.explanation}`, q))
      .slice(0, 12)
      .map((r) => formatHadith(r, bookmarkSet));

    const stories = db
      .prepare('SELECT * FROM stories WHERE is_published = 1')
      .all()
      .filter((r) => matchesArabicQuery(`${r.title} ${r.summary} ${r.paragraphs_json}`, q))
      .slice(0, 8)
      .map((r) => formatStory(r, bookmarkSet));

    const sermons = db
      .prepare('SELECT * FROM sermons WHERE is_published = 1')
      .all()
      .filter((r) => matchesArabicQuery(`${r.title} ${r.excerpt} ${r.body_paragraphs_json}`, q))
      .slice(0, 8)
      .map((r) => formatSermon(r, bookmarkSet));

    const topics = db
      .prepare(
        `SELECT t.id, t.title, t.body, t.tags_json, t.created_at, c.name AS category_name,
                u.display_name AS author_name, u.badge AS author_badge
         FROM forum_topics t
         JOIN forum_categories c ON c.id = t.category_id
         JOIN users u ON u.id = t.author_id
         WHERE t.is_hidden = 0`
      )
      .all()
      .filter((r) => matchesArabicQuery(`${r.title} ${r.body} ${r.tags_json}`, q))
      .slice(0, 10)
      .map((t) => ({ ...t, tags: safeParseArray(t.tags_json) }));

    res.json({ hadiths, stories, sermons, topics });
  });

  return router;
}
