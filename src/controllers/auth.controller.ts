import { Request, Response } from 'express';
import {
  decodeAdminCredentials,
  decodeAdminEmail,
  getSessionSecret,
  SESSION_TOKEN_COOKIE,
  LOGIN_TOKEN_COOKIE,
  SUBSCRIPTION_TOKEN_COOKIE,
  verifyToken,
  signToken,
  SESSION_COOKIE,
  verifySessionToken,
} from '../utils/session';
import { hashPassword, verifyPassword } from '../utils/password';
import * as dataService from '../services/data.service';
import * as usersService from '../services/users.service';
import { seedIfEmpty } from '../services/seed.service';
import { getSubscriptionStatus } from '../utils/subscription';
import { stripSensitiveFields } from '../middleware/rbac';
import type { AuthRequest } from '../middleware/auth';
import { getTokenConfig } from '../services/tokenConfig.service';
import * as ipLimitService from '../services/ipLimit.service';
import type { AuditLogEntry, UserModel } from '../types/models';

function getSessionCookieOptions(req: Request, maxAge?: number) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isHttps =
    req.secure ||
    (Array.isArray(forwardedProto)
      ? forwardedProto.includes('https')
      : forwardedProto === 'https') ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isHttps,
    path: '/',
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const candidates = [
    req.ip,
    Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],
    (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress,
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) return 'unknown';

  const first = candidates[0].split(',')[0].trim();
  return first || 'unknown';
}

async function appendAuthAudit(
  req: Request,
  entry: Omit<AuditLogEntry, 'id' | 'createdAt'> & { details?: Record<string, unknown> | null; resourceType?: string }
) {
  const auditEntry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...entry,
    resourceType: entry.resourceType || 'auth',
  };

  await dataService.appendAuditLog(auditEntry);
  return auditEntry;
}

