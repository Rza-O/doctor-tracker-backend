import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '../constants/domain';
import { env } from '../config/env';

const ISSUER = 'doctor-tracker-api';
// Pin the algorithm on verify so a token can't pick its own (e.g. "none").
const ALGORITHM = 'HS256';

// Access token: proves identity on every request. Short-lived, carries the
// role so authorization checks need no DB lookup.
export type AccessPayload = { sub: string; role: Role };

// Refresh token: only used to get a new access token. Carries tokenVersion so
// the server can revoke it by bumping the user's counter.
export type RefreshPayload = { sub: string; tokenVersion: number };

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

// Both verifiers throw on bad signature / expiry / wrong issuer; callers turn
// that into a 401.
export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM], issuer: ISSUER }) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM], issuer: ISSUER }) as RefreshPayload;
}
