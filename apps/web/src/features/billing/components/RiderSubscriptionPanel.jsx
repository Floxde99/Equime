import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { SubscriptionForm } from '@/features/billing/components/SubscriptionForm.jsx';
import { SubscriptionSummary } from '@/features/billing/components/SubscriptionSummary.jsx';

/**
 * Bloc « Forfait » d'un cavalier (page Famille) : résumé des droits, ou
 * souscription d'un forfait de saison (ADR 011).
 *
 * @param {{
 *   rider: { id: string, firstName: string, lastName: string },
 *   entitlement: object | null,
 *   plans: Array<object>,
 * }} props
 */
export function RiderSubscriptionPanel({ rider, entitlement, plans }) {
  const [choosing, setChoosing] = useState(false);
  const [confirmation, setConfirmation] = useState(/** @type {string | null} */ (null));

  return (
    <section
      aria-label={`Forfait de ${rider.firstName}`}
      className="mt-4 rounded-lg border border-border-on-card p-4"
    >
      <h4 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-muted-on-card">
        Forfait
      </h4>
      {confirmation ? (
        <Alert variant="success" className="mb-3">
          {confirmation}{' '}
          <Link to="/app/factures" className="underline">
            Voir la facture
          </Link>
        </Alert>
      ) : null}
      {entitlement?.subscription ? (
        <SubscriptionSummary entitlement={entitlement} />
      ) : choosing ? (
        <SubscriptionForm
          rider={rider}
          plans={plans}
          onSubscribed={({ invoice }) => {
            setChoosing(false);
            setConfirmation(
              `Forfait enregistré. La facture ${invoice.number} et ses échéances sont disponibles.`
            );
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-sm text-muted-on-card">
            Pas encore de forfait : {rider.firstName} ne peut pas réserver de séance.
          </p>
          <Button type="button" variant="secondary" onClick={() => setChoosing(true)}>
            Choisir un forfait
          </Button>
        </div>
      )}
    </section>
  );
}
