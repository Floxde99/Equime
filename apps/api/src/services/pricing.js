/**
 * Tarification pure — aucune I/O, testable isolément (EPIC 6).
 */
/**
 * @param {{ basePriceCents: number, riderCount: number, rules: Array<{ id: string, label: string,
 *   percentage: number, minRiders?: number | null, active?: boolean }> }} input
 */
export function applyBestDiscount({ basePriceCents, riderCount, rules }) {
  const applicable = rules
    .filter((rule) => rule.active !== false)
    .filter((rule) => (rule.minRiders ?? 0) <= riderCount)
    .sort((a, b) => b.percentage - a.percentage || a.label.localeCompare(b.label, 'fr'));

  const appliedRule = applicable[0] ?? null;
  if (!appliedRule) {
    return { finalPriceCents: Math.max(0, basePriceCents), discountCents: 0, appliedRule: null };
  }

  const discountCents = Math.round((basePriceCents * appliedRule.percentage) / 100);
  const finalPriceCents = Math.max(0, basePriceCents - discountCents);

  return {
    finalPriceCents,
    discountCents: Math.min(discountCents, basePriceCents),
    appliedRule,
  };
}

/**
 * @param {Array<{ label: string, quantity: number, unitCents: number }>} items
 */
export function computeInvoiceTotalCents(items) {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
}
