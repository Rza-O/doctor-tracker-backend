import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError';

// Brute-force protection for login: 10 failed attempts per IP per 15 minutes.
// Successful logins don't count, so a real user who mistypes once isn't punished.
// (In-memory store: fine for one instance; use a Redis store when scaling out.)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many login attempts. Try again in 15 minutes.'));
  },
});
