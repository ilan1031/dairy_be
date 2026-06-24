import {
  markSeeded,
  isSeeded,
  setDocData,
  setCollectionItem,
} from './store';
import { SEED_PROFILE, SEED_PRICE_CONFIGS, SEED_ADMIN_USER, SEED_BILLING_CONFIG } from '../data/seedData';
import { DEFAULT_PERMISSION_CATALOG } from '../constants/permissionCatalog';
import { decodeAdminEmail } from '../utils/session';

export async function seedIfEmpty(): Promise<boolean> {
  if (await isSeeded()) return false;

  const adminEmail = decodeAdminEmail() || SEED_PROFILE.emailAddress;
  const profile = { ...SEED_PROFILE, emailAddress: adminEmail };
  const adminUser = { ...SEED_ADMIN_USER, email: adminEmail, name: 'Super Admin' };

  await setDocData('profiles', adminEmail, 'profile.json', profile);
  await setCollectionItem('users', 'users.json', adminUser.id, adminUser as unknown as Record<string, unknown>);
  await setDocData('system_config', 'billing', 'billing.json', SEED_BILLING_CONFIG);
  await setDocData('system_config', 'permission_catalog', 'permission_catalog.json', DEFAULT_PERMISSION_CATALOG);

  for (const price of SEED_PRICE_CONFIGS) {
    await setCollectionItem('price_configs', 'prices.json', price.milkType, price as unknown as Record<string, unknown>);
  }

  await markSeeded();
  console.log('[Seed] Firestore/DB seeded with initial dairy data.');
  return true;
}
