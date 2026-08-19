import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { fetchPlanning, runCompatibilityAudit } from '@/features/admin/api.js';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';

const DEFAULT_RANGE = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  to: new Date(new Date().setDate(new Date().getDate() + 35)).toISOString(),
};

/** Planning admin — vue structure complète. */
export function AdminPlanningPage() {
  const [scope, setScope] = useState('all');
  const [range, setRange] = useState(DEFAULT_RANGE);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });
  const auditMutation = useMutation({ mutationFn: runCompatibilityAudit });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-text">Planning</h1>
        <Button type="button" variant="secondary" loading={auditMutation.isPending} onClick={() => auditMutation.mutate()}>
          Lancer l&apos;audit compatibilité
        </Button>
      </div>
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
