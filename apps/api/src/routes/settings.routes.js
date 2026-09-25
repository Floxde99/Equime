// @ts-check
import { ROLES, updateClubSettingsSchema } from '@equime/shared';
import { Router } from 'express';

import * as settingsController from '../controllers/settingsController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', settingsController.getSettings);
router.patch(
  '/',
  requireRole(ROLES.ADMIN),
  validate(updateClubSettingsSchema),
  settingsController.updateSettings
);

export default router;
