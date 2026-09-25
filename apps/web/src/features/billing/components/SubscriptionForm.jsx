import { PAYMENT_SCHEDULE_LABELS, PAYMENT_SCHEDULE_VALUES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { previewRiderSubscription, subscribeRider } from '@/features/billing/api.js';
import { ENTITLEMENTS_KEY } from '@/features/billing/useEntitlements.js';
import { formatDate } from '@/lib/dates.js';
import { formatEuroCents } from '@/lib/money.js';
import { cn } from '@/lib/utils.js';

/** @param {boolean} selected */
function choiceClass(selected) {
  return cn(
    'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-sans text-sm',
    selected ? 'border-primary bg-primary/5 text-on-card' : 'border-border-on-card text-on-card'
  );
}

/**
 * Récapitulatif avant validation : prix de la saison, prorata, réduction famille
 * et échéances datées (ADR 011).
 * @param {{ preview: object, riderName: string }} props
 */
function PreviewDetails({ preview, riderName }) {
  const count = preview.installments.length;
  return (
    <div className="space-y-3 rounded-lg bg-paper p-4 font-sans text-sm text-on-card">
      <p className="font-semibold">
        {preview.plan.name} pour {riderName} — saison {preview.season.label}
      </p>
      <dl className="space-y-1">
        <div className="flex justify-between gap-3">
          <dt>Prix de la saison</dt>
          <dd className="tabular-nums">{formatEuroCents(preview.planPriceCents)}</dd>
        </div>
        {preview.prorated ? (
          <div className="flex justify-between gap-3">
            <dt>Arrivée en cours de saison (à partir du {formatDate(preview.startsAt)})</dt>
            <dd className="tabular-nums">{formatEuroCents(preview.basePriceCents)}</dd>
          </div>
        ) : null}
        {preview.discount ? (
          <div className="flex justify-between gap-3">
            <dt>
              Réduction {preview.discount.label} ({preview.discount.percentage} %)
            </dt>
            <dd className="tabular-nums">− {formatEuroCents(preview.discount.amountCents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-border-on-card pt-1 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatEuroCents(preview.totalCents)}</dd>
        </div>
      </dl>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-on-card">
          {count === 1 ? 'Une échéance' : `${count} échéances`}
        </p>
        <ol className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {preview.installments.map((installment) => (
            <li key={installment.sequence} className="flex justify-between gap-3 tabular-nums">
              <span>{formatDate(installment.dueAt)}</span>
              <span>{formatEuroCents(installment.amountCents)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Souscription d'un forfait de saison pour un cavalier : choix du forfait et de
 * l'échéancier, aperçu chiffré, validation (facture et échéancier créés).
 *
 * @param {{
 *   rider: { id: string, firstName: string, lastName?: string },
 *   plans: Array<{ id: string, name: string, priceCents: number, sessionsPerWeek: number,
 *     description?: string | null, active?: boolean }>,
 *   asAdmin?: boolean,
 *   onSubscribed?: (result: { subscription: object, invoice: object }) => void,
 * }} props
 */
export function SubscriptionForm({ rider, plans, asAdmin = false, onSubscribed }) {
  const qc = useQueryClient();
  const activePlans = plans.filter((plan) => plan.active !== false);
  const [planId, setPlanId] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState('ten_installments');
  const input = { planId, paymentSchedule };

  const previewQuery = useQuery({
    queryKey: ['subscription-preview', rider.id, planId, paymentSchedule, asAdmin],
    queryFn: () => previewRiderSubscription(rider.id, input, { asAdmin }),
    enabled: Boolean(planId),
  });

  const mutation = useMutation({
    mutationFn: () => subscribeRider(rider.id, input, { asAdmin }),
    onSuccess: (result) => {
      for (const key of [
        ENTITLEMENTS_KEY,
        ['enrollable'],
        ['client-invoices'],
        ['admin-invoices'],
        ['admin-members'],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
      onSubscribed?.(result);
    },
  });

  if (activePlans.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-on-card">
        Aucun forfait n’est proposé pour le moment. Contactez le secrétariat.
      </p>
    );
  }

  const preview = previewQuery.data;
  const canSubmit = Boolean(preview) && !preview.alreadySubscribed && !mutation.isPending;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card">
          Séances par semaine
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {activePlans.map((plan) => (
            <label key={plan.id} className={choiceClass(planId === plan.id)}>
              <input
                type="radio"
                name={`plan-${rider.id}`}
                value={plan.id}
                checked={planId === plan.id}
                onChange={() => setPlanId(plan.id)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-semibold">{plan.name}</span>
                <span className="block text-xs text-muted-on-card">
                  {plan.sessionsPerWeek} séance{plan.sessionsPerWeek > 1 ? 's' : ''} par semaine ·{' '}
                  {formatEuroCents(plan.priceCents)} la saison
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card">
          Règlement
        </legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_SCHEDULE_VALUES.map((value) => (
            <label key={value} className={choiceClass(paymentSchedule === value)}>
              <input
                type="radio"
                name={`schedule-${rider.id}`}
                value={value}
                checked={paymentSchedule === value}
                onChange={() => setPaymentSchedule(value)}
                className="mt-1 accent-primary"
              />
              {PAYMENT_SCHEDULE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      {planId ? (
        <QueryState
          isPending={previewQuery.isPending}
          isError={previewQuery.isError}
          error={previewQuery.error}
          onRetry={previewQuery.refetch}
        >
          {preview ? <PreviewDetails preview={preview} riderName={rider.firstName} /> : null}
        </QueryState>
      ) : null}

      {preview?.alreadySubscribed ? (
        <Alert variant="info">
          {rider.firstName} a déjà un forfait pour la saison {preview.season.label}.
        </Alert>
      ) : null}
      {mutation.isError ? <Alert>{mutation.error.message}</Alert> : null}

      <Button
        type="button"
        disabled={!canSubmit}
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {preview
          ? `Valider le forfait (${formatEuroCents(preview.totalCents)})`
          : 'Choisissez un forfait'}
      </Button>
      <p className="font-sans text-xs text-muted-on-card">
        La facture et son échéancier sont créés à la validation. Chaque échéance se règle en ligne
        ou au club.
      </p>
    </div>
  );
}
