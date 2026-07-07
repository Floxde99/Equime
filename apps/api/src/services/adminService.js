// @ts-check
/**
 * Service administration — KPIs dashboard, gestion des membres (US-9.1, US-9.2).
 */
import { prisma } from '../lib/prisma.js';

const MEMBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  banned: true,
  bannedAt: true,
  anonymizedAt: true,
  createdAt: true,
};

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
      include: { _count: { select: { enrollments: true } } },
    }),
    prisma.invoice.aggregate({
      where: { status: 'paid', paidAt: { gte: startOfMonth } },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.horse.findMany({
      select: { weeklyLoadHours: true, alertThresholdHours: true },
    }),
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

  const horsesInLoadAlert = horses.filter(
    (h) => h.weeklyLoadHours >= h.alertThresholdHours
  ).length;

  return {
    courseOccupancyPercent,
    upcomingCoursesCount: upcomingCourses.length,
    revenueCents: revenueAgg._sum.totalCents ?? 0,
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
    select: MEMBER_SELECT,
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  });
}
