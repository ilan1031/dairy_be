import type { ResourceLimits, UserModel } from '../types/models';
import { getCollection } from '../services/store';

export async function countUserOwned(
  collection: string,
  jsonFile: string,
  userId: string,
  ownerField = 'ownerUserId'
): Promise<number> {
  const items = await getCollection<Record<string, unknown>>(collection, jsonFile, []);
  return items.filter((i) => String(i[ownerField] || '') === userId).length;
}

async function ownedRecordExists(
  collection: string,
  jsonFile: string,
  userId: string,
  matchField: string,
  matchValue: string,
  ownerField = 'ownerUserId'
): Promise<boolean> {
  if (!matchValue) return false;
  const items = await getCollection<Record<string, unknown>>(collection, jsonFile, []);
  return items.some(
    (i) => String(i[ownerField] || '') === userId && String(i[matchField] || '') === matchValue
  );
}

export function getLimits(user: UserModel | null | undefined): ResourceLimits {
  return user?.permissions?.resourceLimits || {};
}

export async function checkCustomerLimit(
  user: UserModel,
  isSuperAdmin?: boolean,
  existingId?: string
): Promise<string | null> {
  if (isSuperAdmin || user.role === 'superadmin') return null;
  if (existingId && (await ownedRecordExists('customers', 'customers.json', user.id, 'id', existingId))) {
    return null;
  }
  const max = getLimits(user).maxCustomers;
  if (max == null || max < 0) return null;
  const count = await countUserOwned('customers', 'customers.json', user.id);
  if (count >= max) return `Customer limit reached (${max}). Contact admin to increase quota.`;
  return null;
}

export async function checkSaleLimit(
  user: UserModel,
  isSuperAdmin?: boolean,
  existingId?: string
): Promise<string | null> {
  if (isSuperAdmin || user.role === 'superadmin') return null;
  if (existingId && (await ownedRecordExists('sales', 'sales.json', user.id, 'id', existingId))) {
    return null;
  }
  const max = getLimits(user).maxSales;
  if (max == null || max < 0) return null;
  const count = await countUserOwned('sales', 'sales.json', user.id);
  if (count >= max) return `Sales record limit reached (${max}). Contact admin to increase quota.`;
  return null;
}

export async function checkInventoryLimit(
  user: UserModel,
  isSuperAdmin?: boolean,
  existingDateStr?: string
): Promise<string | null> {
  if (isSuperAdmin || user.role === 'superadmin') return null;
  if (
    existingDateStr &&
    (await ownedRecordExists('milk_inventory', 'inventory.json', user.id, 'dateStr', existingDateStr))
  ) {
    return null;
  }
  const max = getLimits(user).maxInventory;
  if (max == null || max < 0) return null;
  const count = await countUserOwned('milk_inventory', 'inventory.json', user.id);
  if (count >= max) return `Inventory entry limit reached (${max}). Contact admin to increase quota.`;
  return null;
}

export function checkMilkTypeAllowed(
  milkType: string,
  user: UserModel | null | undefined,
  isSuperAdmin?: boolean
): string | null {
  if (isSuperAdmin || !user || user.role === 'superadmin') return null;
  const allowed = getLimits(user).allowedMilkTypes;
  if (!allowed?.length) return null;
  if (!allowed.includes(milkType)) {
    return `Milk type "${milkType}" is not allowed for your account.`;
  }
  return null;
}
