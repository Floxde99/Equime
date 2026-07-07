import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Select } from '@/components/ui/select.jsx';
import {
  assignHorses,
  fetchEnrollments,
  fetchHorseOptions,
  fetchPlanning,
  overrideHorse,
} from '@/features/admin/api.js';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';

const DEFAULT_RANGE = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  to: new Date(new Date().setDate(new Date().getDate() + 21)).toISOString(),
};

/** Planning moniteur — filtre « mon planning » par défaut (US-4.2). */
export function InstructorPlanningPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState('mine');
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [courseId, setCourseId] = useState('');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['instructor-enrollments', courseId],
    queryFn: () => fetchEnrollments(courseId),
    enabled: Boolean(courseId),
  });

  const assignMutation = useMutation({
    mutationFn: assignHorses,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['instructor-enrollments', courseId] });
      qc.invalidateQueries({ queryKey: ['planning'] });
    },
  });
  const overrideMutation = useMutation({
    mutationFn: ({ enrollmentId, horseId }) => overrideHorse(courseId, enrollmentId, horseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['instructor-enrollments', courseId] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Mon planning</h1>
        <p className="mt-1 font-sans text-sm text-muted">Préparez vos séances à venir.</p>
      </div>
      {isLoading ? (
        <p className="font-sans text-muted">Chargement du calendrier…</p>
      ) : (
        <PlanningCalendar
          events={events}
          scope={scope}
          onScopeChange={setScope}
          onDatesChange={setRange}
        />
      )}

      <Card title="Attribution des chevaux">
        <div className="space-y-4">
          <Select
            label="Séance"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={[
              { value: '', label: '— Sélectionner —' },
              ...events.map((event) => ({
                value: event.id,
                label: `${event.title} (${new Date(event.start).toLocaleString('fr-FR')})`,
              })),
            ]}
          />
          {courseId ? (
            <Button type="button" loading={assignMutation.isPending} onClick={() => assignMutation.mutate(courseId)}>
              Attribution automatique
            </Button>
          ) : null}

          {assignMutation.data?.conflicts?.length ? (
            <div className="rounded-lg border border-warning/30 bg-warning/15 p-3">
              <p className="font-sans text-sm font-semibold text-warning">Conflits détectés</p>
              <ul className="mt-2 space-y-1 font-sans text-xs text-text">
                {assignMutation.data.conflicts.map((conflict) => (
                  <li key={conflict.enrollmentId}>
                    {conflict.riderName} — {conflict.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {courseId ? (
            <ul className="space-y-3">
              {enrollments.map((enrollment) => (
                <OverrideRow
                  key={enrollment.id}
                  courseId={courseId}
                  enrollment={enrollment}
                  onOverride={(horseId) => overrideMutation.mutate({ enrollmentId: enrollment.id, horseId })}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function OverrideRow({ courseId, enrollment, onOverride }) {
  const { data: options = [] } = useQuery({
    queryKey: ['horse-options', courseId, enrollment.id],
    queryFn: () => fetchHorseOptions(courseId, enrollment.id),
  });
  const [selectedHorseId, setSelectedHorseId] = useState(enrollment.horse?.id ?? '');

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-sm font-semibold text-text">
            {enrollment.rider.firstName} {enrollment.rider.lastName}
          </p>
          <p className="font-sans text-sm text-muted">
            Cheval actuel : {enrollment.horse?.name ?? 'Non attribué'}
          </p>
        </div>
        <div className="flex min-w-72 flex-wrap items-end gap-2">
          <Select
            label="Override manuel"
            value={selectedHorseId}
            onChange={(e) => setSelectedHorseId(e.target.value)}
            options={[
              { value: '', label: '— Choisir —' },
              ...options.map((option) => ({
                value: option.horseId,
                label: `${option.horseName} · score ${option.score}${option.warning ? ' · à éviter' : ''}`,
              })),
            ]}
          />
          <Button type="button" variant="secondary" onClick={() => onOverride(selectedHorseId)} disabled={!selectedHorseId}>
            Remplacer
          </Button>
        </div>
      </div>
    </li>
  );
}
