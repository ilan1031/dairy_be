import { getDocData, setDocData } from './store';
import type { TokenConfig } from '../types/models';

export const DEFAULT_TOKEN_CONFIG: TokenConfig = {
  sessionExpirySeconds: 8 * 3600,       // 8 hours
  loginExpirySeconds: 24 * 3600,        // 24 hours
  subscriptionExpirySeconds: 30 * 24 * 3600, // 30 days
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
