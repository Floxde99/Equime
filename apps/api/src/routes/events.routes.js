// @ts-check
import {
  createEventSchema,
  eventIdParamSchema,
  eventRegistrationIdParamSchema,
  eventRegistrationSchema,
  forceQuerySchema,
  overrideHorseSchema,
  ROLES,
  updateEventSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as eventController from '../controllers/eventController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.get('/', eventController.listPublicEvents);

router.use(requireAuth);

router.get('/admin', requireRole(ROLES.ADMIN), eventController.listAdminEvents);
router.post('/', requireRole(ROLES.ADMIN), validate(createEventSchema), eventController.createEvent);
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(eventIdParamSchema, 'params'),
  validate(updateEventSchema),
  eventController.updateEvent
);
router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(eventIdParamSchema, 'params'),
  eventController.deleteEvent
);
router.get(
  '/:id/registrations',
  requireRole(ROLES.ADMIN),
  validate(eventIdParamSchema, 'params'),
  eventController.listRegistrations
);
router.post(
  '/:id/registrations',
  requireRole(ROLES.CLIENT, ROLES.ADMIN),
  validate(eventIdParamSchema, 'params'),
  validate(eventRegistrationSchema),
  validate(forceQuerySchema, 'query'),
  eventController.registerRider
);
router.post(
  '/:id/assign-horses',
  requireRole(ROLES.ADMIN),
  validate(eventIdParamSchema, 'params'),
  eventController.assignHorses
);
router.post(
  '/:id/registrations/:registrationId/cancel',
  requireRole(ROLES.CLIENT, ROLES.ADMIN),
  validate(eventRegistrationIdParamSchema, 'params'),
  eventController.cancelRegistration
);
router.get(
  '/:id/registrations/:registrationId/horse-options',
  requireRole(ROLES.ADMIN),
  validate(eventRegistrationIdParamSchema, 'params'),
  eventController.listHorseOptions
);
router.patch(
  '/:id/registrations/:registrationId/horse',
  requireRole(ROLES.ADMIN),
  validate(eventRegistrationIdParamSchema, 'params'),
  validate(overrideHorseSchema),
  eventController.overrideHorse
);

export default router;
