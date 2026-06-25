import { Request, Response } from 'express';
import * as ipLimitService from '../services/ipLimit.service';

export async function getIpLimit(req: Request, res: Response) {
  try {
    const { ipAddress } = req.body || {};
    const limit = await ipLimitService.getIpCreationLimit(ipAddress);
    const usage = await ipLimitService.getIpCreationUsage(ipAddress);
    return res.json({ success: true, data: { ipAddress, limit, usage } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get IP limit';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function updateIpLimit(req: Request, res: Response) {
  try {
    const { ipAddress, limit } = req.body || {};
    if (!ipAddress) {
      return res.status(400).json({ success: false, error: 'ipAddress required' });
    }
    const updated = await ipLimitService.updateIpCreationLimit(ipAddress, Number(limit));
    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update IP limit';
    return res.status(500).json({ success: false, error: message });
  }
}
