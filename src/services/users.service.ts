import fs from 'fs/promises';

import path from 'path';

import { getFirestore, isFirebaseConfigured } from '../config/firebase';

import type { UserModel, PermissionSet, UserAuthRecord } from '../types/models';

import { stripSensitiveFields } from '../middleware/rbac';

import { getPermissionCatalog } from './permissionCatalog.service';



const DATA_FILE = path.join(process.cwd(), 'data', 'users.json');



const DEFAULT_PERMISSIONS: PermissionSet = {

  canCreate: false,

  canRead: true,

  canUpdate: false,

  canDelete: false,

  allowedPages: ['Dashboard'],

  canUseSubscription: true,

  canViewOthers: false,

  pagePermissions: {},

  fieldPermissions: {},

  dataAccessScope: { mode: 'own', sharedUserIds: [], sharedRights: { sales: true, inventory: true, customers: true } },

  resourceLimits: {},

};



function normalizeUser(user: Record<string, unknown>): UserAuthRecord {

  const perms = (user.permissions || {}) as Partial<PermissionSet>;

  const active = user.active !== false;

  return {

    id: String(user.id),

    name: String(user.name || ''),

    email: String(user.email || ''),

    role: String(user.role || 'user'),

    active,

    subscription: active ? ((user.subscription as UserModel['subscription']) ?? null) : null,

    profile: (user.profile as UserModel['profile']) || {},

    passwordHash: user.passwordHash ? String(user.passwordHash) : undefined,

    permissions: {

      ...DEFAULT_PERMISSIONS,

      ...perms,

      allowedPages: Array.isArray(perms.allowedPages) ? perms.allowedPages : DEFAULT_PERMISSIONS.allowedPages,

      pagePermissions: perms.pagePermissions || {},

      fieldPermissions: perms.fieldPermissions || {},

      dataAccessScope: perms.dataAccessScope || { mode: 'own', sharedUserIds: [] },

      canUseSubscription: active ? Boolean(perms.canUseSubscription) : false,

    },

    createdAt: Number(user.createdAt || Date.now()),

    updatedAt: Number(user.updatedAt || Date.now()),

  };

}



async function ensureDataDir() {

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

}



async function readAllRaw(): Promise<UserAuthRecord[]> {

  const db = getFirestore();

  if (isFirebaseConfigured() && db) {

    const snap = await db.collection('users').get();

    return snap.docs.map((d) => normalizeUser({ id: d.id, ...d.data() }));

  }



  try {

    const txt = await fs.readFile(DATA_FILE, 'utf-8');

    const raw = JSON.parse(txt || '[]') as Record<string, unknown>[];

    return raw.map(normalizeUser);

  } catch {

    return [];

  }

}



export async function getUsers(): Promise<UserModel[]> {

  const users = await readAllRaw();

  return users.map((u) => stripSensitiveFields(u as unknown as Record<string, unknown>));

}



export async function getUserById(id: string): Promise<UserModel | null> {

  const users = await readAllRaw();

  const found = users.find((u) => u.id === id);

  return found ? stripSensitiveFields(found as unknown as Record<string, unknown>) : null;

}



export async function getUserByEmail(email: string): Promise<UserAuthRecord | null> {

  const users = await readAllRaw();

  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  return found || null;

}



export async function saveUser(user: Record<string, unknown>) {

  if (!user.id) user.id = Math.random().toString(36).substr(2, 9);

  user.updatedAt = Date.now();

  if (!user.createdAt) user.createdAt = Date.now();



  const existingRaw = user.id ? (await readAllRaw()).find((u) => u.id === user.id) : null;

  if (existingRaw?.passwordHash && !user.passwordHash) {

    user.passwordHash = existingRaw.passwordHash;

  }



  const normalized = normalizeUser(user);



  if (normalized.active === false) {

    normalized.subscription = null;

    normalized.permissions = {

      ...normalized.permissions,

      canUseSubscription: false,

    };

  }



  const db = getFirestore();

  if (isFirebaseConfigured() && db) {

    await db.collection('users').doc(normalized.id).set(normalized, { merge: true });

    return stripSensitiveFields(normalized as unknown as Record<string, unknown>);

  }



  await ensureDataDir();

  const existing = await readAllRaw();

  const idx = existing.findIndex((u) => u.id === normalized.id);

  if (idx !== -1) existing[idx] = normalized;

  else existing.push(normalized);

  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2), 'utf-8');

  return stripSensitiveFields(normalized as unknown as Record<string, unknown>);

}



export async function deleteUser(id: string) {

  const db = getFirestore();

  if (isFirebaseConfigured() && db) {

    await db.collection('users').doc(id).delete();

    return;

  }



  const existing = await readAllRaw();

  const filtered = existing.filter((u) => u.id !== id);

  await ensureDataDir();

  await fs.writeFile(DATA_FILE, JSON.stringify(filtered, null, 2), 'utf-8');

}



export async function getAllPages() {

  const catalog = await getPermissionCatalog();

  return catalog.pages.map((p) => p.key);

}


