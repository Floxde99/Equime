// @ts-check
import {
  cancelCourseSchema,
  courseIdParamSchema,
  createCourseSchema,
  enrollRiderSchema,
  enrollmentIdParamSchema,
  overrideHorseSchema,
  planningQuerySchema,
  ROLES,
  updateAttendanceSchema,
  updateCourseSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as courseController from '../controllers/courseController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/planning', validate(planningQuerySchema, 'query'), courseController.getPlanning);

router.get('/enrollable', requireRole(ROLES.CLIENT), courseController.listEnrollable);

router.post('/', requireRole(ROLES.ADMIN), validate(createCourseSchema), courseController.createCourse);
router.get('/:id', validate(courseIdParamSchema, 'params'), courseController.getCourse);
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(courseIdParamSchema, 'params'),
  validate(updateCourseSchema),
  courseController.updateCourse
);
router.post(
  '/:id/cancel',
  requireRole(ROLES.ADMIN),
  validate(courseIdParamSchema, 'params'),
  validate(cancelCourseSchema),
  courseController.cancelCourse
);

router.post(
  '/:id/enrollments',
  requireRole(ROLES.CLIENT),
  validate(courseIdParamSchema, 'params'),
  validate(enrollRiderSchema),
  courseController.enroll
);

router.get(
  '/:id/enrollments',
  requireRole(ROLES.ADMIN, ROLES.INSTRUCTOR),
  validate(courseIdParamSchema, 'params'),
  courseController.listEnrollments
);

router.patch(
  '/:id/enrollments/:enrollmentId/attendance',
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(enrollmentIdParamSchema, 'params'),
  validate(updateAttendanceSchema),
  courseController.updateAttendance
);

router.post(
  '/:id/assign-horses',
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(courseIdParamSchema, 'params'),
  courseController.assignHorses
);

router.get(
  '/:id/enrollments/:enrollmentId/horse-options',
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(enrollmentIdParamSchema, 'params'),
  courseController.listHorseOptions
);

router.patch(
  '/:id/enrollments/:enrollmentId/horse',
  requireRole(ROLES.INSTRUCTOR, ROLES.ADMIN),
  validate(enrollmentIdParamSchema, 'params'),
  validate(overrideHorseSchema),
  courseController.overrideHorse
);

export default router;
