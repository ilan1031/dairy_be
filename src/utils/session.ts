export const SESSION_TOKEN_COOKIE = 'dairy_session';
export const LOGIN_TOKEN_COOKIE = 'dairy_login';
export const SUBSCRIPTION_TOKEN_COOKIE = 'dairy_subscription';

import type { SessionPayload } from '../types/models';

export function signToken(payload: Record<string, unknown>, secret: string): string {
  const full = {
    ...payload,
    ts: Date.now(),
  };
  const body = JSON.stringify(full);
  const signature = Buffer.from(body + '::' + secret).toString('base64');
  return Buffer.from(body).toString('base64') + '.' + signature;
}

export function verifyToken(token: string | undefined, secret: string): Record<string, any> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = Buffer.from(parts[0], 'base64').toString('utf-8');
    const expected = Buffer.from(payload + '::' + secret).toString('base64');
    if (expected !== parts[1]) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function signSession(payload: Omit<SessionPayload, 'ts'> & { ts?: number }, secret: string): string {
  return signToken(payload as Record<string, unknown>, secret);
}

export function verifySessionToken(token: string | undefined, secret: string): SessionPayload | null {
  const verified = verifyToken(token, secret);
  if (!verified || !verified.email) return null;
  return {
    email: verified.email,
    userId: verified.userId || verified.email,
    role: verified.role || 'user',
    isSuperAdmin: Boolean(verified.isSuperAdmin),
    ts: verified.ts,
  };
}

export function decodeAdminEmail(): string | null {
  const masked = process.env.ADMIN_EMAIL_MASKED;
  if (!masked) return null;
  try {
    return Buffer.from(masked, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function decodeAdminCredentials(): { email: string; password: string } | null {
  const maskedEmail = process.env.ADMIN_EMAIL_MASKED;
  const maskedPassword = process.env.ADMIN_PASSWORD_MASKED;
  if (!maskedEmail || !maskedPassword) return null;
  try {
    return {
      email: Buffer.from(maskedEmail, 'base64').toString('utf-8'),
      password: Buffer.from(maskedPassword, 'base64').toString('utf-8'),
    };
  } catch {
    return null;
  }
}

export function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || 'dev_secret_change_me';
}

const SESSION_COOKIE = SESSION_TOKEN_COOKIE;
export { SESSION_COOKIE };
