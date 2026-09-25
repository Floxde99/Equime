import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Card } from '@/components/ui/card.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { fetchClientInvoices } from '@/features/billing/api.js';
import { useEntitlements } from '@/features/billing/useEntitlements.js';
import { UpcomingEnrollments } from '@/features/client/components/UpcomingEnrollments.jsx';
import { fetchHorses, fetchRiderAffinities, fetchRiders } from '@/features/riders/api.js';
import { formatDate } from '@/lib/dates.js';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Ligne d'un cavalier : séances du forfait prises cette semaine et rattrapages.
 * @param {{ rider: { firstName: string, subscription: object | null, sessionsPerWeek: number,
 *   usedThisWeek: number, credits: Array<{ expiresAt: string }> } }} props
 */
function RiderWeek({ rider }) {
  if (!rider.subscription) {
    return (
      <li className="font-sans text-sm text-primary-fg/80">{rider.firstName} : pas de forfait</li>
    );
  }
  const used = Math.min(rider.usedThisWeek, rider.sessionsPerWeek);
  return (
    <li className="font-sans text-sm">
      <span className="font-semibold">{rider.firstName}</span> · {used}/{rider.sessionsPerWeek}{' '}
      cette semaine
      {rider.credits.length > 0 ? (
        <span className="block text-xs text-primary-fg/80">
          {rider.credits.length} rattrapage{rider.credits.length > 1 ? 's' : ''} (avant le{' '}
          {formatDate(rider.credits[0].expiresAt)})
        </span>
      ) : null}
    </li>
  );
}

/** Tableau de bord famille — bento Stitch (`tableau_de_bord_client`). */
export function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: entitlements } = useEntitlements();
  const riderRights = entitlements?.riders ?? [];
  const hasSubscription = riderRights.some((rider) => rider.subscription);

  const { data: horses = [], isPending: horsesPending } = useQuery({
    queryKey: ['horses'],
    queryFn: fetchHorses,
  });
  const { data: riders = [], isPending: ridersPending } = useQuery({
    queryKey: ['riders'],
    queryFn: fetchRiders,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: fetchClientInvoices,
  });

  const affinityQueries = useQueries({
    queries: riders.map((rider) => ({
      queryKey: ['affinities', rider.id],
      queryFn: () => fetchRiderAffinities(rider.id),
    })),
  });

  const affinitiesPending = ridersPending || affinityQueries.some((query) => query.isPending);
  const favoritesReady = !horsesPending && !affinitiesPending;

  const favoriteIds = new Set(
    affinityQueries.flatMap((query) =>
      (query.data ?? []).filter((row) => row.affinity === 'favorite').map((row) => row.horseId)
    )
  );
  const favorites = horses.filter((h) => favoriteIds.has(h.id)).slice(0, 2);

  const payable = invoices.filter(
    (invoice) => invoice.status === 'sent' || invoice.status === 'overdue'
  );
  const pendingDocs = riders.filter(
    (rider) => rider.medicalCertificateStatus === 'pending' || rider.licenseStatus === 'pending'
  ).length;

  return (
    <div>
      <div className="mb-12">
        <h1 className="font-display text-4xl text-primary">Bonjour, {user?.firstName} !</h1>
        <p className="mt-2 font-sans text-lg text-muted">
          Voici l&apos;actualité de votre famille aux écuries.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8">
          <h2 className="font-display text-2xl text-primary">Prochaines séances</h2>
          <UpcomingEnrollments compact limit={4} />
        </Card>

        <section className="col-span-12 flex flex-col justify-between rounded-xl bg-primary p-8 text-primary-fg lg:col-span-4">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-primary-fg/70">
              Forfaits
            </p>
            {riderRights.length === 0 ? (
              <p className="mt-4 font-sans text-sm text-primary-fg/80">
                Ajoutez un cavalier pour choisir son forfait.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {riderRights.map((rider) => (
                  <RiderWeek key={rider.riderId} rider={rider} />
                ))}
              </ul>
            )}
          </div>
          <Link
            to={hasSubscription ? '/app/planning' : '/app/cavaliers'}
            className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary-light px-5 font-sans text-sm font-semibold text-primary-fg"
          >
            {hasSubscription ? 'Réserver une séance' : 'Choisir un forfait'}
          </Link>
        </section>

        <div className="col-span-12 lg:col-span-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-primary">Leurs favoris</h2>
              <p className="font-sans text-sm text-muted">Chevaux préférés de la famille.</p>
            </div>
            <Link to="/app/cavaliers" className="font-sans text-sm text-primary hover:underline">
              Gérer les préférences →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {!favoritesReady ? (
              <Skeleton lines={3} />
            ) : favorites.length === 0 ? (
              <Card>
                <p className="font-sans text-sm text-muted-on-card">Aucun favori pour le moment.</p>
              </Card>
            ) : (
              favorites.map((horse) => (
                <Card key={horse.id} className="flex items-center gap-4">
                  <HorsePortrait horse={horse} alt="" className="size-20 shrink-0 rounded-lg" />
                  <div>
                    <h3 className="font-display text-xl text-on-card">{horse.name}</h3>
                    <p className="mt-1 font-sans text-xs text-muted-on-card">Cavalerie Equime</p>
                    <Badge className="mt-2" variant="success">
                      Favori
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="col-span-12 space-y-3 lg:col-span-4">
          <h2 className="font-display text-2xl text-primary">Actualités &amp; alertes</h2>
          <Card className="bg-paper">
            <p className="font-sans text-sm font-semibold text-on-card">Facturation</p>
            <p className="mt-1 font-sans text-xs text-muted-on-card">
              {payable.length > 0
                ? `${payable.length} facture(s) à régler.`
                : 'Aucune facture en attente.'}
            </p>
            <Link
              to="/app/factures"
              className="mt-2 inline-block font-sans text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Voir les dates
            </Link>
          </Card>
          <Card className="bg-paper">
            <p className="font-sans text-sm font-semibold text-on-card">Documents</p>
            <p className="mt-1 font-sans text-xs text-muted-on-card">
              {pendingDocs > 0
                ? `${pendingDocs} cavalier(s) ont un document en attente.`
                : 'Documents à jour, ou à déposer dans Famille.'}
            </p>
            <Link
              to="/app/cavaliers"
              className="mt-2 inline-block font-sans text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Ouvrir
            </Link>
          </Card>
          <Card className="bg-paper">
            <p className="font-sans text-sm font-semibold text-on-card">Événements</p>
            <p className="mt-1 font-sans text-xs text-muted-on-card">
              Stages et compétitions à venir.
            </p>
            <Link
              to="/app/evenements"
              className="mt-2 inline-block font-sans text-xs font-semibold uppercase tracking-wide text-primary"
            >
              Consulter
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
