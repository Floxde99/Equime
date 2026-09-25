import { clubSettingsSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forwardRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { FeedbackAlert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { fetchClubSettings, updateClubSettings } from '@/features/admin/api.js';
import { useFeedback } from '@/lib/useFeedback.js';

/** Case à cocher alignée sur les champs ; `forwardRef` requis par react-hook-form. */
const Toggle = forwardRef(function Toggle({ id, label, hint, ...props }, ref) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input ref={ref} id={id} type="checkbox" className="mt-1 size-4 accent-primary" {...props} />
      <span>
        <span className="block font-sans text-sm font-medium text-on-card">{label}</span>
        {hint ? <span className="block font-sans text-xs text-muted-on-card">{hint}</span> : null}
      </span>
    </label>
  );
});

/**
 * Paramètres du club : délais d'annulation et de rattrapage, saison, échéanciers,
 * règles documentaires. Les familles voient ces règles au moment de réserver.
 */
export function AdminSettingsPage() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  const query = useQuery({ queryKey: ['club-settings'], queryFn: fetchClubSettings });
  const form = useForm({ resolver: zodResolver(clubSettingsSchema) });

  useEffect(() => {
    if (query.data) form.reset(query.data);
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: updateClubSettings,
    onSuccess: (settings) => {
      qc.setQueryData(['club-settings'], settings);
      feedback.success('Paramètres enregistrés.');
    },
    onError: (err) => feedback.error(err.message),
  });

  const errors = form.formState.errors;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Paramètres du club"
        description="Règles appliquées aux réservations, aux rattrapages et aux échéanciers."
      />
      <FeedbackAlert feedback={feedback.value} />

      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={query.refetch}
      >
        <form
          className="space-y-6"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <Card title="Annulations et rattrapages">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Délai d’annulation (heures)"
                htmlFor="settings-deadline"
                hint="Une séance annulée au moins ce délai avant son début donne droit à un rattrapage."
                error={errors.cancellationDeadlineHours?.message}
              >
                <Input
                  type="number"
                  min="0"
                  max="168"
                  invalid={!!errors.cancellationDeadlineHours}
                  {...form.register('cancellationDeadlineHours')}
                />
              </Field>
              <Field
                label="Validité d’un rattrapage (jours)"
                htmlFor="settings-makeup"
                hint="Au-delà, le crédit de rattrapage expire."
                error={errors.makeupValidityDays?.message}
              >
                <Input
                  type="number"
                  min="7"
                  max="365"
                  invalid={!!errors.makeupValidityDays}
                  {...form.register('makeupValidityDays')}
                />
              </Field>
            </div>
          </Card>

          <Card title="Saison et échéanciers">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Début de saison (MM-JJ)"
                htmlFor="settings-season-start"
                error={errors.seasonStart?.message}
              >
                <Input
                  placeholder="09-01"
                  invalid={!!errors.seasonStart}
                  {...form.register('seasonStart')}
                />
              </Field>
              <Field
                label="Fin de saison (MM-JJ)"
                htmlFor="settings-season-end"
                error={errors.seasonEnd?.message}
              >
                <Input
                  placeholder="06-30"
                  invalid={!!errors.seasonEnd}
                  {...form.register('seasonEnd')}
                />
              </Field>
              <Field
                label="Jour des prélèvements en 10 fois"
                htmlFor="settings-installment-day"
                hint="Entre le 1 et le 28."
                error={errors.installmentDay?.message}
              >
                <Input
                  type="number"
                  min="1"
                  max="28"
                  invalid={!!errors.installmentDay}
                  {...form.register('installmentDay')}
                />
              </Field>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 font-sans text-sm font-medium uppercase tracking-wide text-muted-on-card">
                Échéances trimestrielles (MM-JJ)
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <Field
                    key={index}
                    label={`${index + 1}ᵉ échéance`}
                    htmlFor={`settings-quarter-${index}`}
                    error={errors.quarterDueDates?.[index]?.message}
                  >
                    <Input
                      invalid={!!errors.quarterDueDates?.[index]}
                      {...form.register(`quarterDueDates.${index}`)}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
            <div className="mt-4">
              <Toggle
                id="settings-prorata"
                label="Forfait au prorata en cas d’arrivée en cours de saison"
                hint="Le prix est calculé sur les semaines restantes."
                {...form.register('proRataOnLateJoin')}
              />
            </div>
          </Card>

          <Card title="Documents">
            <Toggle
              id="settings-minor-questionnaire"
              label="Mineurs : questionnaire de santé au lieu du certificat médical"
              hint="Conforme au décret n° 2021-564 : les mineurs attestent avoir rempli le questionnaire de santé."
              {...form.register('minorHealthQuestionnaire')}
            />
          </Card>

          <Button type="submit" loading={mutation.isPending}>
            Enregistrer les paramètres
          </Button>
        </form>
      </QueryState>
    </div>
  );
}
