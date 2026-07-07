/**
 * Schémas Zod — notifications et préférences utilisateur.
 */
import { z } from 'zod';

import { NOTIFICATION_TYPE_VALUES } from '../constants.js';

const notificationTypeSchema = z.enum(NOTIFICATION_TYPE_VALUES);

export const notificationTypeParamSchema = z.object({
  type: notificationTypeSchema,
});

export const notificationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const updateNotificationPreferenceSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
  })
  .refine((value) => value.emailEnabled !== undefined || value.inAppEnabled !== undefined, {
    message: 'Au moins un canal doit être renseigné',
  });
