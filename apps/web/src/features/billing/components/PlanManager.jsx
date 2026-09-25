import { createSubscriptionPlanSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { MoneyInput } from '@/components/ui/money-input.jsx';
import { createSubscriptionPlan, updateSubscriptionPlan } from '@/features/billing/api.js';
import { formatEuroCents, formatMonthlyPlanPrice } from '@/lib/money.js';
import { formatSessionsPerWeek } from '@/lib/publicSchedule.js';

const PLAN_DEFAULTS = { name: '', description: '', priceCents: undefined, sessionsPerWeek: 1 };

/**
 * Formules : création, modification, archivage (une formule archivée n'est plus
 * proposée aux familles mais reste sur les factures existantes).
 * @param {{ plans: Array<{ id: string, name: string, description?: string | null,
 *   priceCents: number, sessionsPerWeek: number, active: boolean }> }} props
 */
export function PlanManager({ plans }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(/** @type {null | { id: string }} */ (null));
  const [feedback, setFeedback] = useState(
    /** @type {null | { type: 'success' | 'error', message: string }} */ (null)
  );
  const [pendingId, setPendingId] = useState(/** @type {string | null} */ (null));
  const form = useForm({
    resolver: zodResolver(createSubscriptionPlanSchema),
    defaultValues: PLAN_DEFAULTS,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['subscription-plans'] });

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateSubscriptionPlan(editing.id, values) : createSubscriptionPlan(values),
    onSuccess: (plan) => {
      setFeedback({
        type: 'success',
        message: editing ? `Formule « ${plan.name} » modifiée.` : `Formule « ${plan.name} » créée.`,
      });
      setEditing(null);
      form.reset(PLAN_DEFAULTS);
      refresh();
    },
    onError: (err) => setFeedback({ type: 'error', message: err.message }),
  });

  const toggleMutation = useMutation({
    mutationFn: (plan) => updateSubscriptionPlan(plan.id, { active: !plan.active }),
    onMutate: (plan) => setPendingId(plan.id),
    onSettled: () => setPendingId(null),
    onSuccess: (plan) => {
      setFeedback({
        type: 'success',
        message: plan.active
          ? `Formule « ${plan.name} » réactivée.`
          : `Formule « ${plan.name} » archivée.`,
      });
      refresh();
    },
    onError: (err) => setFeedback({ type: 'error', message: err.message }),
  });

  /** @param {typeof plans[number]} plan */
  const startEdit = (plan) => {
    setEditing(plan);
    setFeedback(null);
    form.reset({
      name: plan.name,
      description: plan.description ?? '',
      priceCents: plan.priceCents,
      sessionsPerWeek: plan.sessionsPerWeek,
    });
    document.getElementById('plan-name')?.focus();
  };

  const active = plans.filter((plan) => plan.active !== false);
  const archived = plans.filter((plan) => plan.active === false);
  const errors = form.formState.errors;

  return (
    <Card title="Formules">
      {feedback ? (
        <Alert variant={feedback.type} className="mb-4">
          {feedback.message}
        </Alert>
      ) : null}

      <ul className="mb-5 space-y-2">
        {active.length === 0 ? (
          <li className="font-sans text-sm text-muted-on-card">Aucune formule proposée.</li>
        ) : null}
        {active.map((plan) => (
          <li
            key={plan.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-on-card bg-paper p-3"
          >
            <div>
              <p className="font-sans text-sm font-semibold text-on-card">{plan.name}</p>
              <p className="font-sans text-sm text-muted-on-card">
                {formatMonthlyPlanPrice(plan.priceCents)} ·{' '}
                {formatSessionsPerWeek(plan.sessionsPerWeek)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" onClick={() => startEdit(plan)}>
                Modifier
              </Button>
              <Button
                type="button"
                variant="ghost"
                loading={pendingId === plan.id}
                onClick={() => toggleMutation.mutate(plan)}
              >
                Archiver
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="mb-5">
          <summary className="cursor-pointer font-sans text-sm text-muted-on-card">
            Formules archivées ({archived.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {archived.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-on-card p-3"
              >
                <p className="font-sans text-sm text-muted-on-card">
                  {plan.name} · {formatEuroCents(plan.priceCents)}{' '}
                  <Badge variant="default">Archivée</Badge>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  loading={pendingId === plan.id}
                  onClick={() => toggleMutation.mutate(plan)}
                >
                  Réactiver
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <form
        className="space-y-3 border-t border-border-on-card pt-4"
        noValidate
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <h4 className="font-sans text-sm font-semibold text-on-card">
          {editing ? `Modifier « ${editing.name} »` : 'Nouvelle formule'}
        </h4>
        <Field label="Nom" htmlFor="plan-name" error={errors.name?.message}>
          <Input id="plan-name" invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prix mensuel" htmlFor="plan-price" error={errors.priceCents?.message}>
            <Controller
              control={form.control}
              name="priceCents"
              render={({ field }) => (
                <MoneyInput
                  id="plan-price"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.priceCents}
                  placeholder="49,90"
                />
              )}
            />
          </Field>
          <Field
            label="Séances par semaine"
            htmlFor="plan-sessions"
            error={errors.sessionsPerWeek?.message}
          >
            <Input
              id="plan-sessions"
              type="number"
              min="1"
              max="14"
              invalid={!!errors.sessionsPerWeek}
              {...form.register('sessionsPerWeek')}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={saveMutation.isPending}>
            {editing ? 'Enregistrer les modifications' : 'Créer la formule'}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                form.reset(PLAN_DEFAULTS);
              }}
            >
              Annuler
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
