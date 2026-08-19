// @ts-check
import { invoiceIdParamSchema, ROLES, subscribeFamilyPlanSchema } from '@equime/shared';
import { Router } from 'express';

import * as billingController from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.CLIENT));

router.get('/family/subscription', billingController.getFamilySubscription);
router.post(
  '/family/subscription',
  validate(subscribeFamilyPlanSchema),
  billingController.subscribeFamilyPlan
);

router.get('/invoices', billingController.listClientInvoices);
router.get(
  '/invoices/:id/pdf',
  validate(invoiceIdParamSchema, 'params'),
  billingController.downloadClientInvoicePdf
);
router.post(
  '/invoices/:id/pay',
  validate(invoiceIdParamSchema, 'params'),
  billingController.payClientInvoice
);

export default router;
