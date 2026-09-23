// @ts-check
/**
 * Webhooks publics (Stripe) — montés avec express.raw avant le JSON parser.
 */
import { Router } from 'express';

import * as paymentController from '../controllers/paymentController.js';

const router = Router();

router.post('/stripe', paymentController.handleStripeWebhook);

export default router;
