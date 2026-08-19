// @ts-check
import {
  adminChangeFamilySubscriptionSchema,
  adminRiderDocumentParamSchema,
  compatibilityAuditSchema,
  createDiscountRuleSchema,
  createInvoiceSchema,
  createMemberSchema,
  createSubscriptionPlanSchema,
  familyIdParamSchema,
  invoiceIdParamSchema,
  reviewDocumentSchema,
  riderDocumentReviewParamSchema,
  ROLES,
  updateDiscountRuleSchema,
  updateMemberProfileSchema,
  updateSubscriptionPlanSchema,
  userIdParamSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as adminController from '../controllers/adminController.js';
import * as billingController from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/dashboard-kpis', adminController.dashboardKpis);
router.get('/members', adminController.listMembers);
router.post('/members', validate(createMemberSchema), adminController.createMember);
router.patch(
  '/members/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateMemberProfileSchema),
  adminController.updateMember
);
router.get('/instructors', adminController.listInstructors);
router.get('/audit-logs', adminController.listAuditLogs);
router.post('/members/:id/ban', validate(userIdParamSchema, 'params'), adminController.banMember);
router.post('/members/:id/unban', validate(userIdParamSchema, 'params'), adminController.unbanMember);
router.get('/pending-documents', adminController.listPendingDocuments);
router.post(
  '/riders/:riderId/review-document',
  validate(riderDocumentReviewParamSchema, 'params'),
  validate(reviewDocumentSchema),
  adminController.reviewDocument
);
router.get(
  '/riders/:riderId/documents/:docType',
  validate(adminRiderDocumentParamSchema, 'params'),
  adminController.downloadRiderDocument
);

router.patch(
  '/families/:id/subscription',
  validate(familyIdParamSchema, 'params'),
  validate(adminChangeFamilySubscriptionSchema),
  billingController.adminChangeFamilySubscription
);

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

router.post('/invoices/generate-subscriptions', billingController.generateSubscriptionInvoices);
router.get(
  '/invoices/:id/pdf',
  validate(invoiceIdParamSchema, 'params'),
  billingController.downloadAdminInvoicePdf
);
router.get(
  '/invoices/:id',
  validate(invoiceIdParamSchema, 'params'),
  billingController.getAdminInvoice
);
router.post('/invoices/:id/send', validate(invoiceIdParamSchema, 'params'), billingController.sendInvoice);
router.post(
  '/invoices/:id/remind',
  validate(invoiceIdParamSchema, 'params'),
  billingController.remindInvoice
);

export default router;
