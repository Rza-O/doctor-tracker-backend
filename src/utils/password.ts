import bcrypt from 'bcryptjs';

// Cost factor 10 = 2^10 rounds. bcrypt is deliberately slow so stolen hashes
// are expensive to brute-force; 10 is a widely used production value. Cost 12
// was 4× slower and took ~2.5 s per login on the free-tier server's small CPU.
export const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * True if a stored hash was made with a different cost than the current one.
 * The cost is embedded in the hash itself ("$2b$12$..."), so after a correct
 * login we can transparently re-hash with the current cost — no password
 * resets or migrations needed when the cost changes.
 */
export function needsRehash(hash: string): boolean {
  return bcrypt.getRounds(hash) !== SALT_ROUNDS;
}
