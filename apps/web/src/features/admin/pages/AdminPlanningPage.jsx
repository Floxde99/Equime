import { RIDER_LEVEL_LABELS, RIDER_LEVEL_VALUES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import {
  createCourse,
  fetchInstructors,
  fetchPlanning,
  fetchSpaces,
  runCompatibilityAudit,
} from '@/features/admin/api.js';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';

const DEFAULT_RANGE = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  to: new Date(new Date().setDate(new Date().getDate() + 35)).toISOString(),
};

const initialCourseForm = {
  title: '',
  instructorId: '',
  spaceId: '',
  startAt: '',
  endAt: '',
  capacity: 8,
  minLevel: 'galop_1',
  maxLevel: 'galop_3',
  recurrenceEndDate: '',
};

/** Planning admin — vue structure + création de cours récurrents (US-4.1). */
export function AdminPlanningPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState('all');
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [form, setForm] = useState(initialCourseForm);
  const [status, setStatus] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });
  const { data: instructors = [] } = useQuery({
    queryKey: ['admin-instructors'],
    queryFn: fetchInstructors,
  });
  const { data: spaces = [] } = useQuery({
    queryKey: ['admin-spaces'],
    queryFn: fetchSpaces,
  });

  const auditMutation = useMutation({ mutationFn: runCompatibilityAudit });
  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planning'] });
      setForm(initialCourseForm);
      setStatus('Cours récurrent créé.');
    },
    onError: (err) => setStatus(err.message),
  });

  const levelOptions = RIDER_LEVEL_VALUES.map((value) => ({
    value,
    label: RIDER_LEVEL_LABELS[value],
  }));

  const handleCreate = () => {
    const body = {
      title: form.title,
      instructorId: form.instructorId,
      spaceId: form.spaceId,
      startAt: form.startAt,
      endAt: form.endAt,
      capacity: form.capacity,
      minLevel: form.minLevel,
      maxLevel: form.maxLevel,
      status: 'scheduled',
    };
    if (form.recurrenceEndDate) {
      body.recurrenceRule = 'weekly';
      body.recurrenceEndDate = form.recurrenceEndDate;
    }
    createMutation.mutate(body);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-text">Planning</h1>
        <Button type="button" variant="secondary" loading={auditMutation.isPending} onClick={() => auditMutation.mutate()}>
          Lancer l&apos;audit compatibilité
        </Button>
      </div>

      {status ? (
        <Alert variant={status.includes('créé') ? 'success' : 'error'}>{status}</Alert>
      ) : null}

      <Card title="Créer un cours récurrent">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titre" htmlFor="course-title">
            <Input
              id="course-title"
              value={form.title}
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
            />
          </Field>
          <Select
            label="Moniteur"
            value={form.instructorId}
            onChange={(e) => setForm((c) => ({ ...c, instructorId: e.target.value }))}
            options={[
              { value: '', label: 'Choisir…' },
              ...instructors.map((i) => ({
                value: i.id,
                label: `${i.firstName} ${i.lastName}`,
              })),
            ]}
          />
          <Select
            label="Espace"
            value={form.spaceId}
            onChange={(e) => setForm((c) => ({ ...c, spaceId: e.target.value }))}
            options={[
              { value: '', label: 'Choisir…' },
              ...spaces.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Field label="Capacité" htmlFor="course-capacity">
            <Input
              id="course-capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((c) => ({ ...c, capacity: Number(e.target.value || 0) }))}
            />
          </Field>
          <Field label="Début" htmlFor="course-start">
            <Input
              id="course-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((c) => ({ ...c, startAt: e.target.value }))}
            />
          </Field>
          <Field label="Fin" htmlFor="course-end">
            <Input
              id="course-end"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((c) => ({ ...c, endAt: e.target.value }))}
            />
          </Field>
          <Select
            label="Niveau min"
            value={form.minLevel}
            onChange={(e) => setForm((c) => ({ ...c, minLevel: e.target.value }))}
            options={levelOptions}
          />
          <Select
            label="Niveau max"
            value={form.maxLevel}
            onChange={(e) => setForm((c) => ({ ...c, maxLevel: e.target.value }))}
            options={levelOptions}
          />
          <Field label="Fin de récurrence (hebdo)" htmlFor="course-recurrence-end" className="md:col-span-2">
            <Input
              id="course-recurrence-end"
              type="datetime-local"
              value={form.recurrenceEndDate}
              onChange={(e) => setForm((c) => ({ ...c, recurrenceEndDate: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" loading={createMutation.isPending} onClick={handleCreate}>
            Créer le cours
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted">Chargement…</p>
      ) : (
        <PlanningCalendar
          events={events}
          scope={scope}
          onScopeChange={setScope}
          onDatesChange={setRange}
        />
      )}
      {auditMutation.data ? (
        <Card title="Rapport d'audit">
          <ul className="space-y-3">
            {auditMutation.data.map((entry) => (
              <li key={entry.courseId} className="rounded-lg border border-border p-3">
                <p className="font-sans text-sm font-semibold text-text">{entry.courseTitle}</p>
                <p className="font-sans text-sm text-muted">
                  {entry.assignments.length} attribution(s) simulée(s) · {entry.conflicts.length} conflit(s)
                </p>
                {entry.conflicts.length > 0 ? (
                  <ul className="mt-2 space-y-1 font-sans text-xs text-warning">
                    {entry.conflicts.map((conflict) => (
                      <li key={conflict.enrollmentId}>
                        {conflict.riderName} — {conflict.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
