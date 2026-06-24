import type { UserModel } from '../types/models';

export interface SubscriptionStatus {
  blocked: boolean;
  reason?: string;
  expiresAt?: number;
  plan?: string;
  paymentMessage?: string;
}

export function getSubscriptionStatus(
  user: UserModel | null | undefined,
  isSuperAdmin?: boolean
): SubscriptionStatus {
  if (isSuperAdmin || !user || user.role === 'superadmin') {
    return { blocked: false };
  }

  const sub = user.subscription;
  const perms = user.permissions;

  if (!perms?.canUseSubscription) {
    return {
      blocked: true,
      reason: 'access_revoked',
      plan: sub?.plan,
      expiresAt: sub?.expiresAt,
      paymentMessage: sub?.paymentMessage || 'Your access has been paused. Contact admin to renew.',
    };
  }

  if (sub?.plan === 'lifetime') {
    return { blocked: false, plan: 'lifetime' };
  }

  const due = sub?.expiresAt ?? sub?.dueDate;
  if (due && Date.now() > due) {
    return {
      blocked: true,
      reason: 'expired',
      expiresAt: due,
      plan: sub?.plan,
      paymentMessage:
        sub?.paymentMessage ||
        `Subscription expired on ${new Date(due).toLocaleDateString()}. Please renew to continue.`,
    };
  }

  return { blocked: false, plan: sub?.plan, expiresAt: due };
}
