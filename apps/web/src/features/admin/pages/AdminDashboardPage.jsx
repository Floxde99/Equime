import { HORSE_STATUS_LABELS } from '@equime/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Receipt, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Card } from '@/components/ui/card.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { fetchDashboardKpis, fetchHorses, fetchLoadAlerts } from '@/features/admin/api.js';
import { fetchCriticalIncidentCount } from '@/features/engagement/api.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Formate des centimes en euros. @param {number} cents */
function formatEuros(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

const HORSE_VARIANT = { fit: 'success', rest: 'warning', unavailable: 'default', injured: 'danger' };

const SHORTCUTS = [
  { to: '/admin/planning', label: 'Planning', hint: 'Cours et séances', icon: CalendarDays },
  { to: '/admin/cavalerie', label: 'Cavalerie', hint: 'Chevaux et espaces', icon: HorseIcon },
  { to: '/admin/clients', label: 'Clients', hint: 'Membres et documents', icon: Users },
  { to: '/admin/facturation', label: 'Facturation', hint: 'Factures et abonnements', icon: Receipt },
];

/** Tableau de bord admin — KPIs réels, cavalerie illustrée (maquette Stitch). */
export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: kpis, isPending, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: fetchDashboardKpis,
  });
  const { data: alertHorses = [] } = useQuery({
    queryKey: ['load-alerts'],
    queryFn: fetchLoadAlerts,
  });
  const { data: horses = [] } = useQuery({ queryKey: ['admin-horses'], queryFn: fetchHorses });
  const { data: criticalIncidents = 0 } = useQuery({
    queryKey: ['critical-incidents-count'],
    queryFn: fetchCriticalIncidentCount,
  });

  const occupancy = kpis?.courseOccupancyPercent ?? 0;
  const featured = horses.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-primary">Vue d&apos;ensemble</h1>
        <p className="mt-1 font-sans text-lg text-muted">
          Bienvenue {user?.firstName}. Voici l&apos;activité du centre aujourd&apos;hui.
        </p>
      </div>

      <QueryState isPending={isPending} isError={isError} error={error} onRetry={refetch}>
        <div className="space-y-8">
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 flex h-56 flex-col justify-between md:col-span-4">
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-on-card">
                Occupation des cours
              </p>
              <p className="mt-4 font-display text-5xl text-primary">{kpis ? `${occupancy} %` : '—'}</p>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(occupancy, 100)}%` }} />
              </div>
              <p className="mt-2 font-sans text-xs text-muted-on-card">
                {kpis?.upcomingCoursesCount ?? 0} séance(s) à venir
              </p>
            </div>
          </Card>
          <Card className="col-span-12 flex h-56 flex-col justify-between md:col-span-4">
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-on-card">
              Chevaux en alerte charge
            </p>
            <p className="font-display text-5xl text-on-card">
              {kpis?.horsesInLoadAlert ?? alertHorses.length}
            </p>
            <p className="font-sans text-xs text-muted-on-card">Seuil hebdomadaire dépassé</p>
          </Card>
          <Card className="col-span-12 flex h-56 flex-col justify-between md:col-span-4">
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-on-card">
              CA du mois
            </p>
            <p className="font-display text-5xl text-primary">
              {kpis ? formatEuros(kpis.revenueCents) : '—'}
            </p>
            <p className="font-sans text-xs text-muted-on-card">
              {kpis?.paidInvoicesCount ?? 0} facture(s) payée(s) — {kpis?.pendingDocumentsCount ?? 0}{' '}
              doc(s) en attente
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-display text-2xl text-primary">Cavalerie</h2>
              <Link to="/admin/cavalerie" className="font-sans text-sm text-primary hover:underline">
                Annuaire →
              </Link>
            </div>
            {featured.length === 0 ? (
              <p className="font-sans text-sm text-muted-on-card">Aucun cheval enregistré.</p>
            ) : (
              <ul className="space-y-4">
                {featured.map((horse) => {
                  const load = horse.maxWeeklyLoadHours
                    ? Math.min(100, Math.round((horse.weeklyLoadHours / horse.maxWeeklyLoadHours) * 100))
                    : 0;
                  return (
                    <li key={horse.id}>
                      <Link
                        to={`/admin/cavalerie/${horse.id}`}
                        className="flex items-center gap-4 rounded-lg outline-offset-4 hover:bg-paper"
                      >
                        <HorsePortrait horse={horse} alt="" className="size-16 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-sans text-sm font-semibold text-on-card">{horse.name}</p>
                            <Badge variant={HORSE_VARIANT[horse.status] ?? 'default'}>
                              {HORSE_STATUS_LABELS[horse.status] ?? horse.status}
                            </Badge>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden="true">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${load}%` }} />
                          </div>
                          <p className="mt-1 font-sans text-xs text-muted-on-card">
                            {horse.weeklyLoadHours}h / {horse.maxWeeklyLoadHours}h
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {SHORTCUTS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className="block">
                  <Card className="h-full transition-colors hover:bg-paper">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <h2 className="mt-2 font-display text-xl text-on-card">{item.label}</h2>
                    <p className="mt-1 font-sans text-sm text-muted-on-card">{item.hint}</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(kpis?.pendingDocumentsCount ?? 0) > 0 ? (
            <section className="rounded-xl bg-danger/10 p-5">
              <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-danger">
                Documents en attente
              </h2>
              <p className="mt-2 font-sans text-sm text-on-card">
                {kpis.pendingDocumentsCount} document(s) à valider.
              </p>
              <Link to="/admin/clients" className="mt-3 inline-block font-sans text-xs font-semibold uppercase text-danger">
                Traiter
              </Link>
            </section>
          ) : null}
          {alertHorses.length > 0 ? (
            <section className="rounded-xl bg-warning/15 p-5">
              <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-warning">
                Charge cavalerie
              </h2>
              <ul className="mt-2 space-y-1 font-sans text-sm text-on-card">
                {alertHorses.slice(0, 3).map((h) => (
                  <li key={h.id}>
                    <Link to={`/admin/cavalerie/${h.id}`} className="hover:underline">
                      {h.name} — {h.weeklyLoadHours}h / {h.maxWeeklyLoadHours}h
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {criticalIncidents > 0 ? (
            <section className="rounded-xl bg-paper p-5">
              <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-on-card">
                Incidents critiques
              </h2>
              <p className="mt-2 font-sans text-sm text-on-card">
                {criticalIncidents} incident(s) demandent une résolution.
              </p>
              <Link to="/admin/incidents" className="mt-3 inline-block font-sans text-xs font-semibold uppercase text-primary">
                Ouvrir
              </Link>
            </section>
          ) : null}
        </div>
        </div>
      </QueryState>
    </div>
  );
}
