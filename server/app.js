import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { attachAuth } from './auth.js';
import { createRateLimiter } from './rateLimit.js';
import { createAuthRouter } from './routes/auth.js';
import { createLibraryRouter } from './routes/library.js';
import { createForumRouter } from './routes/forum.js';
import { createModerationRouter } from './routes/moderation.js';

/**
 * Create the Mishkah Express application.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ demoMode?: boolean, staticDir?: string, disableRateLimit?: boolean }} [options]
 */
export function createApp(db, options = {}) {
  const {
    demoMode = process.env.MISHKAH_DEMO_MODE === 'true',
    staticDir = path.resolve(process.cwd(), 'client', 'dist'),
    disableRateLimit = false,
  } = options;

  const app = express();
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(attachAuth(db));

  const authLimiter = createRateLimiter({ windowMs: 60_000, max: 25, disabled: disableRateLimit });
  const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 60, disabled: disableRateLimit });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'mishkah' });
  });

  app.use('/api/auth', createAuthRouter(db, { demoMode, authLimiter }));
  app.use('/api', createLibraryRouter(db, { writeLimiter }));
  app.use('/api', createForumRouter(db, { writeLimiter }));
  app.use('/api', createModerationRouter(db));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'نقطة النهاية المطلوبة غير موجودة' });
  });

  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'صيغة بيانات JSON المرسلة غير صالحة' });
    }
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
  });

  return app;
}
