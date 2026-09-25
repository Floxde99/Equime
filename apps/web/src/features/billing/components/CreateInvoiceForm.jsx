import { invoiceItemInputSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
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
  { value: 'subscription', label: 'Formule de la famille' },
  { value: 'plan', label: 'Autre formule' },
  { value: 'lines', label: 'Lignes libres' },
];

const invoiceFormSchema = z
  .object({
    family: z.any(),
    mode: z.enum(['subscription', 'plan', 'lines']),
    subscriptionPlanId: z.string().optional(),
    // Validées seulement en mode « lignes libres » (voir plus bas)
    items: z.array(z.any()),
    dueAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'lines') {
      data.items.forEach((line, index) => {
        const result = invoiceItemInputSchema.safeParse(line);
        if (result.success) return;
        for (const issue of result.error.issues) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, ...issue.path],
            message: issue.message,
          });
        }
      });
    }
    if (!data.family?.id) {
      ctx.addIssue({ code: 'custom', path: ['family'], message: 'Choisissez une famille' });
      return;
    }
    if (data.mode === 'subscription' && !data.family.subscriptionPlan) {
      ctx.addIssue({
        code: 'custom',
        path: ['mode'],
        message: 'Cette famille n’a pas de formule : choisissez-en une ou saisissez des lignes',
      });
    }
    if (data.mode === 'plan' && !data.subscriptionPlanId) {
      ctx.addIssue({
        code: 'custom',
        path: ['subscriptionPlanId'],
        message: 'Choisissez une formule',
      });
    }
    if (data.mode === 'lines' && data.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Ajoutez au moins une ligne' });
    }
  });

/**
 * Création d'une facture par le secrétariat : recherche du client, puis
 * formule ou lignes libres (cotisation, licence, pension…), montants en euros.
 *
 * @param {{
 *   plans: Array<{ id: string, name: string, priceCents: number, active?: boolean }>,
 *   initialFamily?: import('@/features/admin/components/FamilyPicker.jsx').FamilyOption | null,
 *   onCreated?: (invoice: { id: string, number: string }) => void,
 * }} props
 */
export function CreateInvoiceForm({ plans, initialFamily = null, onCreated }) {
  const qc = useQueryClient();
  const defaults = {
    family: initialFamily,
    mode: initialFamily && !initialFamily.subscriptionPlan ? 'lines' : 'subscription',
    subscriptionPlanId: '',
    items: [EMPTY_LINE],
    dueAt: defaultDueDate(),
  };
  const form = useForm({ resolver: zodResolver(invoiceFormSchema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const [family, mode, items] = useWatch({
    control: form.control,
    name: ['family', 'mode', 'items'],
  });

  // Présélection depuis l'annuaire (« Facturer ») : l'arrivée d'une famille recharge le formulaire
  useEffect(() => {
    if (initialFamily) {
      form.reset({
        ...defaults,
        family: initialFamily,
        mode: initialFamily.subscriptionPlan ? 'subscription' : 'lines',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la famille initiale déclenche
  }, [initialFamily?.id]);

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      form.reset({ ...defaults, family: null });
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      onCreated?.(invoice);
    },
  });

  const linesTotal = (items ?? []).reduce((sum, line) => {
    const unit = Number(line?.unitCents);
    const quantity = Number(line?.quantity);
    return Number.isFinite(unit) && Number.isFinite(quantity) ? sum + unit * quantity : sum;
  }, 0);

  const activePlans = plans.filter((plan) => plan.active !== false);
  const errors = form.formState.errors;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        const body = { familyId: values.family.id, dueAt: values.dueAt || undefined };
        if (values.mode === 'plan') body.subscriptionPlanId = values.subscriptionPlanId;
        if (values.mode === 'lines') {
          body.items = values.items.map((line) => invoiceItemInputSchema.parse(line));
        }
        mutation.mutate(body);
      })}
    >
      {mutation.isError ? <Alert>{mutation.error.message}</Alert> : null}

      <Field
        label="Client"
        htmlFor="invoice-family"
        hint="Nom du parent, e-mail ou prénom d’un cavalier."
        error={errors.family?.message}
      >
        <Controller
          control={form.control}
          name="family"
          render={({ field }) => (
            <FamilyPicker
              id="invoice-family"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={!!errors.family}
            />
          )}
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
                value={option.value}
                className="accent-primary"
                {...form.register('mode')}
              />
              {option.label}
            </label>
          ))}
        </div>
        {errors.mode ? (
          <p role="alert" className="font-sans text-xs text-danger">
            {errors.mode.message}
          </p>
        ) : null}
      </fieldset>

      {mode === 'subscription' && family?.subscriptionPlan ? (
        <p className="rounded-lg bg-paper px-4 py-3 font-sans text-sm text-on-card">
          {family.subscriptionPlan.name} — {formatEuroCents(family.subscriptionPlan.priceCents)}
          <span className="block text-xs text-muted-on-card">
            La réduction famille s’applique automatiquement selon le nombre de cavaliers.
          </span>
        </p>
      ) : null}

      {mode === 'plan' ? (
        <Select
          id="invoice-plan"
          label="Formule"
          error={errors.subscriptionPlanId?.message}
          options={[
            { value: '', label: '— Choisir une formule —' },
            ...activePlans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} — ${formatEuroCents(plan.priceCents)}`,
            })),
          ]}
          {...form.register('subscriptionPlanId')}
        />
      ) : null}

      {mode === 'lines' ? (
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
      ) : null}

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
