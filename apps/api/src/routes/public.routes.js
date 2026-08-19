// @ts-check
/**
 * Routes publiques /api/v1/public — sans authentification, rate-limitées.
 */
import { subscribeNewsletterSchema } from '@equime/shared';
import { Router } from 'express';

import * as billingController from '../controllers/billingController.js';
import * as courseController from '../controllers/courseController.js';
import * as newsletterController from '../controllers/newsletterController.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.get('/plans', billingController.listPublicPlans);
router.get('/courses', courseController.listPublicCourses);

router.post(
  '/newsletter',
  rateLimit({ keyPrefix: 'newsletter', max: 5, windowSec: 3600 }),
  validate(subscribeNewsletterSchema),
  newsletterController.subscribe
);

export default router;
