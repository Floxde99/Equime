import { invoiceItemInputSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { MoneyInput } from '@/components/ui/money-input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { FamilyPicker } from '@/features/admin/components/FamilyPicker.jsx';
import { createInvoice } from '@/features/billing/api.js';
import { SubscriptionForm } from '@/features/billing/components/SubscriptionForm.jsx';
import { formatEuroCents } from '@/lib/money.js';
import { cn } from '@/lib/utils.js';

const PAYMENT_TERM_DAYS = 30;

/** Échéance par défaut : J+30, au format du champ date (AAAA-MM-JJ). */
function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + PAYMENT_TERM_DAYS);
  return date.toISOString().slice(0, 10);
}

const EMPTY_LINE = { label: '', quantity: 1, unitCents: undefined };

const MODES = [
  { value: 'season', label: 'Forfait de saison' },
  { value: 'lines', label: 'Lignes libres' },
];

const linesFormSchema = z.object({
  items: z.array(invoiceItemInputSchema).min(1, 'Ajoutez au moins une ligne'),
  dueAt: z.string().optional(),
});

/**
 * Création d'une facture par le secrétariat : recherche du client, puis forfait
 * de saison d'un cavalier (facture et échéancier émis à la validation) ou
 * lignes libres (cotisation, licence, pension…), montants en euros.
 * `initialFamily` (« Facturer » depuis l'annuaire) n'est lu qu'au montage : le
 * parent change la `key` du formulaire pour en présélectionner une autre.
 *
 * @param {{
 *   plans: Array<{ id: string, name: string, priceCents: number, sessionsPerWeek: number, active?: boolean }>,
 *   initialFamily?: import('@/features/admin/components/FamilyPicker.jsx').FamilyOption | null,
 *   onCreated?: (invoice: { id: string, number: string }) => void,
 *   onSubscribed?: (result: { subscription: object, invoice: { id: string, number: string } }) => void,
 * }} props
 */
export function CreateInvoiceForm({ plans, initialFamily = null, onCreated, onSubscribed }) {
  const [family, setFamily] = useState(initialFamily);
  const [mode, setMode] = useState('season');
  const [familyError, setFamilyError] = useState('');

  return (
    <div className="space-y-4">
      <Field
        label="Client"
        htmlFor="invoice-family"
        hint="Nom du parent, e-mail ou prénom d’un cavalier."
        error={familyError || undefined}
      >
        <FamilyPicker
          id="invoice-family"
          value={family}
          onChange={(value) => {
            setFamily(value);
            setFamilyError('');
          }}
          invalid={Boolean(familyError)}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card">
          Contenu
        </legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((option) => (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 font-sans text-sm',
                mode === option.value
                  ? 'border-primary bg-primary/5 text-on-card'
                  : 'border-border-on-card text-muted-on-card'
              )}
            >
              <input
                type="radio"
                name="invoice-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'season' ? (
        <SeasonSubscription family={family} plans={plans} onSubscribed={onSubscribed} />
      ) : (
        <LinesInvoiceForm
          family={family}
          onMissingFamily={() => setFamilyError('Choisissez une famille')}
          onCreated={(invoice) => {
            setFamily(null);
            onCreated?.(invoice);
          }}
        />
      )}
    </div>
  );
}

/**
 * Forfait de saison pour l'un des cavaliers de la famille (ADR 011).
 * @param {{ family: object | null, plans: object[],
 *   onSubscribed?: (result: { subscription: object, invoice: object }) => void }} props
 */
