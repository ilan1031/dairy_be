import type {
  BootstrapData,
  Profile,
  Customer,
  Sale,
  PriceConfig,
  PriceLog,
  MilkInventory,
  UserModel,
  BillingConfig,
  BrandingConfig,
  AuditLogEntry,
} from '../types/models';
import {
  getCollection,
  getDocData,
  setDocData,
  setCollectionItem,
  deleteCollectionItem,
} from './store';
import { getFirestore, isFirebaseConfigured } from '../config/firebase';
import { SEED_BILLING_CONFIG, SEED_PRICE_CONFIGS, SEED_BRANDING_CONFIG } from '../data/seedData';
import { filterByDataScope, stripSensitiveFields } from '../middleware/rbac';
import { getPermissionCatalog } from './permissionCatalog.service';

const EMPTY_PROFILE: Profile = {
  businessName: '',
  ownerName: '',
  mobileNumber: '',
  emailAddress: '',
  signupTimestamp: 0,
  isLightTheme: true,
  language: 'en',
};

async function getProfileData(email?: string | null): Promise<Profile | null> {
  if (!email) return null;
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const doc = await db.collection('profiles').doc(email).get();
    if (doc.exists) return doc.data() as Profile;
    return {
      ...EMPTY_PROFILE,
      emailAddress: email,
    };
  }
  const profile = await getDocData<Profile | null>('profiles', email, 'profile.json', null);
  if (profile) return profile;
  return {
    ...EMPTY_PROFILE,
    emailAddress: email,
  };
}

export function getAllowedUserIds(
  user: UserModel | null | undefined,
  isSuperAdmin?: boolean,
  resource?: 'sales' | 'inventory' | 'customers'
): string[] | null {
  if (!user || isSuperAdmin || user.role === 'superadmin') return null;

  const scope = user.permissions?.dataAccessScope || { mode: 'own', sharedUserIds: [] };
  if (scope.mode === 'all') return null;

  const rights = { sales: true, inventory: true, customers: true, ...(scope.sharedRights || {}) };
  const includeShared = scope.mode === 'shared' && (!resource || rights[resource]);

  if (scope.mode === 'own' || !includeShared) {
    return [user.id];
  }

  const ids = [user.id];
  if (scope.sharedUserIds) {
    scope.sharedUserIds.forEach((id) => {
      if (id !== user.id) ids.push(id);
    });
  }
  return ids;
}

