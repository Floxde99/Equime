import {
  createIncidentSchema,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_VALUES,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { createIncident, fetchIncidents, resolveIncident } from '@/features/engagement/api.js';
import { blankToUndefined } from '@/lib/formValues.js';

const SEVERITY_OPTIONS = INCIDENT_SEVERITY_VALUES.map((value) => ({
  value,
  label: INCIDENT_SEVERITY_LABELS[value],
}));

const initialForm = {
  riderId: '',
  horseId: '',
  courseId: '',
  severity: 'medium',
  occurredAt: '',
  description: '',
};

export function InstructorIncidentsPage({ admin = false }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const incidentForm = useForm({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: initialForm,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', admin ? 'admin' : 'instructor'],
    queryFn: () => fetchIncidents(admin ? { status: 'open' } : {}),
    enabled: admin,
  });

  const createMutation = useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      incidentForm.reset(initialForm);
      setStatus('Incident déclaré.');
    },
    onError: (err) => setStatus(err.message),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={admin ? 'Administration' : 'Espace moniteur'}
        title={admin ? 'Incidents' : 'Déclarer un incident'}
        description={
          admin
            ? 'Suivi des incidents ouverts avec résolution côté administration.'
            : 'Tracez les événements de sécurité observés pendant la séance.'
        }
      />

      {status ? (
        <Alert variant={status.includes('déclaré') ? 'success' : 'error'}>{status}</Alert>
      ) : null}

      {!admin ? (
        <Card title="Nouvelle déclaration">
          <form
            className="grid gap-4 md:grid-cols-2"
            noValidate
            onSubmit={incidentForm.handleSubmit((values) => createMutation.mutate(values))}
          >
            <Field
              label="Identifiant cavalier (optionnel)"
              htmlFor="incident-rider"
              error={incidentForm.formState.errors.riderId?.message}
            >
              <Input
                id="incident-rider"
                invalid={!!incidentForm.formState.errors.riderId}
                {...incidentForm.register('riderId', { setValueAs: blankToUndefined })}
              />
            </Field>
            <Field
              label="Identifiant cheval (optionnel)"
              htmlFor="incident-horse"
              error={incidentForm.formState.errors.horseId?.message}
            >
              <Input
                id="incident-horse"
                invalid={!!incidentForm.formState.errors.horseId}
                {...incidentForm.register('horseId', { setValueAs: blankToUndefined })}
              />
            </Field>
            <Field
              label="Identifiant cours (optionnel)"
              htmlFor="incident-course"
              error={incidentForm.formState.errors.courseId?.message}
            >
              <Input
                id="incident-course"
                invalid={!!incidentForm.formState.errors.courseId}
                {...incidentForm.register('courseId', { setValueAs: blankToUndefined })}
              />
            </Field>
            <Select
              id="incident-severity"
              label="Gravité"
              error={incidentForm.formState.errors.severity?.message}
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
      ) : (
        <Card title="Incidents ouverts">
          <ul className="space-y-3">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className="rounded-xl border border-border-on-card bg-paper p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-sm font-semibold text-text">
                      Gravité : {incident.severity}
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
      )}
    </div>
  );
}
