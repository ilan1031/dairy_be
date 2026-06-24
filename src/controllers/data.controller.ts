import { Request, Response } from 'express';
import * as dataService from '../services/data.service';
import { seedIfEmpty } from '../services/seed.service';
import type { AuthRequest } from '../middleware/auth';
import {
  checkCustomerLimit,
  checkSaleLimit,
  checkInventoryLimit,
  checkMilkTypeAllowed,
} from '../utils/limits';
import { getSubscriptionStatus } from '../utils/subscription';

export async function bootstrap(req: Request, res: Response) {
  try {
    await seedIfEmpty();
    const auth = (req as AuthRequest).auth;
    const data = await dataService.bootstrap(auth?.user || null, {
      isSuperAdmin: auth?.isSuperAdmin,
    });
    const subscriptionStatus = getSubscriptionStatus(auth?.user || null, auth?.isSuperAdmin);
    return res.json({ success: true, data: { ...data, subscriptionStatus } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Bootstrap failed';
    return res.status(500).json({ success: false, error: message });
  }
}

function ownerId(req: Request): string | undefined {
  const auth = (req as AuthRequest).auth;
  if (auth?.isSuperAdmin) return auth.userId;
  return auth?.userId;
}

export async function saveProfile(req: Request, res: Response) {
  try {
    if (!req.body?.emailAddress) {
      return res.status(400).json({ success: false, error: 'emailAddress required' });
    }
    const saved = await dataService.saveProfile(req.body);
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save profile';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function saveCustomer(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    if (auth?.user) {
      const limitErr = await checkCustomerLimit(auth.user, auth.isSuperAdmin, req.body?.id);
      if (limitErr) return res.status(403).json({ success: false, error: limitErr });
    }
    const saved = await dataService.saveCustomer({
      ...req.body,
      ownerUserId: req.body.ownerUserId || ownerId(req),
    });
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save customer';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function deleteCustomer(req: Request, res: Response) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'id required' });
    await dataService.deleteCustomer(id);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete customer';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function saveSale(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    if (auth?.user) {
      const limitErr = await checkSaleLimit(auth.user, auth.isSuperAdmin, req.body?.id);
      if (limitErr) return res.status(403).json({ success: false, error: limitErr });
      const milkErr = checkMilkTypeAllowed(req.body?.milkType, auth.user, auth.isSuperAdmin);
      if (milkErr) return res.status(403).json({ success: false, error: milkErr });
    }
    const saved = await dataService.saveSale({
      ...req.body,
      ownerUserId: req.body.ownerUserId || ownerId(req),
    });
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save sale';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function deleteSale(req: Request, res: Response) {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'id required' });
    await dataService.deleteSale(id);
    return res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete sale';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function markSalePaid(req: Request, res: Response) {
  try {
    const { id, paymentType } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'id required' });
    const updated = await dataService.markSalePaid(id, paymentType || 'CASH');
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark sale paid';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function savePrice(req: Request, res: Response) {
  try {
    const { milkType, newPrice } = req.body;
    if (!milkType || newPrice === undefined) {
      return res.status(400).json({ success: false, error: 'milkType and newPrice required' });
    }
    const result = await dataService.savePriceConfig(milkType, Number(newPrice));
    return res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save price';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function saveInventory(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    if (auth?.user) {
      const limitErr = await checkInventoryLimit(auth.user, auth.isSuperAdmin, req.body?.dateStr);
      if (limitErr) return res.status(403).json({ success: false, error: limitErr });
    }
    const saved = await dataService.saveMilkInventory({
      ...req.body,
      ownerUserId: req.body.ownerUserId || ownerId(req),
    });
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save inventory';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function saveBilling(req: Request, res: Response) {
  try {
    const saved = await dataService.saveBillingConfig(req.body);
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save billing config';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function logAudit(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    const entry = {
      ...req.body,
      userId: req.body.userId || auth?.userId || 'session',
      userEmail: req.body.userEmail || auth?.email,
    };
    const saved = await dataService.appendAuditLog(entry);
    return res.json({ success: true, data: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to log audit';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function listAudit(req: Request, res: Response) {
  try {
    const result = await dataService.getAuditLogs(req.body || {});
    return res.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list audit logs';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function importData(req: Request, res: Response) {
  try {
    const auth = (req as AuthRequest).auth;
    if (!auth?.isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Only super admin can import data' });
    }
    const data = await dataService.importAll(req.body);
    return res.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return res.status(500).json({ success: false, error: message });
  }
}
