/**
 * Create a sliding-window in-memory rate limiter middleware.
 * @param {{ windowMs: number, max: number, disabled?: boolean }} options
 */
export function createRateLimiter({ windowMs = 60_000, max = 30, disabled = false } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    if (disabled) return next();
    const key = req.ip || req.headers['x-forwarded-for'] || 'local';
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((t) => t > cutoff);

    if (timestamps.length >= max) {
      hits.set(key, timestamps);
      return res.status(429).json({
        error: 'تم إرسال طلبات كثيرة خلال وقت قصير، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى',
      });
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    return next();
  };
}
