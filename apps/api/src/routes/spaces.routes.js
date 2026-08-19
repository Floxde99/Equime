// @ts-check
import { createSpaceSchema, ROLES, spaceIdParamSchema, updateSpaceSchema } from '@equime/shared';
import { Router } from 'express';

import * as spaceController from '../controllers/spaceController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/', spaceController.listSpaces);

router.post('/', requireRole(ROLES.ADMIN), validate(createSpaceSchema), spaceController.createSpace);
router.get('/:id', validate(spaceIdParamSchema, 'params'), spaceController.getSpace);
router.patch(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(spaceIdParamSchema, 'params'),
  validate(updateSpaceSchema),
  spaceController.updateSpace
);
router.delete(
  '/:id',
  requireRole(ROLES.ADMIN),
  validate(spaceIdParamSchema, 'params'),
  spaceController.deleteSpace
);

export default router;
