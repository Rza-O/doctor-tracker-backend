import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '../constants/domain';
import { ACCESS_COOKIE } from '../modules/auth/auth.cookies';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/tokens';

/**
 * Authentication guard: rejects the request with 401 unless it carries a valid
 * access token, then exposes the caller as req.user. Stateless — no DB lookup.
 *
 * Reads the httpOnly cookie (browser); also accepts "Authorization: Bearer"
 * for API clients and tools that don't use cookies.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[ACCESS_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

  if (!token) throw ApiError.unauthorized();

  try {
    const { sub, role } = verifyAccessToken(token);
    req.user = { id: sub, role };
  } catch (err) {
    // Distinct code so the frontend knows to call /auth/refresh and retry.
    if (err instanceof jwt.TokenExpiredError) throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token expired');
    throw ApiError.unauthorized('Invalid access token');
  }

  next();
};

/**
 * Authorization guard: runs after requireAuth and allows only the given roles.
 * 401 = we don't know who you are; 403 = we know, but you're not allowed.
 *
 *   router.delete('/:id', requireRole('admin'), remove)
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!allowed.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
