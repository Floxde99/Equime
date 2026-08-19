// @ts-check
/**
 * Helpers communs aux seeds dev et recette.
 * Volontairement autonomes (aucune dépendance à src/) : les seeds
 * s'exécutent hors du cycle de vie de l'API.
 */
import argon2 from 'argon2';

/**
 * Hash argon2id (mêmes paramètres que le service auth de la Phase 2).
 * @param {string} password
 * @returns {Promise<string>}
 */
export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Prochain jour de semaine donné à une heure fixe (base des plannings de seed).
 * @param {number} weekday 0 = dimanche … 6 = samedi
 * @param {number} hour Heure locale
 * @param {Date} [from]
 * @returns {Date}
 */
export function nextWeekday(weekday, hour, from = new Date()) {
  const date = new Date(from);
  date.setHours(hour, 0, 0, 0);
  const diff = (weekday - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Décale une date de n semaines.
 * @param {Date} date
 * @param {number} weeks
 * @returns {Date}
 */
export function addWeeks(date, weeks) {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

/**
 * Décale une date de n minutes.
 * @param {Date} date
 * @param {number} minutes
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) : le seed de recette
 * produit toujours le même jeu de données, condition d'un cahier de recette rejouable.
 * @param {number} seed
 * @returns {() => number} nombre dans [0, 1)
 */
export function createRng(seed) {
  let state = seed;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Vide toutes les tables dans l'ordre inverse des dépendances FK.
 * @param {import('../generated/prisma/client.js').PrismaClient} prisma
 */
export async function resetDatabase(prisma) {
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.volunteerSignup.deleteMany();
  await prisma.volunteerMission.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.courseEnrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.horseHealthLog.deleteMany();
  await prisma.horseAffinity.deleteMany();
  await prisma.horse.deleteMany();
  await prisma.space.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.family.deleteMany();
  await prisma.discountRule.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.newsletterSubscription.deleteMany();
  await prisma.user.deleteMany();
}
