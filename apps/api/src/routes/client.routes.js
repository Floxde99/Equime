// @ts-check
import { invoiceIdParamSchema, ROLES } from '@equime/shared';
import { Router } from 'express';

import * as billingController from '../controllers/billingController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.CLIENT));

router.get('/invoices', billingController.listClientInvoices);
router.post('/invoices/:id/pay', validate(invoiceIdParamSchema, 'params'), billingController.payClientInvoice);

export default router;
