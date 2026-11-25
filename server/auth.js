import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'mishkah_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Hash a plaintext password using scrypt with a random 16-byte salt.
 * @param {string} password
 * @returns {string}
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verify a plaintext password against a stored salt:hash string.
 * @param {string} password
 * @param {string} stored
 * @returns {boolean}
 */
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, keyBuf.length);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Derive display badge from points and role.
 * @param {number} points
 * @param {string} role
 * @returns {string}
 */
export function computeBadge(points, role) {
  if (role === 'admin') return 'مدير عام';
  if (role === 'moderator') return 'مشرف';
  if (points >= 250) return 'طالب علم';
  if (points >= 100) return 'محبّ للخير';
  if (points >= 30) return 'مشارك نشط';
  return 'عضو جديد';
}

/**
 * Recompute user points and badge from non-hidden forum contributions.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} userId
 * @returns {{ points: number, badge: string }}
 */
export function recalculateUserPoints(db, userId) {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
  if (!user) return { points: 0, badge: 'عضو جديد' };

  const topicsCount = db
    .prepare('SELECT COUNT(*) AS c FROM forum_topics WHERE author_id = ? AND is_hidden = 0')
    .get(userId).c;

  const repliesCount = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM forum_replies r
       JOIN forum_topics t ON r.topic_id = t.id
       WHERE r.author_id = ? AND r.is_hidden = 0 AND t.is_hidden = 0`
    )
    .get(userId).c;

  const topicThanks = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM thanks_votes tv
       JOIN forum_topics t ON tv.target_id = t.id
       WHERE tv.target_type = 'topic' AND t.author_id = ? AND t.is_hidden = 0`
    )
    .get(userId).c;

  const replyThanks = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM thanks_votes tv
       JOIN forum_replies r ON tv.target_id = r.id
       JOIN forum_topics t ON r.topic_id = t.id
       WHERE tv.target_type = 'reply' AND r.author_id = ? AND r.is_hidden = 0 AND t.is_hidden = 0`
    )
    .get(userId).c;

  const bestAnswers = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM forum_topics t
       JOIN forum_replies r ON t.best_reply_id = r.id
       WHERE r.author_id = ? AND t.is_hidden = 0 AND r.is_hidden = 0`
    )
    .get(userId).c;

  const points =
    topicsCount * 10 +
    repliesCount * 5 +
    (topicThanks + replyThanks) * 3 +
    bestAnswers * 15;

  const badge = computeBadge(points, user.role);
  db.prepare('UPDATE users SET points = ?, badge = ? WHERE id = ?').run(points, badge, userId);
  return { points, badge };
}

/**
 * Create a new persisted session for userId.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} userId
 * @returns {{ rawToken: string, expiresAt: string }}
 */
export function createSession(db, userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    tokenHash,
    userId,
    expiresAt
  );
  return { rawToken, expiresAt };
}

export function deleteSessionByToken(db, rawToken) {
  if (!rawToken) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

export function invalidateUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function setSessionCookie(req, res, rawToken, expiresAt) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(isHttps),
    expires: new Date(expiresAt),
    path: '/',
  });
}

export function clearSessionCookie(req, res) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(isHttps),
    path: '/',
  });
}

/**
 * Express middleware attaching req.user from session cookie if valid and not banned.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function attachAuth(db) {
  return (req, res, next) => {
    req.user = null;
    req.bannedSession = false;
    req.banReason = '';
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (!rawToken) return next();

    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(
        `SELECT s.id AS session_id, s.expires_at,
                u.id, u.username, u.display_name, u.email, u.role, u.badge, u.bio,
                u.avatar_color, u.points, u.is_banned, u.ban_reason, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash);

    if (!row) return next();

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(row.session_id);
      return next();
    }

    if (row.is_banned) {
      invalidateUserSessions(db, row.id);
      clearSessionCookie(req, res);
      req.bannedSession = true;
      req.banReason = row.ban_reason || '';
      return next();
    }

    req.user = {
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      email: row.email,
      role: row.role,
      badge: row.badge,
      bio: row.bio,
      avatar_color: row.avatar_color,
      points: row.points,
      is_banned: Boolean(row.is_banned),
      created_at: row.created_at,
    };
    return next();
  };
}

export function requireAuth(req, res, next) {
  if (req.bannedSession) {
    return res.status(403).json({
      error: 'تم تعليق هذا الحساب لمخالفة ضوابط المنتدى',
      banReason: req.banReason || undefined,
    });
  }
  if (!req.user) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً للمتابعة' });
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.bannedSession) {
      return res.status(403).json({ error: 'تم تعليق هذا الحساب لمخالفة ضوابط المنتدى' });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً للمتابعة' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليست لديك الصلاحية اللازمة لتنفيذ هذا الإجراء' });
    }
    return next();
  };
}
