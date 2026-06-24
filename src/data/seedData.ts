import type { Profile, PriceConfig, UserModel, BillingConfig, BrandingConfig } from '../types/models';

const now = Date.now();

export const SEED_PROFILE: Profile = {
  businessName: 'Ganga Premium Dairy',
  ownerName: 'Arun Kumar',
  mobileNumber: '9876543210',
  emailAddress: 'arun@gangadairy.com',
  signupTimestamp: now,
  isLightTheme: true,
  language: 'en',
};

export const SEED_PRICE_CONFIGS: PriceConfig[] = [
  { milkType: 'Cow Milk', currentPrice: 42.0, updatedAt: now },
  { milkType: 'Buffalo Milk', currentPrice: 58.0, updatedAt: now },
  { milkType: 'A2 Milk', currentPrice: 75.0, updatedAt: now },
];

export const SEED_ADMIN_USER: UserModel = {
  id: 'builtin-admin',
  name: 'Built-in Admin',
  email: SEED_PROFILE.emailAddress,
  role: 'superadmin',
  active: true,
  subscription: { plan: 'lifetime' },
  profile: { displayName: 'Super Admin' },
  permissions: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    allowedPages: ['*'],
    canUseSubscription: true,
    canViewOthers: true,
    pagePermissions: {},
    fieldPermissions: {},
    dataAccessScope: { mode: 'all', sharedUserIds: [] },
  },
  createdAt: now,
  updatedAt: now,
};

export const SEED_BILLING_CONFIG: BillingConfig = {
  paymentMethods: [
    { code: 'CASH', label: 'CASH', color: 'var(--organic-green)', icon: 'dollar', enabled: true },
    { code: 'UPI', label: 'UPI', color: 'var(--primary-gold)', icon: 'credit-card', enabled: true },
    { code: 'BANK', label: 'BANK', color: 'var(--primary-milk)', icon: 'building', enabled: true },
    { code: 'PENDING', label: 'PENDING', color: 'var(--alert-red)', icon: 'clock', enabled: true, marksPending: true },
  ],
  volumePresets: [0.25, 0.5, 1.0, 2.0, 5.0, 10.0],
  allowCustomRate: true,
  requireLocation: true,
  defaultLocation: 'Simulated Location (GPS Locked)',
  showStockWarnings: true,
  maxVolume: 200,
  volumeStep: 0.25,
  updatedAt: now,
};

export const SEED_BRANDING_CONFIG: BrandingConfig = {
  bankName: 'Ganga Premium Dairy',
  systemName: 'Dairy ERP',
  logo: '/abielan_app_logo.png',
  address: '123 Dairy Farm Lane, Cooperative Hub',
  updatedAt: now,
};
