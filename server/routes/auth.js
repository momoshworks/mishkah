import express from 'express';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSessionByToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE_NAME,
} from '../auth.js';

const AVATAR_COLORS = ['#10b981', '#d4af37', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b'];

export function createAuthRouter(db, { demoMode = false, authLimiter } = {}) {
  const router = express.Router();
  const limit = authLimiter || ((_req, _res, next) => next());

  router.get('/config', (_req, res) => {
    res.json({ demoMode: Boolean(demoMode) });
  });

  router.get('/me', (req, res) => {
    res.json({
      user: req.user || null,
      banned: Boolean(req.bannedSession),
      banReason: req.banReason || undefined,
    });
  });

  router.post('/register', limit, (req, res) => {
    const { username, display_name, email, password } = req.body || {};
    const cleanUser = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const cleanDisplay = typeof display_name === 'string' ? display_name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUser)) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 إلى 30 حرفاً بالإنجليزية أو الأرقام' });
    }
    if (cleanDisplay.length < 2 || cleanDisplay.length > 50) {
      return res.status(400).json({ error: 'الاسم الظاهر يجب أن يكون بين حرفين و50 حرفاً' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' });
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
      .get(cleanEmail, cleanUser);
    if (existing) {
      return res.status(409).json({ error: 'البريد الإلكتروني أو اسم المستخدم مسجل بالفعل' });
    }

    const avatarColor = AVATAR_COLORS[cleanUser.length % AVATAR_COLORS.length];
    const passwordHash = hashPassword(password);
    const insert = db.prepare(
      `INSERT INTO users (username, display_name, email, password_hash, role, badge, avatar_color)
       VALUES (?, ?, ?, ?, 'member', 'عضو جديد', ?)`
    );
    const { lastInsertRowid } = insert.run(cleanUser, cleanDisplay, cleanEmail, passwordHash, avatarColor);
    const userId = Number(lastInsertRowid);

    const { rawToken, expiresAt } = createSession(db, userId);
    setSessionCookie(req, res, rawToken, expiresAt);

    const user = db
      .prepare(
        'SELECT id, username, display_name, email, role, badge, bio, avatar_color, points, created_at FROM users WHERE id = ?'
      )
      .get(userId);
    return res.status(201).json({ user });
  });

  router.post('/login', limit, (req, res) => {
    const { email, password } = req.body || {};
    const identifier = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!identifier || typeof password !== 'string') {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(identifier, identifier);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (user.is_banned) {
      return res.status(403).json({
        error: 'تم تعليق هذا الحساب لمخالفة ضوابط المنتدى',
        banReason: user.ban_reason || undefined,
      });
    }

    const { rawToken, expiresAt } = createSession(db, user.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        badge: user.badge,
        bio: user.bio,
        avatar_color: user.avatar_color,
        points: user.points,
        created_at: user.created_at,
      },
    });
  });

  router.post('/demo-login', limit, (req, res) => {
    if (!demoMode) {
      return res.status(403).json({ error: 'الدخول التجريبي السريع متاح في وضع التشغيل المحلي فقط' });
    }
    const { role = 'member' } = req.body || {};
    if (!['member', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'نوع الحساب التجريبي غير صالح' });
    }
    const user = db
      .prepare('SELECT * FROM users WHERE role = ? AND is_banned = 0 ORDER BY id ASC LIMIT 1')
      .get(role);
    if (!user) {
      return res.status(404).json({ error: 'الحساب التجريبي غير متوفر' });
    }

    const { rawToken, expiresAt } = createSession(db, user.id);
    setSessionCookie(req, res, rawToken, expiresAt);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        badge: user.badge,
        bio: user.bio,
        avatar_color: user.avatar_color,
        points: user.points,
        created_at: user.created_at,
      },
    });
  });

  router.post('/logout', (req, res) => {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    deleteSessionByToken(db, rawToken);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.patch('/profile', requireAuth, (req, res) => {
    const { display_name, bio } = req.body || {};
    const cleanDisplay = typeof display_name === 'string' ? display_name.trim() : req.user.display_name;
    const cleanBio = typeof bio === 'string' ? bio.trim().slice(0, 300) : req.user.bio;

    if (cleanDisplay.length < 2 || cleanDisplay.length > 50) {
      return res.status(400).json({ error: 'الاسم الظاهر يجب أن يكون بين حرفين و50 حرفاً' });
    }

    db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(
      cleanDisplay,
      cleanBio,
      req.user.id
    );
    const updated = db
      .prepare(
        'SELECT id, username, display_name, email, role, badge, bio, avatar_color, points, created_at FROM users WHERE id = ?'
      )
      .get(req.user.id);
    res.json({ user: updated });
  });

  return router;
}
