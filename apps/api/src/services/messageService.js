// @ts-check
/**
 * Service messagerie — contacts autorisés, conversations et lecture.
 */
import { ROLES } from '@equime/shared';

import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
};

/**
 * @param {{ id: string, role: string }} user
 */
export async function listAllowedContacts(user) {
  if (user.role === ROLES.CLIENT) {
    return prisma.user.findMany({
      where: { id: { not: user.id }, role: { in: [ROLES.ADMIN, ROLES.INSTRUCTOR] }, banned: false },
      select: CONTACT_SELECT,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  if (user.role === ROLES.INSTRUCTOR) {
    return prisma.user.findMany({
      where: { id: { not: user.id }, role: { in: [ROLES.ADMIN, ROLES.CLIENT] }, banned: false },
      select: CONTACT_SELECT,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  return prisma.user.findMany({
    where: { id: { not: user.id }, banned: false },
    select: CONTACT_SELECT,
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
  });
}

/**
 * @param {{ id: string, role: string }} user
 * @param {string} participantId
 */
export async function assertAllowedContact(user, participantId) {
  const contacts = await listAllowedContacts(user);
  if (!contacts.some((contact) => contact.id === participantId)) {
    throw AppError.forbidden('Ce contact n’est pas autorisé');
  }
}

/**
 * @param {{ id: string, role: string }} user
 * @param {{ participantId: string, subject?: string }} input
 */
export async function createConversation(user, input) {
  await assertAllowedContact(user, input.participantId);

  const existing = await prisma.conversation.findFirst({
    where: {
      participants: {
        every: { userId: { in: [user.id, input.participantId] } },
      },
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: input.participantId } } },
      ],
    },
    include: {
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: CONTACT_SELECT },
        },
      },
    },
  });

  if (existing && existing.participants.length === 2) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      subject: input.subject ?? null,
      participants: {
        create: [{ userId: user.id }, { userId: input.participantId }],
      },
    },
    include: {
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: CONTACT_SELECT },
        },
      },
    },
  });
}

/**
 * @param {string} userId
 */
export async function listConversations(userId) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: CONTACT_SELECT },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
        },
      },
    },
  });

  return conversations.map((conversation) => {
    const participant = conversation.participants.find((entry) => entry.userId === userId);
    const contacts = conversation.participants.filter((entry) => entry.userId !== userId).map((entry) => entry.user);
    const lastMessage = conversation.messages[0] ?? null;
    const hasUnread =
      Boolean(lastMessage) &&
      lastMessage.senderId !== userId &&
      (!participant?.lastReadAt || lastMessage.createdAt > participant.lastReadAt);

    return {
      id: conversation.id,
      subject: conversation.subject,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      contacts,
      lastMessage,
      hasUnread,
    };
  });
}

/**
 * @param {string} conversationId
 * @param {string} userId
 */
export async function assertConversationAccess(conversationId, userId) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw AppError.notFound('Conversation introuvable');
  return participant;
}

/**
 * @param {string} conversationId
 * @param {string} userId
 */
export async function listMessages(conversationId, userId) {
  await assertConversationAccess(conversationId, userId);
  return prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: { select: CONTACT_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * @param {string} conversationId
 * @param {string} userId
 * @param {string} body
 */
export async function createMessage(conversationId, userId, body) {
  await assertConversationAccess(conversationId, userId);
  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId: userId, body },
      include: {
        sender: { select: CONTACT_SELECT },
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: message.createdAt },
    });
    return message;
  });
}

/**
 * @param {string} conversationId
 * @param {string} userId
 */
export async function markConversationRead(conversationId, userId) {
  await assertConversationAccess(conversationId, userId);
  return prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}
