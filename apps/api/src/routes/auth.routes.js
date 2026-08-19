// @ts-check
/**
 * Routes /api/v1/auth — chaque route sensible cumule rate limiting Redis
 * et validation Zod avant d'atteindre le contrôleur.
 */
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.post(
  '/register',
  rateLimit({ keyPrefix: 'register', max: 10, windowSec: 3600, failClosed: true }),
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  rateLimit({ keyPrefix: 'login', max: 10, windowSec: 900, failClosed: true }),
  validate(loginSchema),
  rateLimit({
    keyPrefix: 'login-account',
    max: 5,
    windowSec: 3600,
    failClosed: true,
    keyFrom: (req) => String(req.body?.email ?? ''),
  }),
  authController.login
);

router.post(
  '/refresh',
  rateLimit({ keyPrefix: 'refresh', max: 60, windowSec: 900, failClosed: true }),
  authController.refresh
);

router.post('/logout', requireAuth, authController.logout);

router.get('/me', requireAuth, authController.me);

router.patch('/me', requireAuth, validate(updateMeSchema), authController.updateMe);

router.get('/me/export', requireAuth, authController.exportData);

router.delete('/me', requireAuth, validate(deleteAccountSchema), authController.deleteAccount);

router.post(
  '/forgot-password',
  rateLimit({ keyPrefix: 'forgot', max: 5, windowSec: 3600, failClosed: true }),
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  rateLimit({ keyPrefix: 'reset', max: 10, windowSec: 3600, failClosed: true }),
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
