import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many login attempts. Please try again later.' },
});
