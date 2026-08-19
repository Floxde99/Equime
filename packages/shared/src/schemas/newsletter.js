/**
 * Schémas Zod — inscription newsletter publique (vitrine).
 */
import { z } from 'zod';

import { emailSchema } from './auth.js';

export const subscribeNewsletterSchema = z.object({
  email: emailSchema,
});
