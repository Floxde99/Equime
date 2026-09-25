// @ts-check
import { invoiceIdParamSchema, ROLES } from '@equime/shared';
import { Router } from 'express';

import * as billingController from '../controllers/billingController.js';
import * as paymentController from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.CLIENT));

router.get('/entitlements', billingController.getEntitlements);

router.get('/invoices', billingController.listClientInvoices);
router.get(
  '/invoices/:id/pdf',
  validate(invoiceIdParamSchema, 'params'),
  billingController.downloadClientInvoicePdf
);
router.post(
  '/invoices/:id/checkout',
  validate(invoiceIdParamSchema, 'params'),
  paymentController.createInvoiceCheckout
);
router.post(
  '/invoices/:id/confirm-checkout',
  validate(invoiceIdParamSchema, 'params'),
  paymentController.confirmInvoiceCheckout
);
router.post(
  '/invoices/:id/pay',
  validate(invoiceIdParamSchema, 'params'),
  billingController.payClientInvoice
);

export default router;
