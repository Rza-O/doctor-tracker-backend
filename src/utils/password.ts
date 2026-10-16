import bcrypt from 'bcryptjs';

// Cost factor 12 ≈ a few hundred ms per hash: slow enough to make brute force
// expensive, fast enough for a login request.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
