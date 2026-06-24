import { getDocData, setDocData } from './store';
import { DEFAULT_PERMISSION_CATALOG } from '../constants/permissionCatalog';
import type { PermissionCatalog } from '../types/models';

export async function getPermissionCatalog(): Promise<PermissionCatalog> {
  const stored = await getDocData<PermissionCatalog | null>(
    'system_config',
    'permission_catalog',
    'permission_catalog.json',
    null
  );
  if (stored?.pages?.length) {
    return {
      ...DEFAULT_PERMISSION_CATALOG,
      ...stored,
      fields: { ...DEFAULT_PERMISSION_CATALOG.fields, ...(stored.fields || {}) },
    };
  }
  return { ...DEFAULT_PERMISSION_CATALOG };
}

export async function savePermissionCatalog(catalog: PermissionCatalog): Promise<PermissionCatalog> {
  const payload = { ...catalog, updatedAt: Date.now() };
  await setDocData('system_config', 'permission_catalog', 'permission_catalog.json', payload);
  return payload;
}

export function getPageKeys(catalog: PermissionCatalog): string[] {
  return catalog.pages.map((p) => p.key);
}
