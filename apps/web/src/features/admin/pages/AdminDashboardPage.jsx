import { useQuery } from '@tanstack/react-query';

import { fetchLoadAlerts } from '@/features/admin/api.js';
import { fetchCriticalIncidentCount } from '@/features/engagement/api.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Tableau de bord admin — alertes charge cavalerie (US-3.1). */
export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: alertHorses = [] } = useQuery({
    queryKey: ['load-alerts'],
    queryFn: fetchLoadAlerts,
  });
  const { data: criticalIncidents = 0 } = useQuery({
    queryKey: ['critical-incidents-count'],
    queryFn: fetchCriticalIncidentCount,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Tableau de bord</h1>
        <p className="mt-2 font-sans text-muted">
          Bienvenue {user?.firstName} — indicateurs détaillés en Phase 4.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">Chevaux en alerte charge</p>
          <p className="mt-2 font-display text-4xl text-primary">{alertHorses.length}</p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">Incidents critiques ouverts</p>
          <p className="mt-2 font-display text-4xl text-text">{criticalIncidents}</p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">Chiffre d&apos;affaires</p>
          <p className="mt-2 font-display text-4xl text-text">—</p>
        </section>
      </div>

      {alertHorses.length > 0 ? (
        <section className="rounded-xl border border-warning/30 bg-warning/15 p-5">
          <h2 className="font-sans text-lg font-semibold text-warning">Charge cavalerie</h2>
          <ul className="mt-2 space-y-1 font-sans text-sm text-text">
            {alertHorses.map((h) => (
              <li key={h.id}>
                {h.name} — {h.weeklyLoadHours}h / {h.maxWeeklyLoadHours}h
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {criticalIncidents > 0 ? (
        <section className="rounded-xl border border-danger/30 bg-danger/15 p-5">
          <h2 className="font-sans text-lg font-semibold text-danger">Incidents critiques</h2>
          <p className="mt-2 font-sans text-sm text-text">
            {criticalIncidents} incident(s) critique(s) demandent une résolution admin.
          </p>
        </section>
      ) : null}
    </div>
  );
}
