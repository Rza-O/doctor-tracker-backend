import type { Request, Response } from 'express';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from './auth.cookies';
import * as authService from './auth.service';

// Controllers only translate HTTP ↔ service calls. Tokens travel in cookies,
// never in the response body, so frontend JavaScript never touches them.

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ success: true, data: { user } });
}

export async function refresh(req: Request, res: Response) {
  try {
    const { user, accessToken, refreshToken } = await authService.refresh(req.cookies[REFRESH_COOKIE]);
    setAuthCookies(res, { accessToken, refreshToken });
    res.json({ success: true, data: { user } });
  } catch (err) {
    // A dead session shouldn't leave stale cookies behind.
    clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.json({ success: true, data: null });
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.id);
  res.json({ success: true, data: { user } });
}
