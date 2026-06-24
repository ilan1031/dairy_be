import { Request, Response } from 'express';
import * as tokenConfigService from '../services/tokenConfig.service';

export async function getTokenConfig(req: Request, res: Response) {
  try {
    const config = await tokenConfigService.getTokenConfig();
    return res.json({ success: true, data: config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch token config';
    return res.status(500).json({ success: false, error: message });
  }
}

export async function updateTokenConfig(req: Request, res: Response) {
  try {
    const config = await tokenConfigService.saveTokenConfig(req.body);
    return res.json({ success: true, data: config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save token config';
    return res.status(500).json({ success: false, error: message });
  }
}
