import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import {
  hashPassword,
  verifyPassword,
  computeBadge,
  recalculateUserPoints,
  createSession,
  invalidateUserSessions,
  attachAuth,
  requireAuth,
} from '../server/auth.js';
import { createRateLimiter } from '../server/rateLimit.js';

function mockReq(token) {
  return {
    cookies: token ? { mishkah_session: token } : {},
    ip: '127.0.0.1',
    headers: {},
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    cleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    clearCookie(name) {
      this.cleared.push(name);
      return this;
    },
  };
  return res;
}

test('openDatabase creates all 12 tables and enforces foreign keys', () => {
  const db = openDatabase(':memory:');
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);

  const expected = [
    'users',
    'sessions',
    'hadiths',
    'stories',
    'sermons',
    'bookmarks',
    'forum_categories',
    'forum_topics',
    'forum_replies',
    'thanks_votes',
    'reports',
    'notifications',
  ];
  for (const tbl of expected) {
    assert.ok(rows.includes(tbl), `Missing table: ${tbl}`);
  }
  const fk = db.prepare('PRAGMA foreign_keys').get();
  assert.equal(fk.foreign_keys, 1);
  db.close();
});

test('hashPassword uses unique salts and verifyPassword checks correctly', () => {
  const h1 = hashPassword('SecretPass123');
  const h2 = hashPassword('SecretPass123');
  assert.notEqual(h1, h2);
  assert.equal(verifyPassword('SecretPass123', h1), true);
  assert.equal(verifyPassword('WrongPass123', h1), false);
});

test('sessions resolve valid users and reject banned users while deleting sessions', () => {
  const db = openDatabase(':memory:');
  const pw = hashPassword('Pass1234!');
  const insert = db.prepare(
    "INSERT INTO users (username, display_name, email, password_hash, role, badge) VALUES (?, ?, ?, ?, 'member', 'عضو جديد')"
  );
  const { lastInsertRowid: userId } = insert.run('ali', 'علي', 'ali@example.com', pw);

  const { rawToken } = createSession(db, Number(userId));
  const authMw = attachAuth(db);

  // Valid request
  const req1 = mockReq(rawToken);
  const res1 = mockRes();
  let nextCalled = false;
  authMw(req1, res1, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req1.user.username, 'ali');

  // Ban user -> attachAuth strips session and requireAuth blocks with 403
  db.prepare("UPDATE users SET is_banned = 1, ban_reason = 'مخالفة' WHERE id = ?").run(userId);
  const req2 = mockReq(rawToken);
  const res2 = mockRes();
  authMw(req2, res2, () => {});
  assert.equal(req2.user, null);
  assert.equal(req2.bannedSession, true);

  const sessionCount = db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?').get(userId).c;
  assert.equal(sessionCount, 0);

  let blockedNext = false;
  requireAuth(req2, res2, () => {
    blockedNext = true;
  });
  assert.equal(blockedNext, false);
  assert.equal(res2.statusCode, 403);

  // Unban & verify manual session invalidation
  db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(userId);
  const { rawToken: token2 } = createSession(db, Number(userId));
  invalidateUserSessions(db, Number(userId));
  const req3 = mockReq(token2);
  const res3 = mockRes();
  authMw(req3, res3, () => {});
  assert.equal(req3.user, null);
  requireAuth(req3, res3, () => {});
  assert.equal(res3.statusCode, 401);
  db.close();
});

test('recalculateUserPoints computes points and badges accurately across hides', () => {
  const db = openDatabase(':memory:');
  const pw = hashPassword('Pass1234!');
  const uIns = db.prepare(
    "INSERT INTO users (username, display_name, email, password_hash, role, badge) VALUES (?, ?, ?, ?, 'member', 'عضو جديد')"
  );
  const authorId = Number(uIns.run('omar', 'عمر', 'omar@example.com', pw).lastInsertRowid);
  const voterId = Number(uIns.run('saad', 'سعد', 'saad@example.com', pw).lastInsertRowid);
  const catId = Number(
    db
      .prepare("INSERT INTO forum_categories (slug, name, description, icon, sort_order) VALUES ('qa', 'سؤال وجواب', 'desc', 'HelpCircle', 1)")
      .run().lastInsertRowid
  );

  // 1 topic (+10)
  const topicId = Number(
    db
      .prepare('INSERT INTO forum_topics (category_id, author_id, title, body) VALUES (?, ?, ?, ?)')
      .run(catId, authorId, 'سؤال مهم', 'تفاصيل السؤال هنا').lastInsertRowid
  );
  // 2 replies (+10)
  const r1 = Number(
    db
      .prepare('INSERT INTO forum_replies (topic_id, author_id, body) VALUES (?, ?, ?)')
      .run(topicId, authorId, 'إجابة أولى').lastInsertRowid
  );
  const r2 = Number(
    db
      .prepare('INSERT INTO forum_replies (topic_id, author_id, body) VALUES (?, ?, ?)')
      .run(topicId, authorId, 'إجابة ثانية').lastInsertRowid
  );
  // 2 thanks (+6)
  db.prepare("INSERT INTO thanks_votes (user_id, target_type, target_id) VALUES (?, 'topic', ?)").run(voterId, topicId);
  db.prepare("INSERT INTO thanks_votes (user_id, target_type, target_id) VALUES (?, 'reply', ?)").run(voterId, r1);
  // 1 best reply (+15)
  db.prepare('UPDATE forum_topics SET best_reply_id = ? WHERE id = ?').run(r1, topicId);

  const res1 = recalculateUserPoints(db, authorId);
  assert.equal(res1.points, 41); // 10 + 5 + 5 + 3 + 3 + 15
  assert.equal(res1.badge, 'مشارك نشط');
  assert.equal(computeBadge(260, 'member'), 'طالب علم');

  // Hide r1 (loses +5 reply, +3 thanks on r1, +15 best answer = 23 -> 18 left)
  db.prepare('UPDATE forum_replies SET is_hidden = 1 WHERE id = ?').run(r1);
  const res2 = recalculateUserPoints(db, authorId);
  assert.equal(res2.points, 18);
  assert.equal(res2.badge, 'عضو جديد');

  // Hide topic -> loses topic (+10), topic thanks (+3), and reply r2 inside hidden topic (+5) -> 0
  db.prepare('UPDATE forum_topics SET is_hidden = 1 WHERE id = ?').run(topicId);
  const res3 = recalculateUserPoints(db, authorId);
  assert.equal(res3.points, 0);
  assert.equal(res3.badge, 'عضو جديد');
  db.close();
});

test('createRateLimiter blocks requests past max threshold with 429', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
  let passed = 0;
  for (let i = 0; i < 2; i++) {
    const res = mockRes();
    limiter(mockReq(), res, () => {
      passed++;
    });
  }
  assert.equal(passed, 2);

  const resBlocked = mockRes();
  let blockedPassed = false;
  limiter(mockReq(), resBlocked, () => {
    blockedPassed = true;
  });
  assert.equal(blockedPassed, false);
  assert.equal(resBlocked.statusCode, 429);
});
