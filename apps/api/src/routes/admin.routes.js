// @ts-check
import {
  compatibilityAuditSchema,
  createDiscountRuleSchema,
  createInvoiceSchema,
  createSubscriptionPlanSchema,
  invoiceIdParamSchema,
  ROLES,
  updateDiscountRuleSchema,
  updateSubscriptionPlanSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as billingController from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.post(
  '/compatibility-audit',
  validate(compatibilityAuditSchema),
  billingController.runAudit
);

router
  .route('/subscription-plans')
  .get(billingController.listSubscriptionPlans)
  .post(validate(createSubscriptionPlanSchema), billingController.createSubscriptionPlan);

router
  .route('/subscription-plans/:id')
  .patch(validate(invoiceIdParamSchema, 'params'), validate(updateSubscriptionPlanSchema), billingController.updateSubscriptionPlan)
  .delete(validate(invoiceIdParamSchema, 'params'), billingController.deleteSubscriptionPlan);

router
  .route('/discount-rules')
  .get(billingController.listDiscountRules)
  .post(validate(createDiscountRuleSchema), billingController.createDiscountRule);

router
  .route('/discount-rules/:id')
  .patch(validate(invoiceIdParamSchema, 'params'), validate(updateDiscountRuleSchema), billingController.updateDiscountRule)
  .delete(validate(invoiceIdParamSchema, 'params'), billingController.deleteDiscountRule);

router
  .route('/invoices')
  .get(billingController.listAdminInvoices)
  .post(validate(createInvoiceSchema), billingController.createInvoice);

router.post('/invoices/:id/send', validate(invoiceIdParamSchema, 'params'), billingController.sendInvoice);
router.post(
  '/invoices/:id/remind',
  validate(invoiceIdParamSchema, 'params'),
  billingController.remindInvoice
);

export default router;
