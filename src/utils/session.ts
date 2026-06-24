const SESSION_COOKIE = 'dairy_session';
import type { SessionPayload } from '../types/models';

export function signSession(payload: Omit<SessionPayload, 'ts'> & { ts?: number }, secret: string): string {
  const full: SessionPayload = {
    ...payload,
    ts: payload.ts ?? Date.now(),
  };
  const body = JSON.stringify(full);
  const signature = Buffer.from(body + '::' + secret).toString('base64');
  return Buffer.from(body).toString('base64') + '.' + signature;
}

export function verifySessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payload = Buffer.from(parts[0], 'base64').toString('utf-8');
    const expected = Buffer.from(payload + '::' + secret).toString('base64');
    if (expected !== parts[1]) return null;
    const parsed = JSON.parse(payload) as SessionPayload;
    if (!parsed.email) return null;
    return {
      email: parsed.email,
      userId: parsed.userId || parsed.email,
      role: parsed.role || 'user',
      isSuperAdmin: Boolean(parsed.isSuperAdmin),
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
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

export { SESSION_COOKIE };
