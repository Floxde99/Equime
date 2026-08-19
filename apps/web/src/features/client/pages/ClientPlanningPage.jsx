import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchPlanning } from '@/features/admin/api.js';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';

const DEFAULT_RANGE = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  to: new Date(new Date().setDate(new Date().getDate() + 21)).toISOString(),
};

/** Page planning client — inscriptions famille visibles (US-4.2). */
export function ClientPlanningPage() {
  const [scope, setScope] = useState('mine');
  const [range, setRange] = useState(DEFAULT_RANGE);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Planning</h1>
        <p className="mt-1 font-sans text-sm text-muted">Vos séances et celles du centre.</p>
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
    </div>
  );
}
