// @ts-check
import {
  createIncidentSchema,
  incidentIdParamSchema,
  incidentQuerySchema,
  ROLES,
} from '@equime/shared';
import { Router } from 'express';

import * as incidentController from '../controllers/incidentController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/critical-count',
  requireRole(ROLES.ADMIN),
  incidentController.countCriticalOpen
);
router.post(
  '/',
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(createIncidentSchema),
  incidentController.createIncident
);
router.get(
  '/',
  requireRole(ROLES.ADMIN),
  validate(incidentQuerySchema, 'query'),
  incidentController.listIncidents
);
router.post(
  '/:id/resolve',
  requireRole(ROLES.ADMIN),
  validate(incidentIdParamSchema, 'params'),
  incidentController.resolveIncident
);

export default router;
