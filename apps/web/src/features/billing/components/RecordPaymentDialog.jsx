import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_VALUES } from '@equime/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { MoneyInput } from '@/components/ui/money-input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { recordPayment } from '@/features/billing/api.js';
import { formatEuroCents } from '@/lib/money.js';

/** Modes saisis au club : la carte en ligne est enregistrée par Stripe. */
const OFFLINE_METHODS = PAYMENT_METHOD_VALUES.filter((method) => method !== 'card_online');

/** Date du jour au format du champ date (AAAA-MM-JJ, heure locale). */
function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Saisie d'un règlement reçu au club (ADR 011) : chèque, espèces, ANCV,
 * Pass'Sport… Montant proposé : l'échéance suivante.
 *
 * @param {{
 *   invoice: { id: string, number: string, remainingCents: number,
 *     nextInstallment?: { amountCents: number } | null } | null,
 *   onClose: () => void,
 *   onRecorded?: (invoice: object) => void,
 * }} props
 */
export function RecordPaymentDialog({ invoice, onClose, onRecorded }) {
  return (
    <Dialog open={Boolean(invoice)} onClose={onClose} title="Enregistrer un règlement">
      {invoice ? (
        <RecordPaymentForm
          key={invoice.id}
          invoice={invoice}
          onClose={onClose}
          onRecorded={onRecorded}
        />
      ) : null}
    </Dialog>
  );
}

/** @param {Parameters<typeof RecordPaymentDialog>[0] & { invoice: object }} props */
function RecordPaymentForm({ invoice, onClose, onRecorded }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('cheque');
  const [amountCents, setAmountCents] = useState(
    /** @type {number | undefined} */ (
      invoice.nextInstallment?.amountCents ?? invoice.remainingCents
    )
  );
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState('');
  const [amountError, setAmountError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(invoice.id, {
        method,
        amountCents: /** @type {number} */ (amountCents),
        // Aujourd'hui : l'instant présent (midi serait dans le futur le matin)
        paidAt: (paidAt === today() ? new Date() : new Date(`${paidAt}T12:00:00`)).toISOString(),
        reference: reference.trim() || undefined,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      qc.invalidateQueries({ queryKey: ['admin-invoice'] });
      qc.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      onRecorded?.(updated);
      onClose();
    },
  });

  function submit() {
    if (!Number.isFinite(amountCents) || /** @type {number} */ (amountCents) <= 0) {
      setAmountError('Saisissez un montant positif');
      return;
    }
    if (/** @type {number} */ (amountCents) > invoice.remainingCents) {
      setAmountError(`Le reste dû est de ${formatEuroCents(invoice.remainingCents)}`);
      return;
    }
    setAmountError('');
    mutation.mutate();
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="font-sans text-sm text-on-card">
        Facture {invoice.number} · reste dû {formatEuroCents(invoice.remainingCents)}
      </p>
      <Select
        id="payment-method"
        label="Mode de règlement"
        value={method}
        onChange={(event) => setMethod(event.target.value)}
        options={OFFLINE_METHODS.map((value) => ({
          value,
          label: PAYMENT_METHOD_LABELS[value],
        }))}
      />
      <Field label="Montant" htmlFor="payment-amount" error={amountError || undefined}>
        <MoneyInput
          id="payment-amount"
          value={amountCents}
          onChange={setAmountCents}
          invalid={Boolean(amountError)}
        />
      </Field>
      <Field label="Reçu le" htmlFor="payment-date">
        <Input
          id="payment-date"
          type="date"
          max={today()}
          value={paidAt}
          onChange={(event) => setPaidAt(event.target.value)}
        />
      </Field>
      <Field
        label={method === 'cheque' ? 'N° de chèque' : 'Référence (facultatif)'}
        htmlFor="payment-reference"
      >
        <Input
          id="payment-reference"
          value={reference}
          maxLength={80}
          onChange={(event) => setReference(event.target.value)}
        />
      </Field>
      {mutation.isError ? <Alert>{mutation.error.message}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Enregistrer le règlement
        </Button>
      </div>
    </form>
  );
}
