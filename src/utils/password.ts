import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored?: string | null): boolean {
  if (!stored || !plain) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(plain, salt, KEY_LEN);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}
