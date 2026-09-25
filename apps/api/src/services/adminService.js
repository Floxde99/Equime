// @ts-check
/**
 * Service administration — KPIs dashboard, gestion des membres (US-9.1, US-9.2).
 */
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

import { withWeeklyLoad } from './horseLoad.js';

const FAMILY_SEARCH_LIMIT = 10;
const FAMILY_SEARCH_MAX_TOKENS = 4;

/**
 * Motif LIKE d'un mot saisi : `%` et `_` tapés par l'utilisateur restent littéraux.
 * @param {string} token
 */
function likePattern(token) {
  return `%${token.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Recherche de familles pour le secrétariat (facturation, inscriptions).
 * Chaque mot doit apparaître dans le nom ou l'e-mail du parent, ou dans le
 * nom d'un cavalier ; comparaison insensible à la casse et aux accents
 * (`unaccent`). Les comptes anonymisés (RGPD) sont exclus.
 *
 * @param {string} query au moins 2 caractères (validé par Zod)
 */
export async function searchFamilies(query) {
  const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, FAMILY_SEARCH_MAX_TOKENS);

  const tokenConditions = tokens.map((token) => {
    const pattern = likePattern(token);
    return Prisma.sql`(
      unaccent(lower(u."firstName" || ' ' || u."lastName")) LIKE unaccent(lower(${pattern}))
      OR lower(u."email") LIKE lower(${pattern})
      OR EXISTS (
        SELECT 1 FROM "riders" r
        WHERE r."familyId" = f."id"
          AND unaccent(lower(r."firstName" || ' ' || r."lastName")) LIKE unaccent(lower(${pattern}))
      )
    )`;
  });

  /** @type {Array<{ id: string }>} */
  const rows = await prisma.$queryRaw`
    SELECT f."id"
    FROM "families" f
    JOIN "users" u ON u."id" = f."userId"
    WHERE u."anonymizedAt" IS NULL
      AND ${Prisma.join(tokenConditions, ' AND ')}
    ORDER BY u."lastName", u."firstName"
    LIMIT ${FAMILY_SEARCH_LIMIT}
  `;
  if (rows.length === 0) return [];

  const families = await prisma.family.findMany({
    where: { id: { in: rows.map((row) => row.id) } },
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, banned: true } },
      riders: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          level: true,
          subscriptions: activeSubscriptionSelect(),
        },
        orderBy: { firstName: 'asc' },
      },
    },
  });
  // Conserve l'ordre alphabétique calculé en SQL
  const byId = new Map(families.map((family) => [family.id, family]));
  return rows.map((row) => byId.get(row.id)).filter(Boolean);
}

/** Forfait de saison en cours ou à venir d'un cavalier (ADR 011). */
const activeSubscriptionSelect = () => ({
  where: { status: /** @type {const} */ ('active'), seasonEnd: { gt: new Date() } },
  select: {
    id: true,
    seasonStart: true,
    seasonEnd: true,
    paymentSchedule: true,
    invoiceId: true,
    plan: { select: { id: true, name: true, sessionsPerWeek: true } },
  },
  orderBy: { seasonStart: /** @type {const} */ ('asc') },
  take: 1,
});

const memberSelect = () => ({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  banned: true,
  bannedAt: true,
  anonymizedAt: true,
  createdAt: true,
  family: {
    select: {
      id: true,
      riders: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          level: true,
          subscriptions: activeSubscriptionSelect(),
        },
        orderBy: { firstName: 'asc' },
      },
    },
  },
});

/**
 * Indicateurs du tableau de bord admin (occupation, CA, charge cavalerie).
 * @returns {Promise<{
 *   courseOccupancyPercent: number,
 *   upcomingCoursesCount: number,
 *   revenueCents: number,
 *   paidInvoicesCount: number,
 *   horsesInLoadAlert: number,
 *   pendingDocumentsCount: number,
 * }>}
 */
export async function getDashboardKpis() {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [upcomingCourses, revenueAgg, horses, pendingDocumentsCount] = await Promise.all([
    prisma.course.findMany({
      where: {
        startAt: { gte: now, lte: weekAhead },
        status: { in: ['scheduled', 'ongoing'] },
      },
      include: {
        _count: {
          select: { enrollments: { where: { status: 'active', attendance: { not: 'excused' } } } },
        },
      },
    }),
    // Encaissements du mois (ADR 011) : règlements reçus, pas factures soldées.
    prisma.payment.aggregate({
      where: { paidAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.horse
      .findMany({ select: { id: true, alertThresholdHours: true } })
      .then((list) => withWeeklyLoad(list)),
    prisma.rider.count({
      where: {
        OR: [{ medicalCertificateStatus: 'pending' }, { licenseStatus: 'pending' }],
      },
    }),
  ]);

  let totalCapacity = 0;
  let totalEnrolled = 0;
  for (const course of upcomingCourses) {
    totalCapacity += course.capacity;
    totalEnrolled += course._count.enrollments;
  }

  const courseOccupancyPercent =
    totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  const horsesInLoadAlert = horses.filter((h) => h.weeklyLoadHours >= h.alertThresholdHours).length;

  return {
    courseOccupancyPercent,
    upcomingCoursesCount: upcomingCourses.length,
    revenueCents: revenueAgg._sum.amountCents ?? 0,
    paidInvoicesCount: revenueAgg._count,
    horsesInLoadAlert,
    pendingDocumentsCount,
  };
}

/**
 * Liste des membres (clients et moniteurs) pour la gestion admin.
 * @returns {Promise<object[]>}
 */
export async function listMembers() {
  return prisma.user.findMany({
    where: {
      role: { in: ['client', 'instructor'] },
      anonymizedAt: null,
    },
    select: memberSelect(),
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  });
}

/**
 * Moniteurs actifs pour les formulaires admin (création de cours).
 * @returns {Promise<object[]>}
 */
export async function listInstructors() {
  return prisma.user.findMany({
    where: { role: 'instructor', banned: false, anonymizedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { lastName: 'asc' },
  });
}

/**
 * Enregistre une action sensible admin (RGPD — traçabilité certificats médicaux).
 *
 * @param {{ adminId: string, action: 'medical_document_viewed' | 'medical_document_reviewed', riderId: string, details?: string }} input
 */
export async function logAdminAudit(input) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      riderId: input.riderId,
      details: input.details ?? null,
    },
  });
}

/**
 * Derniers événements d'audit admin (consultation certificats médicaux).
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function listAuditLogs(limit = 50) {
  return prisma.adminAuditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      admin: { select: { firstName: true, lastName: true, email: true } },
      rider: { select: { firstName: true, lastName: true } },
    },
  });
}
