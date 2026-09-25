import { PAYMENT_SCHEDULE_LABELS } from '@equime/shared';

import { formatDate } from '@/lib/dates.js';

/**
 * Dernier jour inclus d'une saison (la borne `seasonEnd` est exclue).
 * @param {string | Date} seasonEnd
 */
function lastDayOf(seasonEnd) {
  return new Date(new Date(seasonEnd).getTime() - 1);
}

/**
 * « 1 séance réservée sur 2 ».
 * @param {number} used
 * @param {number} perWeek
 */
function weekLabel(used, perWeek) {
  const count = Math.min(used, perWeek);
  const plural = count > 1 ? 's' : '';
  return `${count} séance${plural} réservée${plural} sur ${perWeek}`;
}

/**
 * Forfait d'un cavalier, séances de la semaine et rattrapages disponibles (ADR 011).
 * @param {{
 *   entitlement: {
 *     subscription: null | { seasonStart: string, seasonEnd: string, paymentSchedule: string,
 *       plan: { name: string, sessionsPerWeek: number } },
 *     sessionsPerWeek: number, usedThisWeek: number,
 *     credits: Array<{ id: string, expiresAt: string }>,
 *   },
 * }} props
 */
export function SubscriptionSummary({ entitlement }) {
  const { subscription, credits } = entitlement;
  if (!subscription) return null;
  const perWeek = subscription.plan.sessionsPerWeek;
  const seasonStarted = new Date(subscription.seasonStart) <= new Date();

  return (
    <div className="space-y-2 font-sans text-sm text-on-card">
      <p>
        <strong>Forfait {subscription.plan.name}</strong> · {perWeek} séance
        {perWeek > 1 ? 's' : ''} par semaine ·{' '}
        {PAYMENT_SCHEDULE_LABELS[subscription.paymentSchedule].toLowerCase()}
      </p>
      <p className="text-xs text-muted-on-card">
        Saison du {formatDate(subscription.seasonStart)} au{' '}
        {formatDate(lastDayOf(subscription.seasonEnd))}
      </p>
      {seasonStarted ? <p>Cette semaine : {weekLabel(entitlement.usedThisWeek, perWeek)}</p> : null}
      <p>
        {credits.length === 0
          ? 'Aucun rattrapage disponible.'
          : `Rattrapage${credits.length > 1 ? 's' : ''} disponible${credits.length > 1 ? 's' : ''} : ${credits.length} (à utiliser avant le ${formatDate(credits[0].expiresAt)}${credits.length > 1 ? ' pour le premier' : ''})`}
      </p>
    </div>
  );
}
