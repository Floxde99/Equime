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
 * Tarif d'un forfait : prix de la saison complète (ADR 011).
 * @param {number} cents
 */
export function formatSeasonPlanPrice(cents) {
  return `${formatEuroCents(cents)} la saison`;
}

/**
 * Mensualité indicative d'un forfait payé en 10 fois (« soit 10 × 89,00 € »).
 * @param {number} cents
 */
export function formatTenInstallments(cents) {
  return `soit 10 × ${formatEuroCents(Math.round(cents / 10))}`;
}
