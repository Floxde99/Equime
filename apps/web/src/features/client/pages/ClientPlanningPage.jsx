import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { fetchPlanning } from '@/features/admin/api.js';
import { EnrollSection } from '@/features/client/components/EnrollSection.jsx';
import { UpcomingEnrollments } from '@/features/client/components/UpcomingEnrollments.jsx';
import { PlanningCalendar } from '@/features/planning/components/PlanningCalendar.jsx';

const DEFAULT_RANGE = {
  from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
  to: new Date(new Date().setDate(new Date().getDate() + 21)).toISOString(),
};

/** Page planning client — inscriptions famille visibles (US-4.2). */
export function ClientPlanningPage() {
  const [scope, setScope] = useState('mine');
  const [range, setRange] = useState(DEFAULT_RANGE);

  const {
    data: events = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['planning', range, scope],
    queryFn: () => fetchPlanning(range.from, range.to, scope),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace famille"
        title="Planning"
        description="Vos séances et celles du centre, en vue semaine (7 h – 21 h)."
      />
      <QueryState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={refetch}
        skeleton={<Skeleton lines={6} />}
      >
        <div className="space-y-6">
          <PlanningCalendar
            events={events}
            scope={scope}
            onScopeChange={setScope}
            onDatesChange={setRange}
          />
          <UpcomingEnrollments />
          <EnrollSection />
        </div>
      </QueryState>
    </div>
  );
}
