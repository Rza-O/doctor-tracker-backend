import type { CookieOptions, Response } from 'express';
import { env, isProd } from '../../config/env';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The refresh token is only ever sent to the auth endpoints, never with
// ordinary API calls, so it is exposed as little as possible.
const REFRESH_PATH = '/api/v1/auth';

const base: CookieOptions = {
  httpOnly: true, // not readable by JavaScript → can't be stolen by XSS
  secure: isProd, // HTTPS only in production
  // The frontend proxies /api through its own domain, so requests are
  // same-site and 'lax' works; it also blocks most cross-site (CSRF) sends.
  sameSite: 'lax',
};

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...base, path: '/', maxAge: durationToMs(env.JWT_ACCESS_EXPIRES_IN) });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, path: REFRESH_PATH, maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN) });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

// "15m" → 900000. Format is already validated in config/env.ts.
function durationToMs(duration: string): number {
  const amount = Number(duration.slice(0, -1));
  const unit = duration.slice(-1) as keyof typeof UNIT_MS;
  return amount * UNIT_MS[unit];
}
