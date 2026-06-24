import express from 'express';
import * as authController from '../controllers/auth.controller';
import { loginLimiter } from '../middleware/rateLimiter';
import { requireSession } from '../middleware/auth';

const router = express.Router();

router.post('/login', loginLimiter, authController.login);
router.post('/register', loginLimiter, authController.register);
router.post('/whoami', authController.whoami);
router.post('/logout', authController.logout);
router.post('/change-password', requireSession, authController.changePassword);

export default router;
