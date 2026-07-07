import { useQuery } from '@tanstack/react-query';

import {
  fetchDashboardKpis,
  fetchLoadAlerts,
} from '@/features/admin/api.js';
import { fetchCriticalIncidentCount } from '@/features/engagement/api.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Formate des centimes en euros. @param {number} cents */
function formatEuros(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    cents / 100
  );
}

/** Tableau de bord admin — KPIs réels (US-9.1). */
export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: fetchDashboardKpis,
  });
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
          Bienvenue {user?.firstName} — pilotage du centre.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">Occupation cours (7 j)</p>
          <p className="mt-2 font-display text-4xl text-text">
            {kpis ? `${kpis.courseOccupancyPercent} %` : '—'}
          </p>
          <p className="mt-1 font-sans text-xs text-muted">
            {kpis?.upcomingCoursesCount ?? 0} séance(s) à venir
          </p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">Chevaux en alerte charge</p>
          <p className="mt-2 font-display text-4xl text-text">
            {kpis?.horsesInLoadAlert ?? alertHorses.length}
          </p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="font-sans text-sm text-muted">CA du mois (factures payées)</p>
          <p className="mt-2 font-display text-4xl text-primary">
            {kpis ? formatEuros(kpis.revenueCents) : '—'}
          </p>
          <p className="mt-1 font-sans text-xs text-muted">
            {kpis?.paidInvoicesCount ?? 0} facture(s) — {kpis?.pendingDocumentsCount ?? 0} doc(s) en
            attente
          </p>
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
