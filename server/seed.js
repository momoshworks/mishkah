import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeArabic } from './arabic.js';
import { hashPassword, computeBadge, recalculateUserPoints } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
}

/**
 * Idempotently seed the Mishkah database with curated library data and optional demo/admin accounts.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ demoMode?: boolean, adminEmail?: string, adminPassword?: string }} [options]
 */
export function seedDatabase(db, options = {}) {
  const {
    demoMode = process.env.MISHKAH_DEMO_MODE === 'true',
    adminEmail = process.env.ADMIN_EMAIL || '',
    adminPassword = process.env.ADMIN_PASSWORD || '',
  } = options;

  const hadithsData = loadJson('hadiths.json');
  const storiesData = loadJson('stories.json');
  const sermonsData = loadJson('sermons.json');
  const forumData = loadJson('forum.json');

  db.exec('BEGIN');
  try {
    // 1. Seed Hadiths if empty
    const hadithCount = db.prepare('SELECT COUNT(*) AS c FROM hadiths').get().c;
    const insertedHadithIds = [];
    if (hadithCount === 0) {
      const stmt = db.prepare(
        `INSERT INTO hadiths (
          title, text_diacritics, text_plain, narrator, source, grade,
          category, mood_tags, explanation, benefits_json, is_featured, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      );
      for (const h of hadithsData) {
        const plain = normalizeArabic(`${h.title} ${h.text_diacritics} ${h.narrator} ${h.source} ${h.category} ${h.explanation}`);
        const res = stmt.run(
          h.title,
          h.text_diacritics,
          plain,
          h.narrator,
          h.source,
          h.grade,
          h.category,
          JSON.stringify(h.mood_tags || []),
          h.explanation,
          JSON.stringify(h.benefits || []),
          h.is_featured ? 1 : 0
        );
        insertedHadithIds.push(Number(res.lastInsertRowid));
      }
    } else {
      for (const row of db.prepare('SELECT id FROM hadiths ORDER BY id ASC').all()) {
        insertedHadithIds.push(row.id);
      }
    }

    // 2. Seed Stories if empty
    const storyCount = db.prepare('SELECT COUNT(*) AS c FROM stories').get().c;
    const insertedStoryIds = [];
    if (storyCount === 0) {
      const stmt = db.prepare(
        `INSERT INTO stories (
          slug, title, category, summary, paragraphs_json, lessons_json,
          reading_minutes, mood_tags, accent_color, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      );
      for (const s of storiesData) {
        const res = stmt.run(
          s.slug,
          s.title,
          s.category,
          s.summary,
          JSON.stringify(s.paragraphs || []),
          JSON.stringify(s.lessons || []),
          s.reading_minutes || 4,
          JSON.stringify(s.mood_tags || []),
          s.accent_color || '#10b981'
        );
        insertedStoryIds.push(Number(res.lastInsertRowid));
      }
    } else {
      for (const row of db.prepare('SELECT id FROM stories ORDER BY id ASC').all()) {
        insertedStoryIds.push(row.id);
      }
    }

    // 3. Seed Sermons if empty
    const sermonCount = db.prepare('SELECT COUNT(*) AS c FROM sermons').get().c;
    const insertedSermonIds = [];
    if (sermonCount === 0) {
      const stmt = db.prepare(
        `INSERT INTO sermons (
          title, category, excerpt, body_paragraphs_json, reflection_question,
          mood_tags, reading_minutes, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      );
      for (const m of sermonsData) {
        const res = stmt.run(
          m.title,
          m.category,
          m.excerpt,
          JSON.stringify(m.body_paragraphs || []),
          m.reflection_question || '',
          JSON.stringify(m.mood_tags || []),
          m.reading_minutes || 3
        );
        insertedSermonIds.push(Number(res.lastInsertRowid));
      }
    } else {
      for (const row of db.prepare('SELECT id FROM sermons ORDER BY id ASC').all()) {
        insertedSermonIds.push(row.id);
      }
    }

    // 4. Seed Forum Categories (always safe & needed in both modes)
    const catStmt = db.prepare(
      `INSERT OR IGNORE INTO forum_categories (slug, name, description, icon, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const c of forumData.categories) {
      catStmt.run(c.slug, c.name, c.description, c.icon, c.sort_order);
    }

    // 5. Seed Users & Forum Topics depending on demoMode / env admin
    const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (demoMode && userCount === 0) {
      const demoPasswords = {
        admin: 'Mishkah@2026',
        moderator: 'Mod@2026',
        member: 'Member@2026',
      };
      const userMap = new Map();
      const userStmt = db.prepare(
        `INSERT INTO users (username, display_name, email, password_hash, role, badge, bio, avatar_color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const u of forumData.demoUsers) {
        const pw = demoPasswords[u.role] || demoPasswords.member;
        const badge = computeBadge(0, u.role);
        const res = userStmt.run(
          u.username,
          u.display_name,
          u.email,
          hashPassword(pw),
          u.role,
          badge,
          u.bio,
          u.avatar_color
        );
        userMap.set(u.username, Number(res.lastInsertRowid));
      }

      const categoryMap = new Map();
      for (const cat of db.prepare('SELECT id, slug FROM forum_categories').all()) {
        categoryMap.set(cat.slug, cat.id);
      }

      const topicCount = db.prepare('SELECT COUNT(*) AS c FROM forum_topics').get().c;
      if (topicCount === 0) {
        const topicStmt = db.prepare(
          `INSERT INTO forum_topics (
            category_id, author_id, title, body, tags_json, linked_type, linked_id, is_pinned, views_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const replyStmt = db.prepare(
          `INSERT INTO forum_replies (topic_id, author_id, body) VALUES (?, ?, ?)`
        );
        const voteStmt = db.prepare(
          `INSERT OR IGNORE INTO thanks_votes (user_id, target_type, target_id) VALUES (?, ?, ?)`
        );

        let idx = 0;
        for (const t of forumData.topics) {
          idx += 1;
          const catId = categoryMap.get(t.categorySlug);
          const authorId = userMap.get(t.authorUsername);
          let linkedId = null;
          if (t.linked_type === 'hadith') linkedId = insertedHadithIds[t.linked_index || 0] || null;
          if (t.linked_type === 'story') linkedId = insertedStoryIds[t.linked_index || 0] || null;
          if (t.linked_type === 'sermon') linkedId = insertedSermonIds[t.linked_index || 0] || null;

          const topicRes = topicStmt.run(
            catId,
            authorId,
            t.title,
            t.body,
            JSON.stringify(t.tags || []),
            t.linked_type || null,
            linkedId,
            t.is_pinned ? 1 : 0,
            25 + idx * 14
          );
          const topicId = Number(topicRes.lastInsertRowid);

          let bestReplyId = null;
          for (const r of t.replies || []) {
            const replyAuthorId = userMap.get(r.authorUsername);
            const rRes = replyStmt.run(topicId, replyAuthorId, r.body);
            const replyId = Number(rRes.lastInsertRowid);
            if (r.isBest) bestReplyId = replyId;

            let thanksCount = 0;
            for (const voterName of r.thankedBy || []) {
              const voterId = userMap.get(voterName);
              if (voterId) {
                voteStmt.run(voterId, 'reply', replyId);
                thanksCount += 1;
              }
            }
            if (thanksCount > 0) {
              db.prepare('UPDATE forum_replies SET thanks_count = ? WHERE id = ?').run(thanksCount, replyId);
            }
          }

          if (bestReplyId) {
            db.prepare('UPDATE forum_topics SET best_reply_id = ? WHERE id = ?').run(bestReplyId, topicId);
          }
        }

        for (const userId of userMap.values()) {
          recalculateUserPoints(db, userId);
        }
      }
    } else if (!demoMode && userCount === 0 && adminEmail && adminPassword) {
      const username = adminEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') || 'admin';
      db.prepare(
        `INSERT INTO users (username, display_name, email, password_hash, role, badge, bio, avatar_color)
         VALUES (?, ?, ?, ?, 'admin', 'مدير عام', 'مدير منصة مشكاة', '#d4af37')`
      ).run(username, 'مدير المنصة', adminEmail.trim().toLowerCase(), hashPassword(adminPassword));
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