export async function bootstrap(
  sessionUser?: UserModel | null,
  opts?: { isSuperAdmin?: boolean }
): Promise<BootstrapData> {
  const profile = await getProfileData(sessionUser?.email);
  const isSuperAdmin = Boolean(opts?.isSuperAdmin);

  const allowedCustomerIds = getAllowedUserIds(sessionUser, isSuperAdmin, 'customers');
  const allowedSaleIds = getAllowedUserIds(sessionUser, isSuperAdmin, 'sales');
  const allowedInventoryIds = getAllowedUserIds(sessionUser, isSuperAdmin, 'inventory');
  const allowedPriceIds = getAllowedUserIds(sessionUser, isSuperAdmin);
  const allowedAuditIds = getAllowedUserIds(sessionUser, isSuperAdmin);

  const [customers, sales, priceConfigs, priceLogs, inventory, users, auditLogs, permissionCatalog] =
    await Promise.all([
      getCollection<Customer>('customers', 'customers.json', [], allowedCustomerIds),
      getCollection<Sale>('sales', 'sales.json', [], allowedSaleIds),
      getCollection<PriceConfig>('price_configs', 'prices.json', [], allowedPriceIds),
      getCollection<PriceLog>('price_logs', 'price_logs.json', [], allowedPriceIds),
      getCollection<MilkInventory>('milk_inventory', 'inventory.json', [], allowedInventoryIds),
      getCollection<UserModel>('users', 'users.json', []),
      getCollection<AuditLogEntry>('audit_logs', 'audit_logs.json', [], allowedAuditIds),
      getPermissionCatalog(),
    ]);

  const billingDocId = sessionUser && !isSuperAdmin ? `billing_${sessionUser.id}` : 'billing';
  let billingConfig = await getDocData<BillingConfig>(
    'system_config',
    billingDocId,
    billingDocId + '.json',
    SEED_BILLING_CONFIG
  );

  if (sessionUser && !isSuperAdmin && billingDocId !== 'billing') {
    await setDocData('system_config', billingDocId, billingDocId + '.json', { ...billingConfig, ownerUserId: sessionUser.id });
    billingConfig = { ...billingConfig, ownerUserId: sessionUser.id };
  }

  const brandingDocId = sessionUser && !isSuperAdmin ? `branding_${sessionUser.id}` : 'branding';
  let brandingConfig = await getDocData<BrandingConfig>(
    'system_config',
    brandingDocId,
    brandingDocId + '.json',
    SEED_BRANDING_CONFIG
  );

  if (sessionUser && !isSuperAdmin && brandingDocId !== 'branding') {
    await setDocData('system_config', brandingDocId, brandingDocId + '.json', { ...brandingConfig, ownerUserId: sessionUser.id });
    brandingConfig = { ...brandingConfig, ownerUserId: sessionUser.id };
  }

  const scopedCustomers = filterByDataScope(customers, sessionUser || null, isSuperAdmin, 'customers');
  const scopedSales = filterByDataScope(sales, sessionUser || null, isSuperAdmin, 'sales');
  const scopedInventory = filterByDataScope(inventory, sessionUser || null, isSuperAdmin, 'inventory');

  let scopedPriceConfigs = filterByDataScope(priceConfigs, sessionUser || null, isSuperAdmin);
  const scopedPriceLogs = filterByDataScope(priceLogs, sessionUser || null, isSuperAdmin);

  if (sessionUser && !isSuperAdmin && scopedPriceConfigs.length === 0) {
    const now = Date.now();
    scopedPriceConfigs = SEED_PRICE_CONFIGS.map((pc) => ({
      ...pc,
      ownerUserId: sessionUser.id,
      updatedAt: now,
    }));
    for (const pc of scopedPriceConfigs) {
      await setCollectionItem(
        'price_configs',
        'prices.json',
        `${pc.milkType}_${sessionUser.id}`,
        pc as unknown as Record<string, unknown>
      );
    }
  }

  // Deduplicate and filter price configs to prevent duplicate keys in UI
  let finalPriceConfigs = scopedPriceConfigs;
  if (isSuperAdmin && !sessionUser) {
    finalPriceConfigs = scopedPriceConfigs.filter((p) => !p.ownerUserId || p.ownerUserId === 'system');
  } else {
    const userOwnedConfigs = scopedPriceConfigs.filter((p) => !!p.ownerUserId);
    const userOwnedMilkTypes = new Set(userOwnedConfigs.map((p) => p.milkType));
    if (userOwnedConfigs.length > 0) {
      finalPriceConfigs = scopedPriceConfigs.filter(
        (p) => !!p.ownerUserId || !userOwnedMilkTypes.has(p.milkType)
      );
    }
  }

  const safeUsers = users.map((u) => stripSensitiveFields(u as unknown as Record<string, unknown>));

  return {
    profile: profile || null,
    customers: scopedCustomers.sort((a, b) => a.name.localeCompare(b.name)),
    sales: scopedSales.sort((a, b) => b.createdAt - a.createdAt),
    priceConfigs: finalPriceConfigs,
    priceLogs: scopedPriceLogs.sort((a, b) => b.timestamp - a.timestamp),
    inventory: scopedInventory,
    users: safeUsers,
    billingConfig,
    brandingConfig,
    auditLogs: auditLogs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    permissionCatalog,
    sessionUser: sessionUser || null,
    isSuperAdmin,
  };
}

export async function saveProfile(profile: Partial<Profile> & { emailAddress: string }) {
  const existing = await getDocData<Profile>(
    'profiles',
    profile.emailAddress,
    'profile.json',
    EMPTY_PROFILE
  );
  const updated = { ...existing, ...profile };
  await setDocData('profiles', profile.emailAddress, 'profile.json', updated);
  return updated;
}

export async function saveCustomer(customer: Customer) {
  await setCollectionItem('customers', 'customers.json', customer.id, customer as unknown as Record<string, unknown>);
  return customer;
}

export async function deleteCustomer(id: string) {
  await deleteCollectionItem('customers', 'customers.json', id);
}

export async function saveSale(sale: Sale) {
  await setCollectionItem('sales', 'sales.json', sale.id, sale as unknown as Record<string, unknown>);
  return sale;
}

export async function deleteSale(id: string) {
  await deleteCollectionItem('sales', 'sales.json', id);
}

export async function markSalePaid(id: string, paymentType: string) {
  const sales = await getCollection<Sale>('sales', 'sales.json', []);
  const sale = sales.find((s) => s.id === id);
  if (!sale) return null;
  const updated = { ...sale, paymentStatus: 'PAID', paymentType, updatedAt: Date.now() };
  await setCollectionItem('sales', 'sales.json', id, updated as unknown as Record<string, unknown>);
  return updated;
}

