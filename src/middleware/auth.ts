import { Request, Response, NextFunction } from 'express';
import type { PermissionAction, AuthContext, SessionPayload, UserModel } from '../types/models';
import { userHasPageAction } from './rbac';
import { getSubscriptionStatus } from '../utils/subscription';
import { decodeAdminEmail, getSessionSecret, SESSION_COOKIE, verifySessionToken } from '../utils/session';
import * as usersService from '../services/users.service';

export interface AuthRequest extends Request {
  session?: SessionPayload;
  auth?: AuthContext;
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const token = req.cookies?.[SESSION_COOKIE];
  return verifySessionToken(token, getSessionSecret());
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
  const auth = await hydrateAuthContext(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const session = getSessionFromRequest(req)!;
  (req as AuthRequest).session = session;
  (req as AuthRequest).auth = auth;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = await hydrateAuthContext(req);
  if (!auth?.isSuperAdmin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const session = getSessionFromRequest(req)!;
  (req as AuthRequest).session = session;
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
  const auth = (req as AuthRequest).auth;
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const status = getSubscriptionStatus(auth.user, auth.isSuperAdmin);
  if (status.blocked) {
    return res.status(402).json({
      success: false,
      error: status.paymentMessage || 'Subscription expired. Please renew.',
      subscriptionBlocked: true,
      subscriptionStatus: status,
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
