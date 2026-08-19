// @ts-check
import {
  conversationIdParamSchema,
  createConversationSchema,
  createMessageSchema,
} from '@equime/shared';
import { Router } from 'express';

import * as messageController from '../controllers/messageController.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/contacts', messageController.listContacts);
router.get('/conversations', messageController.listConversations);
router.post(
  '/conversations',
  validate(createConversationSchema),
  messageController.createConversation
);
router.get(
  '/conversations/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  messageController.listMessages
);
router.post(
  '/conversations/:id/messages',
  validate(conversationIdParamSchema, 'params'),
  validate(createMessageSchema),
  messageController.createMessage
);
router.post(
  '/conversations/:id/read',
  validate(conversationIdParamSchema, 'params'),
  messageController.markRead
);

export default router;
