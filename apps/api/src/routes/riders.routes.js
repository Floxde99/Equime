// @ts-check
import {
  affinityHorseParamSchema,
  createRiderSchema,
  documentTypeParamSchema,
  documentUploadFieldsSchema,
  riderIdParamSchema,
  ROLES,
  updateRiderSchema,
  upsertAffinitySchema,
} from '@equime/shared';
import { Router } from 'express';

import * as riderController from '../controllers/riderController.js';
import { riderDocumentUpload } from '../lib/uploads.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.CLIENT));

router.get('/', riderController.listRiders);
router.post('/', validate(createRiderSchema), riderController.createRider);
router.patch(
  '/:id',
  validate(riderIdParamSchema, 'params'),
  validate(updateRiderSchema),
  riderController.updateRider
);
router.delete('/:id', validate(riderIdParamSchema, 'params'), riderController.deleteRider);

router.post(
  '/:id/documents/:docType',
  validate(documentTypeParamSchema, 'params'),
  riderDocumentUpload.single('file'),
  validate(documentUploadFieldsSchema),
  riderController.uploadDocument
);

router.get(
  '/:id/documents/:docType',
  validate(documentTypeParamSchema, 'params'),
  riderController.downloadDocument
);

router.get(
  '/:id/affinities',
  validate(riderIdParamSchema, 'params'),
  riderController.listAffinities
);
router.put(
  '/:id/affinities/:horseId',
  validate(affinityHorseParamSchema, 'params'),
  validate(upsertAffinitySchema),
  riderController.upsertAffinity
);

export default router;
