import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import { createIncident, fetchIncidents, resolveIncident } from '@/features/engagement/api.js';

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Élevée' },
  { value: 'critical', label: 'Critique' },
];

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
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('');

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents', admin ? 'admin' : 'instructor'],
    queryFn: () => fetchIncidents(admin ? { status: 'open' } : {}),
    enabled: admin,
  });

  const createMutation = useMutation({
    mutationFn: createIncident,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      setForm(initialForm);
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
      <div>
        <h1 className="font-display text-3xl text-text">{admin ? 'Incidents' : 'Déclarer un incident'}</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          {admin
            ? 'Suivi des incidents ouverts avec résolution côté administration.'
            : 'Tracez les événements de sécurité observés pendant la séance.'}
        </p>
      </div>

      {status ? <Alert variant={status.includes('déclaré') ? 'success' : 'error'}>{status}</Alert> : null}

      {!admin ? (
        <Card title="Nouvelle déclaration">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Identifiant cavalier (optionnel)" htmlFor="incident-rider">
              <Input
                id="incident-rider"
                value={form.riderId}
                onChange={(e) => setForm((current) => ({ ...current, riderId: e.target.value }))}
              />
            </Field>
            <Field label="Identifiant cheval (optionnel)" htmlFor="incident-horse">
              <Input
                id="incident-horse"
                value={form.horseId}
                onChange={(e) => setForm((current) => ({ ...current, horseId: e.target.value }))}
              />
            </Field>
            <Field label="Identifiant cours (optionnel)" htmlFor="incident-course">
              <Input
                id="incident-course"
                value={form.courseId}
                onChange={(e) => setForm((current) => ({ ...current, courseId: e.target.value }))}
              />
            </Field>
            <Select
              label="Gravité"
              value={form.severity}
              onChange={(e) => setForm((current) => ({ ...current, severity: e.target.value }))}
              options={SEVERITY_OPTIONS}
            />
            <Field label="Date / heure" htmlFor="incident-occurred">
              <Input
                id="incident-occurred"
                type="datetime-local"
                value={form.occurredAt}
                onChange={(e) => setForm((current) => ({ ...current, occurredAt: e.target.value }))}
              />
            </Field>
            <Field label="Description" htmlFor="incident-description" className="md:col-span-2">
              <textarea
                id="incident-description"
                rows={5}
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-text"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Button type="button" loading={createMutation.isPending} onClick={() => createMutation.mutate(form)}>
              Déclarer
            </Button>
          </div>
        </Card>
      ) : (
        <Card title="Incidents ouverts">
          <ul className="space-y-3">
            {incidents.map((incident) => (
              <li key={incident.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-sm font-semibold text-text">
                      Gravité : {incident.severity}
                    </p>
                    <p className="font-sans text-sm text-muted">{incident.description}</p>
                  </div>
                  {incident.status === 'open' ? (
                    <Button type="button" variant="secondary" onClick={() => resolveMutation.mutate(incident.id)}>
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
