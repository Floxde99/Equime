// @ts-check
/**
 * Service bénévolat — CRUD admin et inscriptions client.
 */
import { AppError } from '../lib/appError.js';
import { prisma } from '../lib/prisma.js';

const MISSION_SELECT = {
  id: true,
  title: true,
  description: true,
  startAt: true,
  endAt: true,
  slots: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { signups: true } },
};

function formatMission(mission) {
  return {
    ...mission,
    signupCount: mission._count.signups,
    remainingSlots: Math.max(0, mission.slots - mission._count.signups),
  };
}

export async function listVolunteerMissions() {
  const missions = await prisma.volunteerMission.findMany({
    select: MISSION_SELECT,
    orderBy: { startAt: 'asc' },
  });
  return missions.map(formatMission);
}

/** @param {object} input */
export async function createVolunteerMission(input) {
  const mission = await prisma.volunteerMission.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      slots: input.slots,
    },
    select: MISSION_SELECT,
  });
  return formatMission(mission);
}

/** @param {string} missionId @param {Partial<object>} input */
export async function updateVolunteerMission(missionId, input) {
  await prisma.volunteerMission.findUniqueOrThrow({ where: { id: missionId } });
  const mission = await prisma.volunteerMission.update({
    where: { id: missionId },
    data: input,
    select: MISSION_SELECT,
  });
  return formatMission(mission);
}

/** @param {string} missionId */
export async function deleteVolunteerMission(missionId) {
  await prisma.volunteerMission.delete({ where: { id: missionId } });
}

/**
 * @param {string} missionId
 * @param {string} userId
 */
export async function signupVolunteerMission(missionId, userId) {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.volunteerMission.findUnique({
      where: { id: missionId },
      include: { _count: { select: { signups: true } } },
    });
    if (!mission) throw AppError.notFound('Mission introuvable');

    const existing = await tx.volunteerSignup.findUnique({
      where: { missionId_userId: { missionId, userId } },
    });
    if (existing) throw AppError.conflict('Vous êtes déjà inscrit à cette mission');

    if (mission._count.signups >= mission.slots) {
      throw AppError.conflict('Cette mission est complète');
    }

    return tx.volunteerSignup.create({
      data: { missionId, userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        mission: { select: { id: true, title: true } },
      },
    });
  });
}
