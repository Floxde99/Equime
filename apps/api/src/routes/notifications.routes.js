// @ts-check
import {
  notificationIdParamSchema,
  notificationTypeParamSchema,
  updateNotificationPreferenceSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as notificationController from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/preferences', notificationController.listPreferences);
router.put(
  '/preferences/:type',
  validate(notificationTypeParamSchema, 'params'),
  validate(updateNotificationPreferenceSchema),
  notificationController.updatePreference
);
router.get('/', notificationController.listNotifications);
router.post('/read-all', notificationController.markAllRead);
router.post(
  '/:id/read',
  validate(notificationIdParamSchema, 'params'),
  notificationController.markRead
);

export default router;
