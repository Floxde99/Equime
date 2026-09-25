import { createDiscountRuleSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog } from '@/components/ui/dialog.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  createDiscountRule,
  deleteDiscountRule,
  updateDiscountRule,
} from '@/features/billing/api.js';

const RULE_DEFAULTS = { label: '', percentage: 10, minRiders: 2 };

/**
 * Réductions famille : création, modification, suppression.
 * @param {{ rules: Array<{ id: string, label: string, percentage: number, minRiders?: number | null }> }} props
 */
export function DiscountRuleManager({ rules }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(
    /** @type {null | { id: string, label: string }} */ (null)
  );
  const [pendingDelete, setPendingDelete] = useState(
    /** @type {null | { id: string, label: string }} */ (null)
  );
  const [feedback, setFeedback] = useState(
    /** @type {null | { type: 'success' | 'error', message: string }} */ (null)
  );
  const form = useForm({
    resolver: zodResolver(createDiscountRuleSchema),
    defaultValues: RULE_DEFAULTS,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['discount-rules'] });

  const saveMutation = useMutation({
    mutationFn: (values) =>
      editing ? updateDiscountRule(editing.id, values) : createDiscountRule(values),
    onSuccess: (rule) => {
      setFeedback({
        type: 'success',
        message: editing
          ? `Réduction « ${rule.label} » modifiée.`
          : `Réduction « ${rule.label} » créée.`,
      });
      setEditing(null);
      form.reset(RULE_DEFAULTS);
      refresh();
    },
    onError: (err) => setFeedback({ type: 'error', message: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (rule) => deleteDiscountRule(rule.id),
    onSuccess: (_data, rule) => {
      setFeedback({ type: 'success', message: `Réduction « ${rule.label} » supprimée.` });
      setPendingDelete(null);
      refresh();
    },
    onError: (err) => {
      setPendingDelete(null);
      setFeedback({ type: 'error', message: err.message });
    },
  });

  const errors = form.formState.errors;

  return (
    <Card title="Réductions famille">
      {feedback ? (
        <Alert variant={feedback.type} className="mb-4">
          {feedback.message}
        </Alert>
      ) : null}

      <ul className="mb-5 space-y-2">
        {rules.length === 0 ? (
          <li className="font-sans text-sm text-muted-on-card">Aucune réduction.</li>
        ) : null}
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-on-card bg-paper p-3"
          >
            <div>
              <p className="font-sans text-sm font-semibold text-on-card">{rule.label}</p>
              <p className="font-sans text-sm text-muted-on-card">
                −{rule.percentage} %
                {rule.minRiders
                  ? ` à partir de ${rule.minRiders} cavaliers`
                  : ' pour toutes les familles'}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(rule);
                  setFeedback(null);
                  form.reset({
                    label: rule.label,
                    percentage: rule.percentage,
                    minRiders: rule.minRiders ?? undefined,
                  });
                }}
              >
                Modifier
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPendingDelete(rule)}>
                Supprimer
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form
        className="space-y-3 border-t border-border-on-card pt-4"
        noValidate
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <h4 className="font-sans text-sm font-semibold text-on-card">
          {editing ? `Modifier « ${editing.label} »` : 'Nouvelle réduction'}
        </h4>
        <Field label="Libellé" htmlFor="rule-label" error={errors.label?.message}>
          <Input
            id="rule-label"
            placeholder="Réduction fratrie"
            invalid={!!errors.label}
            {...form.register('label')}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Réduction" htmlFor="rule-percentage" error={errors.percentage?.message}>
            <div id="rule-percentage-field" className="relative">
              <Input
                id="rule-percentage"
                type="number"
                min="1"
                max="100"
                className="pr-10"
                invalid={!!errors.percentage}
                {...form.register('percentage')}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-on-card"
              >
                %
              </span>
            </div>
          </Field>
          <Field
            label="À partir de (cavaliers)"
            htmlFor="rule-min-riders"
            hint="Vide : toutes les familles."
            error={errors.minRiders?.message}
          >
            <Input
              id="rule-min-riders"
              type="number"
              min="1"
              invalid={!!errors.minRiders}
              {...form.register('minRiders', {
                setValueAs: (value) => (value === '' || value == null ? undefined : Number(value)),
              })}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={saveMutation.isPending}>
            {editing ? 'Enregistrer les modifications' : 'Créer la réduction'}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                form.reset(RULE_DEFAULTS);
              }}
            >
              Annuler
            </Button>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        title={`Supprimer la réduction « ${pendingDelete?.label ?? ''} » ?`}
        description="Les factures déjà émises ne changent pas. Les prochaines factures ne l’appliqueront plus."
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
      />
    </Card>
  );
}
