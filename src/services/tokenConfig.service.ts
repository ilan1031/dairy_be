import { getDocData, setDocData } from './store';
import type { TokenConfig } from '../types/models';

export const DEFAULT_TOKEN_CONFIG: TokenConfig = {
  sessionExpirySeconds: 8 * 3600,       // 8 hours
  loginExpirySeconds: 24 * 3600,        // 24 hours
  subscriptionExpirySeconds: 30 * 24 * 3600, // 30 days
  allowRegistration: true,
  allowLogin: true,
  signupDefaults: {
    permissions: {
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: false,
      allowedPages: ['Dashboard', 'Sales', 'Bills', 'Profiles', 'Settings'],
      canUseSubscription: false,
      canViewOthers: false,
      pagePermissions: {
        Dashboard: ['view'],
        Sales: ['view', 'create', 'edit'],
        Bills: ['view', 'edit'],
        Profiles: ['view', 'create', 'edit'],
        Settings: ['view', 'edit'],
      },
      fieldPermissions: {},
      dataAccessScope: { mode: 'own', sharedUserIds: [] },
    },
    subscription: {
      enabled: false,
      plan: 'premium',
      expiresInDays: 30,
      paymentMessage: 'Your signup subscription has expired. Contact admin to renew.',
    },
  },
  updatedAt: Date.now(),
};

export async function getTokenConfig(): Promise<TokenConfig> {
  return getDocData<TokenConfig>(
    'system_config',
    'token_config',
    'token_config.json',
    DEFAULT_TOKEN_CONFIG
  );
}

export async function saveTokenConfig(config: Partial<TokenConfig>): Promise<TokenConfig> {
  const existing = await getTokenConfig();
  const updated: TokenConfig = {
    ...existing,
    ...config,
    updatedAt: Date.now(),
  };
  await setDocData('system_config', 'token_config', 'token_config.json', updated);
  return updated;
}
