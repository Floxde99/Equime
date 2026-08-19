/**
 * Schémas Zod — messagerie.
 */
import { z } from 'zod';

export const conversationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createConversationSchema = z.object({
  participantId: z.string().min(1),
  subject: z.string().trim().max(120).optional().or(z.literal('').transform(() => undefined)),
});

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Le message est requis').max(5000),
});
