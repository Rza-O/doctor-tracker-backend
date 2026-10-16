import bcrypt from 'bcryptjs';
import type { Role } from '../../constants/domain';
import { UserModel } from '../../models/User';
import { ApiError } from '../../utils/ApiError';
import { verifyPassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens';
import type { LoginInput } from './auth.schema';

export type PublicUser = { _id: string; name: string; email: string; role: Role };

// Compared against when the email doesn't exist, so a wrong email takes as
// long as a wrong password — response time can't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 12);

const invalidCredentials = () => ApiError.unauthorized('Invalid email or password');

function issueTokens(user: { _id: unknown; role: Role; tokenVersion: number }) {
  const sub = String(user._id);
  return {
    accessToken: signAccessToken({ sub, role: user.role }),
    refreshToken: signRefreshToken({ sub, tokenVersion: user.tokenVersion }),
  };
}

function toPublicUser(user: { _id: unknown; name: string; email: string; role: Role }): PublicUser {
  return { _id: String(user._id), name: user.name, email: user.email, role: user.role };
}

export async function login({ email, password }: LoginInput) {
  const user = await UserModel.findOne({ email }).select('+passwordHash +tokenVersion').lean();

  const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) throw invalidCredentials();

  return { user: toPublicUser(user), ...issueTokens(user) };
}

/**
 * Exchanges a valid refresh token for a fresh token pair. Re-issuing the
 * refresh token gives a sliding session: an active user stays signed in, an
 * idle one expires after 7 days. Older refresh tokens stay valid until logout
 * bumps tokenVersion (true one-time rotation would need a sessions store).
 */
export async function refresh(refreshToken: string | undefined) {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.sub).select('+tokenVersion').lean();
  // Version mismatch = the user logged out after this token was issued.
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Session has been revoked');
  }

  return { user: toPublicUser(user), ...issueTokens(user) };
}

/**
 * Revokes every refresh token issued so far by bumping tokenVersion.
 * Works from the refresh token so logout succeeds even after the access
 * token has expired. Never throws: logging out must always clear cookies.
 */
export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  try {
    const { sub } = verifyRefreshToken(refreshToken);
    await UserModel.updateOne({ _id: sub }, { $inc: { tokenVersion: 1 } });
  } catch {
    // Invalid/expired token: nothing to revoke.
  }
}

export async function getMe(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) throw ApiError.unauthorized('User no longer exists');
  return toPublicUser(user);
}