function SeasonSubscription({ family, plans, onSubscribed }) {
  const [riderId, setRiderId] = useState('');
  if (!family) {
    return (
      <p className="font-sans text-sm text-muted-on-card">
        Choisissez d’abord la famille, puis le cavalier.
      </p>
    );
  }
  const riders = family.riders ?? [];
  if (riders.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-on-card">
        Cette famille n’a pas encore de cavalier.
      </p>
    );
  }
  const rider = riders.find((item) => item.id === riderId) ?? riders[0];
  const current = rider.subscriptions?.[0] ?? null;

  return (
    <div className="space-y-4">
      <Select
        id="invoice-rider"
        label="Cavalier"
        value={rider.id}
        onChange={(event) => setRiderId(event.target.value)}
        options={riders.map((item) => ({
          value: item.id,
          label: item.subscriptions?.[0]
            ? `${item.firstName} ${item.lastName} (forfait ${item.subscriptions[0].plan.name})`
            : `${item.firstName} ${item.lastName}`,
        }))}
      />
      {current ? (
        <Alert variant="info">
          {rider.firstName} a déjà le forfait {current.plan.name} pour cette saison.
        </Alert>
      ) : (
        <SubscriptionForm
          key={rider.id}
          rider={rider}
          plans={plans}
          asAdmin
          onSubscribed={(result) => {
            setRiderId('');
            onSubscribed?.(result);
          }}
        />
      )}
    </div>
  );
}

/**
 * Facture en lignes libres (brouillon, une échéance).
 * @param {{ family: { id: string } | null, onMissingFamily: () => void,
 *   onCreated: (invoice: { id: string, number: string }) => void }} props
 */
function LinesInvoiceForm({ family, onMissingFamily, onCreated }) {
  const qc = useQueryClient();
  const defaults = { items: [EMPTY_LINE], dueAt: defaultDueDate() };
  const form = useForm({ resolver: zodResolver(linesFormSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const items = useWatch({ control: form.control, name: 'items' });

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      form.reset(defaults);
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      onCreated(invoice);
    },
  });

  const linesTotal = (items ?? []).reduce((sum, line) => {
    const unit = Number(line?.unitCents);
    const quantity = Number(line?.quantity);
    return Number.isFinite(unit) && Number.isFinite(quantity) ? sum + unit * quantity : sum;
  }, 0);
  const errors = form.formState.errors;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (!family?.id) {
          onMissingFamily();
          return;
        }
        mutation.mutate({
          familyId: family.id,
          dueAt: values.dueAt || undefined,
          items: values.items,
        });
      })}
    >
      {mutation.isError ? <Alert>{mutation.error.message}</Alert> : null}
      <div className="space-y-3">
        {fields.map((line, index) => {
          const lineErrors = errors.items?.[index];
          return (
            <div
              key={line.id}
              className="grid gap-2 rounded-lg border border-border-on-card p-3 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-start"
            >
              <Field
                label="Libellé"
                htmlFor={`invoice-line-label-${index}`}
                error={lineErrors?.label?.message}
              >
                <Input
                  placeholder="Cotisation annuelle, licence FFE…"
                  invalid={!!lineErrors?.label}
                  {...form.register(`items.${index}.label`)}
                />
              </Field>
              <Field
                label="Qté"
                htmlFor={`invoice-line-qty-${index}`}
                error={lineErrors?.quantity?.message}
              >
                <Input
                  type="number"
                  min="1"
                  invalid={!!lineErrors?.quantity}
                  {...form.register(`items.${index}.quantity`)}
                />
              </Field>
              <Field
                label="Prix unitaire"
                htmlFor={`invoice-line-price-${index}`}
                error={lineErrors?.unitCents?.message}
              >
                <Controller
                  control={form.control}
                  name={`items.${index}.unitCents`}
                  render={({ field }) => (
                    <MoneyInput
                      id={`invoice-line-price-${index}`}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!lineErrors?.unitCents}
                      placeholder="0"
                    />
                  )}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                className="sm:mt-7"
                aria-label={`Supprimer la ligne ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        {errors.items?.message ? (
          <p role="alert" className="font-sans text-xs text-danger">
            {errors.items.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => append(EMPTY_LINE)}>
            <Plus className="size-4" aria-hidden="true" />
            Ajouter une ligne
          </Button>
          <p className="font-sans text-sm text-on-card">
            Total : <strong>{formatEuroCents(linesTotal)}</strong>
          </p>
        </div>
      </div>

      <Field
        label="Échéance"
        htmlFor="invoice-due-at"
        hint="Par défaut à 30 jours."
        error={errors.dueAt?.message}
      >
        <Input id="invoice-due-at" type="date" {...form.register('dueAt')} />
      </Field>

      <Button type="submit" loading={mutation.isPending}>
        Créer la facture (brouillon)
      </Button>
    </form>
  );
}
