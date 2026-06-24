import type { PermissionAction, PermissionSet, UserModel, SharedAccessRights } from '../types/models';

const ACTION_TO_LEGACY: Record<PermissionAction, keyof PermissionSet | null> = {
  view: 'canRead',
  create: 'canCreate',
  edit: 'canUpdate',
  delete: 'canDelete',
  export: 'canRead',
  share: 'canRead',
  exportAll: 'canRead',
};

const DEFAULT_SHARED_RIGHTS: SharedAccessRights = {
  sales: true,
  inventory: true,
  customers: true,
};

export function isSuperUser(user: UserModel | null | undefined, isSuperAdmin?: boolean): boolean {
  if (isSuperAdmin) return true;
  return user?.role === 'superadmin';
}

export function userHasPageAction(
  user: UserModel | null | undefined,
  page: string,
  action: PermissionAction,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin || isSuperUser(user)) return true;
  if (!user || user.active === false) return false;

  const perms = user.permissions || ({} as PermissionSet);
  const pagePerms = perms.pagePermissions?.[page];
  if (pagePerms?.length) {
    return pagePerms.includes(action);
  }

  const pages = perms.allowedPages || [];
  if (!pages.includes('*') && !pages.includes(page)) return false;

  const legacyKey = ACTION_TO_LEGACY[action];
  if (!legacyKey || legacyKey === 'allowedPages') return false;
  return Boolean(perms[legacyKey]);
}

export function userCanAccessField(
  user: UserModel | null | undefined,
  page: string,
  field: string,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin || isSuperUser(user)) return true;
  if (!user || user.active === false) return false;
  const fieldPerms = user.permissions?.fieldPermissions?.[page];
  if (!fieldPerms || fieldPerms[field] === undefined) return true;
  return Boolean(fieldPerms[field]);
}

function allowedOwnerIds(user: UserModel, includeShared: boolean): Set<string> {
  const scope = user.permissions?.dataAccessScope || { mode: 'own', sharedUserIds: [] };
  const ids = new Set<string>([user.id]);
  if (includeShared && scope.mode === 'shared') {
    (scope.sharedUserIds || []).forEach((id) => ids.add(id));
  }
  return ids;
}

export function filterByDataScope<T extends { ownerUserId?: string }>(
  items: T[],
  user: UserModel | null | undefined,
  isSuperAdmin?: boolean,
  resource?: keyof SharedAccessRights
): T[] {
  if (!user || isSuperAdmin || isSuperUser(user)) return items;

  const scope = user.permissions?.dataAccessScope || { mode: 'own', sharedUserIds: [] };
  if (scope.mode === 'all') return items;

  const rights = { ...DEFAULT_SHARED_RIGHTS, ...(scope.sharedRights || {}) };
  const includeShared = scope.mode === 'shared' && (!resource || rights[resource]);

  if (scope.mode === 'own' || !includeShared) {
    return items.filter((item) => !item.ownerUserId || item.ownerUserId === user.id);
  }

  const allowed = allowedOwnerIds(user, true);
  return items.filter((item) => !item.ownerUserId || allowed.has(item.ownerUserId));
}

export function stripSensitiveFields<T extends Record<string, unknown>>(user: T): UserModel {
  const { passwordHash: _pw, ...rest } = user as T & { passwordHash?: string };
  return rest as unknown as UserModel;
}
