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
import { SEED_BILLING_CONFIG } from '../data/seedData';
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

async function getProfileData(): Promise<Profile | null> {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const snap = await db.collection('profiles').limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as Profile;
    return null;
  }
  return getDocData<Profile | null>('profiles', 'default', 'profile.json', null);
}

export async function bootstrap(
  sessionUser?: UserModel | null,
  opts?: { isSuperAdmin?: boolean }
): Promise<BootstrapData> {
  const profile = await getProfileData();
  const isSuperAdmin = Boolean(opts?.isSuperAdmin);

  const [customers, sales, priceConfigs, priceLogs, inventory, users, auditLogs, permissionCatalog] =
    await Promise.all([
      getCollection<Customer>('customers', 'customers.json', []),
      getCollection<Sale>('sales', 'sales.json', []),
      getCollection<PriceConfig>('price_configs', 'prices.json', []),
      getCollection<PriceLog>('price_logs', 'price_logs.json', []),
      getCollection<MilkInventory>('milk_inventory', 'inventory.json', []),
      getCollection<UserModel>('users', 'users.json', []),
      getCollection<AuditLogEntry>('audit_logs', 'audit_logs.json', []),
      getPermissionCatalog(),
    ]);

  const billingConfig = await getDocData<BillingConfig>(
    'system_config',
    'billing',
    'billing.json',
    SEED_BILLING_CONFIG
  );

  const scopedCustomers = filterByDataScope(customers, sessionUser || null, isSuperAdmin, 'customers');
  const scopedSales = filterByDataScope(sales, sessionUser || null, isSuperAdmin, 'sales');
  const scopedInventory = filterByDataScope(inventory, sessionUser || null, isSuperAdmin, 'inventory');

  const safeUsers = users.map((u) => stripSensitiveFields(u as unknown as Record<string, unknown>));

  return {
    profile: profile || null,
    customers: scopedCustomers.sort((a, b) => a.name.localeCompare(b.name)),
    sales: scopedSales.sort((a, b) => b.createdAt - a.createdAt),
    priceConfigs,
    priceLogs: priceLogs.sort((a, b) => b.timestamp - a.timestamp),
    inventory: scopedInventory,
    users: safeUsers,
    billingConfig,
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

export async function savePriceConfig(milkType: string, newPrice: number) {
  const configs = await getCollection<PriceConfig>('price_configs', 'prices.json', []);
  const idx = configs.findIndex((p) => p.milkType === milkType);
  const oldPrice = idx !== -1 ? configs[idx].currentPrice : 40;
  const updatedPrice: PriceConfig = { milkType, currentPrice: newPrice, updatedAt: Date.now() };
  await setCollectionItem('price_configs', 'prices.json', milkType, updatedPrice as unknown as Record<string, unknown>);

  const log: PriceLog = {
    id: `plog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    milkType,
    oldPrice,
    newPrice,
    timestamp: Date.now(),
  };
  await setCollectionItem('price_logs', 'price_logs.json', log.id, log as unknown as Record<string, unknown>);
  return { updatedPrice, log };
}

export async function saveMilkInventory(inventory: MilkInventory) {
  await setCollectionItem('milk_inventory', 'inventory.json', inventory.dateStr, inventory as unknown as Record<string, unknown>);
  return inventory;
}

export async function saveBillingConfig(config: BillingConfig) {
  await setDocData('system_config', 'billing', 'billing.json', config);
  return config;
}

export async function appendAuditLog(entry: AuditLogEntry) {
  await setCollectionItem('audit_logs', 'audit_logs.json', entry.id, entry as unknown as Record<string, unknown>);
  return entry;
}

export async function getAuditLogs(options?: { page?: number; limit?: number; search?: string; resourceType?: string }) {
  let logs = await getCollection<AuditLogEntry>('audit_logs', 'audit_logs.json', []);
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
