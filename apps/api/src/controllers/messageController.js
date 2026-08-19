// @ts-check
import * as messageService from '../services/messageService.js';

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listContacts(req, res) {
  const contacts = await messageService.listAllowedContacts(req.user);
  res.json({ contacts });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listConversations(req, res) {
  const conversations = await messageService.listConversations(req.user.id);
  res.json({ conversations });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createConversation(req, res) {
  const conversation = await messageService.createConversation(req.user, req.body);
  res.status(201).json({ conversation });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listMessages(req, res) {
  const messages = await messageService.listMessages(req.params.id, req.user.id);
  res.json({ messages });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createMessage(req, res) {
  const message = await messageService.createMessage(req.params.id, req.user.id, req.body.body);
  res.status(201).json({ message });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function markRead(req, res) {
  const participant = await messageService.markConversationRead(req.params.id, req.user.id);
  res.json({ participant });
}
