import { Request, Response } from 'express';

import * as usersService from '../services/users.service';

import { hashPassword } from '../utils/password';



export async function listUsers(_req: Request, res: Response) {

  try {

    const users = await usersService.getUsers();

    return res.json({ success: true, data: users });

  } catch (err: unknown) {

    const message = err instanceof Error ? err.message : 'Failed to list users';

    return res.status(500).json({ success: false, error: message });

  }

}



export async function createUser(req: Request, res: Response) {

  try {

    const body = req.body;

    if (!body.email || !body.name) {

      return res.status(400).json({ success: false, error: 'name and email required' });

    }

    if (!body.password || String(body.password).length < 6) {

      return res.status(400).json({ success: false, error: 'password required (min 6 characters)' });

    }



    const existing = await usersService.getUserByEmail(body.email);

    if (existing) {

      return res.status(409).json({ success: false, error: 'Email already registered' });

    }



    const now = Date.now();

    const user = {

      id: body.id || undefined,

      name: body.name,

      email: body.email,

      role: body.role || 'user',

      active: body.active !== false,

      profile: body.profile || { displayName: body.name },

      passwordHash: hashPassword(String(body.password)),

      subscription: body.active === false ? null : (body.subscription || null),

      permissions: body.permissions || {

        canCreate: false,

        canRead: true,

        canUpdate: false,

        canDelete: false,

        allowedPages: ['Dashboard'],

        canUseSubscription: false,

        canViewOthers: false,

        pagePermissions: { Dashboard: ['view'] },

        fieldPermissions: {},

        dataAccessScope: { mode: 'own', sharedUserIds: [] },

      },

      createdAt: now,

      updatedAt: now,

    };



    const saved = await usersService.saveUser(user);

    return res.json({ success: true, data: saved });

  } catch (err: unknown) {

    const message = err instanceof Error ? err.message : 'Failed to create user';

    return res.status(500).json({ success: false, error: message });

  }

}



export async function updateUser(req: Request, res: Response) {

  try {

    const { id, password, ...body } = req.body;

    if (!id) {

      return res.status(400).json({ success: false, error: 'id required' });

    }



    const existingRaw = await usersService.getUserByEmail(

      (await usersService.getUserById(id))?.email || ''

    );

    if (!existingRaw) {

      return res.status(404).json({ success: false, error: 'User not found' });

    }



    const active = body.active !== undefined ? body.active !== false : existingRaw.active;

    const updated: Record<string, unknown> = {

      ...existingRaw,

      ...body,

      id,

      active,

      profile: { ...(existingRaw.profile || {}), ...(body.profile || {}) },

      subscription: active ? (body.subscription !== undefined ? body.subscription : existingRaw.subscription) : null,

      permissions: active

        ? { ...existingRaw.permissions, ...(body.permissions || {}) }

        : {

            ...existingRaw.permissions,

            ...(body.permissions || {}),

            canUseSubscription: false,

          },

      updatedAt: Date.now(),

    };



    if (password && String(password).length >= 6) {

      updated.passwordHash = hashPassword(String(password));

    }



    const saved = await usersService.saveUser(updated);

    return res.json({ success: true, data: saved });

  } catch (err: unknown) {

    const message = err instanceof Error ? err.message : 'Failed to update user';

    return res.status(500).json({ success: false, error: message });

  }

}



export async function removeUser(req: Request, res: Response) {

  try {

    const { id } = req.body;

    if (!id) {

      return res.status(400).json({ success: false, error: 'id required' });

    }

    await usersService.deleteUser(id);

    return res.json({ success: true });

  } catch (err: unknown) {

    const message = err instanceof Error ? err.message : 'Failed to delete user';

    return res.status(500).json({ success: false, error: message });

  }

}



export async function listPages(_req: Request, res: Response) {

  try {

    const pages = await usersService.getAllPages();

    return res.json({ success: true, data: pages });

  } catch (err: unknown) {

    const message = err instanceof Error ? err.message : 'Failed to list pages';

    return res.status(500).json({ success: false, error: message });

  }

}


