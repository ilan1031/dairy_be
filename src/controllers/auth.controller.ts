import { Request, Response } from 'express';
import {
  decodeAdminCredentials,
  decodeAdminEmail,
  getSessionSecret,
  SESSION_COOKIE,
  signSession,
  verifySessionToken,
} from '../utils/session';
import { hashPassword, verifyPassword } from '../utils/password';
import * as dataService from '../services/data.service';
import * as usersService from '../services/users.service';
import { seedIfEmpty } from '../services/seed.service';
import { getSubscriptionStatus } from '../utils/subscription';
import { stripSensitiveFields } from '../middleware/rbac';
import type { AuthRequest } from '../middleware/auth';

function setSessionCookie(
  res: Response,
  email: string,
  opts: { userId: string; role: string; isSuperAdmin: boolean }
) {
  const token = signSession(
    {
      email,
      userId: opts.userId,
      role: opts.role,
      isSuperAdmin: opts.isSuperAdmin,
    },
    getSessionSecret()
  );
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8 * 1000,
  });
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const creds = decodeAdminCredentials();
    if (creds && email === creds.email && password === creds.password) {
      await seedIfEmpty();
      const boot = await dataService.bootstrap(null, { isSuperAdmin: true });
      if (!boot.profile) {
        return res.status(500).json({ success: false, error: 'Business profile not found.' });
      }

      const users = await usersService.getUsers();
      const matched = users.find((u) => u.email === creds.email);
      setSessionCookie(res, creds.email, {
        userId: matched?.id || 'system',
        role: 'superadmin',
        isSuperAdmin: true,
      });

      return res.json({
        success: true,
        profile: boot.profile,
        user: matched || null,
        isSuperAdmin: true,
      });
    }

    const user = await usersService.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email address or password' });
    }
    if (!user.active) {
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Invalid email address or password' });
    }

    setSessionCookie(res, user.email, {
      userId: user.id,
      role: user.role,
      isSuperAdmin: false,
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
    if (!businessName || !ownerName || !mobileNumber || !emailAddress || !password) {
      return res.status(400).json({ success: false, error: 'All registration fields are required' });
    }

    const profile = await dataService.saveProfile({
      businessName,
      ownerName,
      mobileNumber,
      emailAddress,
      signupTimestamp: Date.now(),
      isLightTheme: true,
      language: 'en',
    });

    const user = await usersService.saveUser({
      name: ownerName,
      email: emailAddress,
      role: 'user',
      active: true,
      passwordHash: hashPassword(password),
      profile: { displayName: ownerName, phone: mobileNumber },
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

    setSessionCookie(res, emailAddress, {
      userId: user.id,
      role: user.role,
      isSuperAdmin: false,
    });

    return res.json({ success: true, profile, user, isSuperAdmin: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function whoami(req: Request, res: Response) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    const session = verifySessionToken(token, getSessionSecret());
    if (!session) {
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

export async function logout(_req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
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
