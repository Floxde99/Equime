/**
 * Bandeau discret lorsque Stripe tourne en clés test (préprod / prod avant go-live).
 *
 * @param {{ provider?: 'stripe' | 'simulated' | null, mode?: 'test' | 'live' | null }} props
 */
export function PaymentTestBanner({ provider, mode }) {
  if (provider !== 'stripe' || mode !== 'test') return null;

  return (
    <aside
      role="status"
      className="rounded-xl border border-border bg-surface px-4 py-3 font-sans text-sm text-text"
      aria-label="Mode paiement test"
    >
      <p className="font-semibold">Paiement en mode test</p>
      <p className="mt-1 text-muted">
        Les transactions utilisent les clés Stripe test — aucune carte réelle n’est débitée.
      </p>
    </aside>
  );
}
