// @ts-check
import {
  createVolunteerMissionSchema,
  ROLES,
  updateVolunteerMissionSchema,
  volunteerMissionIdParamSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as volunteerController from '../controllers/volunteerController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', volunteerController.listMissions);
router.post(
  '/',
  requireRole(ROLES.ADMIN),
  validate(createVolunteerMissionSchema),
  volunteerController.createMission
);
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(volunteerMissionIdParamSchema, 'params'),
  validate(updateVolunteerMissionSchema),
  volunteerController.updateMission
);
router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(volunteerMissionIdParamSchema, 'params'),
  volunteerController.deleteMission
);
router.post(
  '/:id/signups',
  requireRole(ROLES.CLIENT),
  validate(volunteerMissionIdParamSchema, 'params'),
  volunteerController.signup
);

export default router;
