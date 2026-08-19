import { RIDER_LEVEL_LABELS, RIDER_LEVEL_VALUES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  createCourse,
  fetchInstructors,
  fetchPlanning,
  fetchSpaces,
  runCompatibilityAudit,
} from '@/features/admin/api.js';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';
import { isRidingSpaceType } from '@/lib/spaceOccupancy.js';

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
  const [createOpen, setCreateOpen] = useState(true);

  const { data: events = [], isPending, isError, error, refetch } = useQuery({
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

  const handleCreate = (event) => {
    event.preventDefault();
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

  const busy = createMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Planning"
        description="Semaine 7 h – 21 h. Le formulaire de création est sous le calendrier pour laisser la grille lisible."
        action={
          <Button type="button" variant="secondary" loading={auditMutation.isPending} onClick={() => auditMutation.mutate()}>
            Lancer l&apos;audit compatibilité
          </Button>
        }
      />

      {status ? (
        <Alert variant={status.includes('créé') ? 'success' : 'error'}>{status}</Alert>
      ) : null}

      <QueryState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton lines={8} />}
      >
        <PlanningCalendar
          events={events}
          scope={scope}
          onScopeChange={setScope}
          onDatesChange={setRange}
        />
      </QueryState>

      <section className="rounded-xl border border-border-on-card bg-card text-on-card">
        <h2 className="m-0">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-4 text-left font-sans text-lg font-semibold text-on-card"
            aria-expanded={createOpen}
            aria-controls="admin-create-course"
            onClick={() => setCreateOpen((open) => !open)}
          >
            Créer un cours
            <ChevronDown
              aria-hidden="true"
              className={`size-5 shrink-0 text-muted-on-card transition-transform duration-150 motion-reduce:transition-none ${createOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </h2>

        <form
          id="admin-create-course"
          hidden={!createOpen}
          className="border-t border-border-on-card p-5"
          onSubmit={handleCreate}
        >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Titre" htmlFor="course-title">
                <Input
                  id="course-title"
                  name="title"
                  required
                  autoComplete="off"
                  disabled={busy}
                  value={form.title}
                  onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                />
              </Field>
              <Field label="Moniteur" htmlFor="course-instructor">
                <Select
                  id="course-instructor"
                  name="instructorId"
                  required
                  disabled={busy}
                  value={form.instructorId}
                  onChange={(e) => setForm((c) => ({ ...c, instructorId: e.target.value }))}
                  options={[
                    { value: '', label: 'Choisir un moniteur' },
                    ...instructors.map((i) => ({
                      value: i.id,
                      label: `${i.firstName} ${i.lastName}`,
                    })),
                  ]}
                />
              </Field>
              <Field label="Lieu de cours" htmlFor="course-space">
                <Select
                  id="course-space"
                  name="spaceId"
                  required
                  disabled={busy}
                  value={form.spaceId}
                  onChange={(e) => setForm((c) => ({ ...c, spaceId: e.target.value }))}
                  options={[
                    { value: '', label: 'Choisir un espace' },
                    ...spaces
                      .filter((s) => isRidingSpaceType(s.type))
                      .map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </Field>
              <Field label="Capacité" htmlFor="course-capacity">
                <Input
                  id="course-capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  required
                  disabled={busy}
                  value={form.capacity}
                  onChange={(e) => setForm((c) => ({ ...c, capacity: Number(e.target.value || 0) }))}
                />
              </Field>
              <Field label="Début" htmlFor="course-start" hint="Date et heure de la première séance">
                <Input
                  id="course-start"
                  name="startAt"
                  type="datetime-local"
                  required
                  disabled={busy}
                  lang="fr"
                  value={form.startAt}
                  onChange={(e) => setForm((c) => ({ ...c, startAt: e.target.value }))}
                />
              </Field>
              <Field label="Fin" htmlFor="course-end" hint="Date et heure de fin de la première séance">
                <Input
                  id="course-end"
                  name="endAt"
                  type="datetime-local"
                  required
                  disabled={busy}
                  lang="fr"
                  value={form.endAt}
                  onChange={(e) => setForm((c) => ({ ...c, endAt: e.target.value }))}
                />
              </Field>
              <Field label="Niveau min" htmlFor="course-min-level">
                <Select
                  id="course-min-level"
                  name="minLevel"
                  required
                  disabled={busy}
                  value={form.minLevel}
                  onChange={(e) => setForm((c) => ({ ...c, minLevel: e.target.value }))}
                  options={levelOptions}
                />
              </Field>
              <Field label="Niveau max" htmlFor="course-max-level">
                <Select
                  id="course-max-level"
                  name="maxLevel"
                  required
                  disabled={busy}
                  value={form.maxLevel}
                  onChange={(e) => setForm((c) => ({ ...c, maxLevel: e.target.value }))}
                  options={levelOptions}
                />
              </Field>
              <Field
                label="Fin de récurrence"
                htmlFor="course-recurrence-end"
                hint="Optionnel. Si renseigné, le cours est répété chaque semaine jusqu’à cette date."
                className="sm:col-span-2 xl:col-span-3"
              >
                <Input
                  id="course-recurrence-end"
                  name="recurrenceEndDate"
                  type="datetime-local"
                  disabled={busy}
                  lang="fr"
                  value={form.recurrenceEndDate}
                  onChange={(e) => setForm((c) => ({ ...c, recurrenceEndDate: e.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-6">
              <Button type="submit" loading={busy}>
                Créer le cours
              </Button>
            </div>
        </form>
      </section>

      {auditMutation.data ? (
        <Card title="Rapport d'audit">
          <ul className="space-y-3">
            {auditMutation.data.map((entry) => (
              <li key={entry.courseId} className="rounded-xl border border-border-on-card bg-paper p-3">
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