async function setSessionCookie(
  req: Request,
  res: Response,
  email: string,
  opts: { userId: string; role: string; isSuperAdmin: boolean; subscription?: UserModel['subscription'] }
) {
  const tokenConfig = await getTokenConfig();

  const sessionMaxAge = tokenConfig.sessionExpirySeconds * 1000;
  const loginMaxAge = tokenConfig.loginExpirySeconds * 1000;
  const subscriptionMaxAge = tokenConfig.subscriptionExpirySeconds * 1000;

  const sessionToken = signToken({
    email,
    userId: opts.userId,
    role: opts.role,
    isSuperAdmin: opts.isSuperAdmin
  }, getSessionSecret());

  const loginToken = signToken({
    email,
    userId: opts.userId,
    role: opts.role
  }, getSessionSecret());

  const matchedUser = opts.isSuperAdmin ? null : await usersService.getUserById(opts.userId);
  const subStatus = getSubscriptionStatus(matchedUser, opts.isSuperAdmin);

  const subscriptionToken = signToken({
    userId: opts.userId,
    plan: opts.subscription?.plan || matchedUser?.subscription?.plan || 'free',
    blocked: Boolean(subStatus.blocked),
    paymentMessage: subStatus.paymentMessage || ''
  }, getSessionSecret());

  res.cookie(SESSION_TOKEN_COOKIE, sessionToken, getSessionCookieOptions(req, sessionMaxAge));
  res.cookie(LOGIN_TOKEN_COOKIE, loginToken, getSessionCookieOptions(req, loginMaxAge));
  res.cookie(SUBSCRIPTION_TOKEN_COOKIE, subscriptionToken, getSessionCookieOptions(req, subscriptionMaxAge));
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const ipAddress = getClientIp(req);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const creds = decodeAdminCredentials();
    if (creds && normalizedEmail === creds.email.toLowerCase() && password === creds.password) {
      await seedIfEmpty();
      const boot = await dataService.bootstrap({ email: creds.email } as UserModel, { isSuperAdmin: true });
      const profile = boot.profile || {
        businessName: '',
        ownerName: '',
        mobileNumber: '',
        emailAddress: creds.email,
        signupTimestamp: Date.now(),
        isLightTheme: true,
        language: 'en',
      };

      const users = await usersService.getUsers();
      const matched = users.find((u) => u.email === creds.email);
      await setSessionCookie(req, res, creds.email, {
        userId: matched?.id || 'system',
        role: 'superadmin',
        isSuperAdmin: true,
      });
      await appendAuthAudit(req, {
        userId: matched?.id || 'system',
        userName: matched?.name || 'System Admin',
        userEmail: creds.email,
        action: 'login_success',
        resourceType: 'auth',
        details: { ipAddress, source: 'admin' },
        resourceId: matched?.id || 'system',
      });

      return res.json({
        success: true,
        profile,
        user: matched || null,
        isSuperAdmin: true,
      });
    }

    const user = await usersService.getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      await appendAuthAudit(req, {
        userId: 'unknown',
        userName: normalizedEmail || 'unknown',
        userEmail: normalizedEmail || undefined,
        action: 'login_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'invalid_credentials', email: normalizedEmail },
        resourceId: normalizedEmail || 'unknown',
      });
      return res.status(401).json({ success: false, error: 'Invalid email address or password' });
    }
    if (!user.active) {
      await appendAuthAudit(req, {
        userId: user.id,
        userName: user.name || normalizedEmail,
        userEmail: user.email,
        action: 'login_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'account_inactive' },
        resourceId: user.id,
      });
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      await appendAuthAudit(req, {
        userId: user.id,
        userName: user.name || normalizedEmail,
        userEmail: user.email,
        action: 'login_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'invalid_credentials' },
        resourceId: user.id,
      });
      return res.status(401).json({ success: false, error: 'Invalid email address or password' });
    }

    await setSessionCookie(req, res, user.email, {
      userId: user.id,
      role: user.role,
      isSuperAdmin: false,
    });

    await appendAuthAudit(req, {
      userId: user.id,
      userName: user.name || normalizedEmail,
      userEmail: user.email,
      action: 'login_success',
      resourceType: 'auth',
      details: { ipAddress, source: 'user' },
      resourceId: user.id,
    });

    const safeUser = stripSensitiveFields(user as unknown as Record<string, unknown>);
    return res.json({
      success: true,
      profile: (await dataService.bootstrap(user, { isSuperAdmin: false })).profile,
      user: safeUser,
      isSuperAdmin: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An error occurred during authentication';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { businessName, ownerName, mobileNumber, emailAddress, password } = req.body;
    const normalizedEmail = String(emailAddress || '').trim().toLowerCase();
    const normalizedMobile = String(mobileNumber || '').trim();
    const ipAddress = getClientIp(req);

    if (!businessName || !ownerName || !normalizedMobile || !normalizedEmail || !password) {
      return res.status(400).json({ success: false, error: 'All registration fields are required' });
    }

    const existingUser = await usersService.getUserByEmail(normalizedEmail);
    if (existingUser) {
      await appendAuthAudit(req, {
        userId: existingUser.id,
        userName: existingUser.name || ownerName || normalizedEmail,
        userEmail: normalizedEmail,
        action: 'signup_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'email_already_registered', emailAddress: normalizedEmail },
        resourceId: existingUser.id,
      });
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const users = await usersService.getUsers();
    const duplicateMobile = users.find((u) => String(u.profile?.phone || '').trim() === normalizedMobile);
    if (duplicateMobile) {
      await appendAuthAudit(req, {
        userId: duplicateMobile.id,
        userName: duplicateMobile.name || ownerName || normalizedEmail,
        userEmail: normalizedEmail,
        action: 'signup_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'mobile_already_registered', mobileNumber: normalizedMobile },
        resourceId: duplicateMobile.id,
      });
      return res.status(409).json({ success: false, error: 'Mobile number already registered' });
    }

    const currentUsage = await ipLimitService.getIpCreationUsage(ipAddress);
    const limitCheck = await ipLimitService.canCreateUserFromIp(ipAddress, currentUsage);
    if (!limitCheck.allowed) {
      await appendAuthAudit(req, {
        userId: 'ip_limit',
        userName: ownerName,
        userEmail: normalizedEmail,
        action: 'signup_failed',
        resourceType: 'auth',
        details: { ipAddress, reason: 'ip_limit_exceeded', limit: limitCheck.limit, currentCount: limitCheck.currentCount },
        resourceId: 'ip_limit',
      });
      return res.status(429).json({ success: false, error: `Too many users from this IP. Limit is ${limitCheck.limit}.` });
    }

    const profile = await dataService.saveProfile({
      businessName,
      ownerName,
      mobileNumber: normalizedMobile,
      emailAddress: normalizedEmail,
      signupTimestamp: Date.now(),
      isLightTheme: true,
      language: 'en',
    });

    const user = await usersService.saveUser({
      name: ownerName,
      email: normalizedEmail,
      role: 'user',
      active: true,
      passwordHash: hashPassword(password),
      profile: { displayName: ownerName, phone: normalizedMobile },
      permissions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: false,
        allowedPages: ['Dashboard', 'Sales', 'Bills', 'Profiles', 'Settings'],
        canUseSubscription: false,
        canViewOthers: false,
        pagePermissions: {
          Dashboard: ['view'],
          Sales: ['view', 'create', 'edit'],
          Bills: ['view', 'edit'],
          Profiles: ['view', 'create', 'edit'],
          Settings: ['view', 'edit'],
        },
        dataAccessScope: { mode: 'own', sharedUserIds: [] },
      },
    });

    await ipLimitService.incrementIpCreationUsage(ipAddress);

    await setSessionCookie(req, res, normalizedEmail, {
      userId: user.id,
      role: user.role,
      isSuperAdmin: false,
    });

    await appendAuthAudit(req, {
      userId: user.id,
      userName: ownerName,
      userEmail: normalizedEmail,
      action: 'signup_success',
      resourceType: 'auth',
      details: { ipAddress, businessName, mobileNumber: normalizedMobile },
      resourceId: user.id,
    });

    return res.json({ success: true, profile, user, isSuperAdmin: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function whoami(req: Request, res: Response) {
  try {
    const sessionToken = req.cookies?.[SESSION_TOKEN_COOKIE];
    const loginToken = req.cookies?.[LOGIN_TOKEN_COOKIE];
    const subscriptionToken = req.cookies?.[SUBSCRIPTION_TOKEN_COOKIE];

    if (!sessionToken || !loginToken || !subscriptionToken) {
      return res.json({ authenticated: false });
    }

    const session = verifySessionToken(sessionToken, getSessionSecret());
    const login = verifyToken(loginToken, getSessionSecret());
    const subscription = verifyToken(subscriptionToken, getSessionSecret());

    if (!session || !login || !subscription || session.userId !== login.userId) {
      return res.json({ authenticated: false });
    }

    const adminEmail = decodeAdminEmail();
    const isSuper = session.isSuperAdmin || (!!adminEmail && session.email === adminEmail);

    let user = null;
    if (isSuper) {
      const users = await usersService.getUsers();
      user = users.find((u) => u.email === session.email) || null;
    } else {
      user = await usersService.getUserById(session.userId);
      if (!user || !user.active) {
        return res.json({ authenticated: false });
      }
    }

    return res.json({
      authenticated: true,
      email: session.email,
      userId: session.userId,
      isSuperAdmin: isSuper,
      user,
      subscriptionStatus: getSubscriptionStatus(user, isSuper),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'error';
    return res.status(500).json({ authenticated: false, error: message });
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie(SESSION_TOKEN_COOKIE, getSessionCookieOptions(req));
  res.clearCookie(LOGIN_TOKEN_COOKIE, getSessionCookieOptions(req));
  res.clearCookie(SUBSCRIPTION_TOKEN_COOKIE, getSessionCookieOptions(req));
  return res.json({ success: true });
}

export async function changePassword(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { currentPassword, newPassword, userId } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const targetId = auth.isSuperAdmin && userId ? userId : auth.userId;
    const target = await usersService.getUserByEmail(
      (await usersService.getUserById(targetId))?.email || auth.email
    );

    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!auth.isSuperAdmin || target.id === auth.userId) {
      if (!currentPassword || !verifyPassword(currentPassword, target.passwordHash)) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect' });
      }
    }

    await usersService.saveUser({
      ...target,
      passwordHash: hashPassword(newPassword),
    });

    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to change password';
    return res.status(500).json({ success: false, error: message });
  }
}
