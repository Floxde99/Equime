/**
 * Formatage monétaire FR — vitrine, espaces client et admin.
 * Le formatage de base vient de `@equime/shared` (même rendu dans les e-mails et PDF).
 */
import { formatEuroCents } from '@equime/shared';

export { formatCentsForInput, formatEuroCents, parseEurosToCents } from '@equime/shared';

/**
 * Prix d'événement public : montant ou « Gratuit » si 0.
 * @param {number | null | undefined} cents
 * @returns {string}
 */
export function formatEventPrice(cents) {
  if (cents == null || cents === '') return '';
  if (Number(cents) === 0) return 'Gratuit';
  return formatEuroCents(cents);
}

/**
 * Tarif de formule : quota mensuel (`sessionsPerWeek * 4`), libellé « / mois ».
 * @param {number} cents
 */
export function formatMonthlyPlanPrice(cents) {
  return `${formatEuroCents(cents)} / mois`;
}
