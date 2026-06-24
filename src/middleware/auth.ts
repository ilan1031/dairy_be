import { Request, Response, NextFunction } from 'express';
import type { PermissionAction, AuthContext, SessionPayload, UserModel } from '../types/models';
import { userHasPageAction } from './rbac';
import { getSubscriptionStatus } from '../utils/subscription';
import { 
  decodeAdminEmail, 
  getSessionSecret, 
  SESSION_TOKEN_COOKIE, 
  LOGIN_TOKEN_COOKIE, 
  SUBSCRIPTION_TOKEN_COOKIE, 
  verifyToken 
} from '../utils/session';
import * as usersService from '../services/users.service';

export interface AuthRequest extends Request {
  session?: SessionPayload;
  auth?: AuthContext;
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const token = req.cookies?.[SESSION_TOKEN_COOKIE];
  if (!token) return null;
  const verified = verifyToken(token, getSessionSecret());
  if (!verified || !verified.email) return null;
  return {
    email: verified.email,
    userId: verified.userId || verified.email,
    role: verified.role || 'user',
    isSuperAdmin: Boolean(verified.isSuperAdmin),
    ts: verified.ts,
  };
}

export async function hydrateAuthContext(req: Request): Promise<AuthContext | null> {
  const session = getSessionFromRequest(req);
  if (!session) return null;

  const adminEmail = decodeAdminEmail();
  const isSuperAdmin = session.isSuperAdmin || (!!adminEmail && session.email === adminEmail);

  if (isSuperAdmin) {
    const users = await usersService.getUsers();
    const matched = users.find((u) => u.email === session.email) || null;
    const user =
      matched ||
      ({
        id: 'system',
        name: 'Super Admin',
        email: session.email,
        role: 'superadmin',
        active: true,
        permissions: {
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
          allowedPages: ['*'],
          canViewOthers: true,
          dataAccessScope: { mode: 'all', sharedUserIds: [] },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as UserModel);
    return {
      email: session.email,
      userId: user.id,
      role: 'superadmin',
      isSuperAdmin: true,
      user,
    };
  }

  const user = await usersService.getUserById(session.userId);
  if (!user || user.active === false) return null;

  return {
    email: session.email,
    userId: user.id,
    role: user.role,
    isSuperAdmin: false,
    user,
  };
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.cookies?.[SESSION_TOKEN_COOKIE];
  const loginToken = req.cookies?.[LOGIN_TOKEN_COOKIE];
  const subscriptionToken = req.cookies?.[SUBSCRIPTION_TOKEN_COOKIE];

  if (!sessionToken || !loginToken || !subscriptionToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token(s)' });
  }

  const session = verifyToken(sessionToken, getSessionSecret());
  const login = verifyToken(loginToken, getSessionSecret());
  const subscription = verifyToken(subscriptionToken, getSessionSecret());

  if (!session || !login || !subscription) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token(s)' });
  }

  if (session.userId !== login.userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Token user mismatch' });
  }

  const auth = await hydrateAuthContext(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  (req as AuthRequest).session = {
    email: session.email,
    userId: session.userId,
    role: session.role,
    isSuperAdmin: Boolean(session.isSuperAdmin),
    ts: session.ts,
  };
  (req as AuthRequest).auth = auth;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.cookies?.[SESSION_TOKEN_COOKIE];
  const loginToken = req.cookies?.[LOGIN_TOKEN_COOKIE];

  if (!sessionToken || !loginToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token(s)' });
  }

  const session = verifyToken(sessionToken, getSessionSecret());
  const login = verifyToken(loginToken, getSessionSecret());

  if (!session || !login) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token(s)' });
  }

  const auth = await hydrateAuthContext(req);
  if (!auth?.isSuperAdmin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  (req as AuthRequest).session = {
    email: session.email,
    userId: session.userId,
    role: session.role,
    isSuperAdmin: Boolean(session.isSuperAdmin),
    ts: session.ts,
  };
  (req as AuthRequest).auth = auth;
  next();
}

export function requirePageAction(page: string, action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const auth = authReq.auth || (await hydrateAuthContext(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!userHasPageAction(auth.user, page, action, auth.isSuperAdmin)) {
      return res.status(403).json({ success: false, error: `Missing ${action} permission on ${page}` });
    }
    authReq.auth = auth;
    next();
  };
}

export function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  const subscriptionToken = req.cookies?.[SUBSCRIPTION_TOKEN_COOKIE];
  if (!subscriptionToken) {
    return res.status(402).json({
      success: false,
      error: 'Subscription expired. Please renew.',
      subscriptionBlocked: true,
    });
  }
  const subscription = verifyToken(subscriptionToken, getSessionSecret());
  if (!subscription || subscription.blocked) {
    return res.status(402).json({
      success: false,
      error: subscription?.paymentMessage || 'Subscription expired. Please renew.',
      subscriptionBlocked: true,
    });
  }
  next();
}

export function requireAnyPageAction(page: string, actions: PermissionAction[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    const auth = authReq.auth || (await hydrateAuthContext(req));
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const allowed = actions.some((action) =>
      userHasPageAction(auth.user, page, action, auth.isSuperAdmin)
    );
    if (!allowed) {
      return res.status(403).json({ success: false, error: `Missing permission on ${page}` });
    }
    authReq.auth = auth;
    next();
  };
}
