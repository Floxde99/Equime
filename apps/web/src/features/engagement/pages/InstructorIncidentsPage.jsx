import { createIncidentSchema, ROLES } from '@equime/shared';
import { INCIDENT_SEVERITY_VALUES } from '@equime/shared/constants';
import { INCIDENT_SEVERITY_LABELS } from '@equime/shared/labels';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FeedbackAlert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { fetchEnrollments, fetchHorses, fetchPlanning } from '@/features/admin/api.js';
import { createIncident, fetchIncidents, resolveIncident } from '@/features/engagement/api.js';
import { formatDateTime } from '@/lib/dates.js';
import { blankToUndefined, toDatetimeLocalValue } from '@/lib/formValues.js';
import { useFeedback } from '@/lib/useFeedback.js';
import { useAuthStore } from '@/stores/authStore.js';

const SEVERITY_OPTIONS = INCIDENT_SEVERITY_VALUES.map((value) => ({
  value,
  label: INCIDENT_SEVERITY_LABELS[value],
}));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Séances récentes proposées : 7 derniers jours et journée en cours. */
function recentRange() {
  const now = Date.now();
  return {
    from: new Date(now - 7 * DAY_MS).toISOString(),
    to: new Date(now + DAY_MS).toISOString(),
  };
}

function initialForm() {
  return {
    riderId: '',
    horseId: '',
    courseId: '',
    severity: 'medium',
    occurredAt: toDatetimeLocalValue(new Date()),
    description: '',
  };
}

/** Déclaration d'incident : on choisit la séance, le cavalier et le cheval, sans saisir d'identifiant. */
export function InstructorIncidentsPage() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  const role = useAuthStore((state) => state.user?.role);
  const [range] = useState(recentRange);
  const incidentForm = useForm({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: initialForm(),
  });
  const courseId = useWatch({ control: incidentForm.control, name: 'courseId' });

  // Un admin voit toutes les séances ; un moniteur, les siennes.
  const scope = role === ROLES.ADMIN ? 'all' : 'mine';
  const { data: sessions = [] } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: () => fetchEnrollments(courseId),
    enabled: Boolean(courseId),
  });
  const { data: horses = [] } = useQuery({ queryKey: ['horses'], queryFn: fetchHorses });

  const createMutation = useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      incidentForm.reset(initialForm());
      feedback.success('Incident déclaré. L’administration est prévenue.');
    },
    onError: (err) => feedback.error(err.message),
  });

  const recentSessions = [...sessions].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
  );
  const errors = incidentForm.formState.errors;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace moniteur"
        title="Déclarer un incident"
        description="Tracez les événements de sécurité observés pendant une séance."
      />

      <FeedbackAlert feedback={feedback.value} />

      <Card title="Nouvelle déclaration">
        <form
          className="grid gap-4 md:grid-cols-2"
          noValidate
          onSubmit={incidentForm.handleSubmit((values) => createMutation.mutate(values))}
        >
          <Select
            id="incident-course"
            label="Séance (facultatif)"
            error={errors.courseId?.message}
            options={[
              { value: '', label: '— Hors séance —' },
              ...recentSessions.map((session) => ({
                value: session.id,
                label: `${session.title} · ${formatDateTime(session.start)}`,
              })),
            ]}
            {...incidentForm.register('courseId', {
              setValueAs: blankToUndefined,
              // Changer de séance réinitialise le cavalier choisi
              onChange: () => incidentForm.setValue('riderId', ''),
            })}
          />
          <Select
            id="incident-rider"
            label="Cavalier concerné (facultatif)"
            error={errors.riderId?.message}
            disabled={!courseId}
            options={[
              { value: '', label: courseId ? '— Aucun —' : 'Choisissez d’abord une séance' },
              ...enrollments.map((enrollment) => ({
                value: enrollment.rider.id,
                label: `${enrollment.rider.firstName} ${enrollment.rider.lastName}${
                  enrollment.horse ? ` (sur ${enrollment.horse.name})` : ''
                }`,
              })),
            ]}
            {...incidentForm.register('riderId', {
              setValueAs: blankToUndefined,
              // Le cheval monté par ce cavalier est présélectionné
              onChange: (event) => {
                const enrollment = enrollments.find((e) => e.rider.id === event.target.value);
                if (enrollment?.horse) incidentForm.setValue('horseId', enrollment.horse.id);
              },
            })}
          />
          <Select
            id="incident-horse"
            label="Cheval concerné (facultatif)"
            error={errors.horseId?.message}
            options={[
              { value: '', label: '— Aucun —' },
              ...horses.map((horse) => ({ value: horse.id, label: horse.name })),
            ]}
            {...incidentForm.register('horseId', { setValueAs: blankToUndefined })}
          />
          <Select
            id="incident-severity"
            label="Gravité"
            error={errors.severity?.message}
            options={SEVERITY_OPTIONS}
            {...incidentForm.register('severity')}
          />
          <Field
            label="Date / heure"
            htmlFor="incident-occurred"
            error={incidentForm.formState.errors.occurredAt?.message}
          >
            <Input
              id="incident-occurred"
              type="datetime-local"
              invalid={!!incidentForm.formState.errors.occurredAt}
              {...incidentForm.register('occurredAt')}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="incident-description"
            className="md:col-span-2"
            error={incidentForm.formState.errors.description?.message}
          >
            <Textarea
              id="incident-description"
              rows={5}
              invalid={!!incidentForm.formState.errors.description}
              {...incidentForm.register('description')}
            />
          </Field>
          <div className="md:col-span-2">
            <Button type="submit" loading={createMutation.isPending}>
              Déclarer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/** Suivi et résolution des incidents ouverts (admin). */
export function AdminIncidentsPage() {
  const qc = useQueryClient();

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', 'admin'],
    queryFn: () => fetchIncidents({ status: 'open' }),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Incidents"
        description="Suivi des incidents ouverts avec résolution côté administration."
      />

      <Card title="Incidents ouverts">
        <ul className="space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-xl border border-border-on-card bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-sans text-sm font-semibold text-text">
                    Gravité : {INCIDENT_SEVERITY_LABELS[incident.severity] ?? incident.severity}
                  </p>
                  <p className="font-sans text-sm text-muted">{incident.description}</p>
                </div>
                {incident.status === 'open' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => resolveMutation.mutate(incident.id)}
                  >
                    Résoudre
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {incidents.length === 0 ? (
            <p className="font-sans text-sm text-muted">Aucun incident ouvert.</p>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