export async function savePriceConfig(milkType: string, newPrice: number, ownerUserId?: string) {
  const configs = await getCollection<PriceConfig>('price_configs', 'prices.json', []);
  const idx = configs.findIndex((p) => p.milkType === milkType && (!ownerUserId || p.ownerUserId === ownerUserId));
  const oldPrice = idx !== -1 ? configs[idx].currentPrice : 40;
  const updatedPrice: PriceConfig = { milkType, currentPrice: newPrice, ownerUserId, updatedAt: Date.now() };
  const docId = ownerUserId ? `${milkType}_${ownerUserId}` : milkType;
  await setCollectionItem('price_configs', 'prices.json', docId, updatedPrice as unknown as Record<string, unknown>);

  const log: PriceLog = {
    id: `plog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    milkType,
    oldPrice,
    newPrice,
    ownerUserId,
    timestamp: Date.now(),
  };
  await setCollectionItem('price_logs', 'price_logs.json', log.id, log as unknown as Record<string, unknown>);
  return { updatedPrice, log };
}

export async function deletePriceConfig(milkType: string, ownerUserId?: string) {
  const docId = ownerUserId ? `${milkType}_${ownerUserId}` : milkType;
  await deleteCollectionItem('price_configs', 'prices.json', docId);
}

export async function renamePriceConfig(oldMilkType: string, newMilkType: string, ownerUserId?: string) {
  const docIdOld = ownerUserId ? `${oldMilkType}_${ownerUserId}` : oldMilkType;
  const docIdNew = ownerUserId ? `${newMilkType}_${ownerUserId}` : newMilkType;

  const configs = await getCollection<PriceConfig>('price_configs', 'prices.json', []);
  const matched = configs.find((p) => p.milkType === oldMilkType && (!ownerUserId || p.ownerUserId === ownerUserId));
  const currentPrice = matched ? matched.currentPrice : 40;

  await deleteCollectionItem('price_configs', 'prices.json', docIdOld);

  const updatedPrice: PriceConfig = { milkType: newMilkType, currentPrice, ownerUserId, updatedAt: Date.now() };
  await setCollectionItem('price_configs', 'prices.json', docIdNew, updatedPrice as unknown as Record<string, unknown>);
  return updatedPrice;
}

export async function saveMilkInventory(inventory: MilkInventory) {
  const docId = inventory.ownerUserId ? `${inventory.dateStr}_${inventory.ownerUserId}` : inventory.dateStr;
  await setCollectionItem('milk_inventory', 'inventory.json', docId, inventory as unknown as Record<string, unknown>);
  return inventory;
}

export async function saveBillingConfig(config: BillingConfig, ownerUserId?: string) {
  const docId = ownerUserId ? `billing_${ownerUserId}` : 'billing';
  const updated = { ...config, ownerUserId };
  await setDocData('system_config', docId, docId + '.json', updated);
  return updated;
}

export async function saveBrandingConfig(config: BrandingConfig, ownerUserId?: string) {
  const docId = ownerUserId ? `branding_${ownerUserId}` : 'branding';
  const updated = { ...config, ownerUserId, updatedAt: Date.now() };
  await setDocData('system_config', docId, docId + '.json', updated);
  return updated;
}

export async function appendAuditLog(entry: AuditLogEntry) {
  await setCollectionItem('audit_logs', 'audit_logs.json', entry.id, entry as unknown as Record<string, unknown>);
  return entry;
}

export async function getAuditLogs(options?: { page?: number; limit?: number; search?: string; resourceType?: string; allowedUserIds?: string[] | null }) {
  let logs = await getCollection<AuditLogEntry>('audit_logs', 'audit_logs.json', [], options?.allowedUserIds);
  logs.sort((a, b) => b.createdAt - a.createdAt);

  if (options?.resourceType) {
    logs = logs.filter((l) => l.resourceType === options.resourceType);
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resourceType.toLowerCase().includes(q) ||
        (l.resourceId || '').toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        (l.userEmail || '').toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
    );
  }

  const page = options?.page || 1;
  const limit = options?.limit || 30;
  const total = logs.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return { logs: logs.slice(start, start + limit), total, page, pages };
}

export async function importAll(payload: Partial<BootstrapData>): Promise<BootstrapData> {
  if (payload.profile?.emailAddress) {
    await saveProfile(payload.profile);
  }
  if (payload.billingConfig) {
    await saveBillingConfig(payload.billingConfig);
  }
  for (const customer of payload.customers || []) {
    await saveCustomer(customer);
  }
  for (const sale of payload.sales || []) {
    await saveSale(sale);
  }
  for (const price of payload.priceConfigs || []) {
    await setCollectionItem('price_configs', 'prices.json', price.milkType, price as unknown as Record<string, unknown>);
  }
  for (const log of payload.priceLogs || []) {
    await setCollectionItem('price_logs', 'price_logs.json', log.id, log as unknown as Record<string, unknown>);
  }
  for (const inv of payload.inventory || []) {
    await saveMilkInventory(inv);
  }
  for (const user of payload.users || []) {
    await setCollectionItem('users', 'users.json', user.id, user as unknown as Record<string, unknown>);
  }
  for (const entry of payload.auditLogs || []) {
    await appendAuditLog(entry);
  }
  return bootstrap();
}
