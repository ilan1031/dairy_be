import { Request, Response } from 'express';
import * as catalogService from '../services/permissionCatalog.service';
import type { PermissionCatalog } from '../types/models';

export async function getCatalog(_req: Request, res: Response) {
  try {
    const catalog = await catalogService.getPermissionCatalog();
    return res.json({ success: true, data: catalog });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load catalog';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function updateCatalog(req: Request, res: Response) {
  try {
    const catalog = req.body as PermissionCatalog;
    if (!catalog?.pages?.length) {
      return res.status(400).json({ success: false, error: 'pages array required' });
    }
    const saved = await catalogService.savePermissionCatalog(catalog);
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update catalog';
    return res.status(500).json({ success: false, error: message });
  }
}
