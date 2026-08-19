/**
 * Formatage monétaire FR — vitrine et compte famille.
 * @param {number} cents
 */
export function formatEuroCents(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    (Number(cents) || 0) / 100
  );
}

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
