// @ts-check
import {
  createHealthLogSchema,
  createHorseSchema,
  horseIdParamSchema,
  ROLES,
  updateHorseSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as horseController from '../controllers/horseController.js';
import { horsePhotoUpload } from '../lib/uploads.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', horseController.listHorses);
router.get('/load-alerts', requireRole(ROLES.ADMIN), horseController.listLoadAlerts);

router.post(
  '/',
  requireRole(ROLES.ADMIN),
  validate(createHorseSchema),
  horseController.createHorse
);
router.get('/:id', validate(horseIdParamSchema, 'params'), horseController.getHorse);
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(horseIdParamSchema, 'params'),
  validate(updateHorseSchema),
  horseController.updateHorse
);
router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(horseIdParamSchema, 'params'),
  horseController.deleteHorse
);

router.post(
  '/:id/photo',
  requireRole(ROLES.ADMIN),
  validate(horseIdParamSchema, 'params'),
  horsePhotoUpload.single('file'),
  horseController.uploadPhoto
);
router.get('/:id/photo', validate(horseIdParamSchema, 'params'), horseController.downloadPhoto);
router.delete(
  '/:id/photo',
  requireRole(ROLES.ADMIN),
  validate(horseIdParamSchema, 'params'),
  horseController.deletePhoto
);

router.get(
  '/:id/health-logs',
  requireRole(ROLES.ADMIN, ROLES.INSTRUCTOR),
  validate(horseIdParamSchema, 'params'),
  horseController.listHealthLogs
);
router.post(
  '/:id/health-logs',
  requireRole(ROLES.ADMIN),
  validate(horseIdParamSchema, 'params'),
  validate(createHealthLogSchema),
  horseController.createHealthLog
);

export default router;
