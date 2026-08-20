import {
  HEALTH_LOG_TYPE_LABELS,
  HEALTH_LOG_TYPE_VALUES,
  HORSE_STATUS_LABELS,
  RIDER_LEVEL_LABELS,
} from '@equime/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { fetchHealthLogs, fetchHorse } from '@/features/admin/api.js';
import { filterHealthLogs, formatHealthLogDate, horseLoadPercent } from '@/lib/horseDirectory.js';

const HORSE_VARIANT = {
  fit: 'success',
  rest: 'warning',
  unavailable: 'default',
  injured: 'danger',
};

/** Fiche cheval lecture seule pour le moniteur (US-3.2). */
export function InstructorHorseHealthPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const horseQuery = useQuery({
    queryKey: ['instructor-horse', id],
    queryFn: () => fetchHorse(id),
    enabled: Boolean(id),
  });
  const horse = horseQuery.data ?? null;

  const logsQuery = useQuery({
    queryKey: ['health-logs', id],
    queryFn: () => fetchHealthLogs(id),
    enabled: Boolean(id),
  });
  const logs = logsQuery.data ?? [];
  const visibleLogs = filterHealthLogs(logs, logTypeFilter);
  const load = horse ? horseLoadPercent(horse) : 0;

  return (
    <div className="space-y-6">
      <Link
        to="/moniteur/sante"
        className="inline-flex h-11 items-center gap-2 font-sans text-sm font-semibold text-muted hover:text-on-card"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour à la cavalerie
      </Link>

      <QueryState
        isPending={horseQuery.isPending}
        isError={horseQuery.isError}
        error={horseQuery.error}
        onRetry={horseQuery.refetch}
        skeleton={<Skeleton lines={8} />}
      >
        {!horse ? (
          <Card>
            <EmptyState
              icon={<HorseIcon className="size-10" />}
              title="Cheval introuvable."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/moniteur/sante')}
                >
                  Retour à l’annuaire
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <PageHeader
              eyebrow="Carnet de santé"
              title={horse.name}
              description="Consultation de la fiche. La saisie des soins est réservée à l’administration."
              action={
                <Badge variant={HORSE_VARIANT[horse.status]}>
                  {HORSE_STATUS_LABELS[horse.status]}
                </Badge>
              }
            />

            <div className="space-y-6">
              <div className="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
                <Card className="overflow-hidden p-0">
                  <HorsePortrait horse={horse} alt="" className="aspect-square w-full" />
                </Card>
                <Card>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Race
                      </dt>
                      <dd className="mt-1 font-sans text-sm text-on-card">{horse.breed || '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Année de naissance
                      </dt>
                      <dd className="mt-1 font-sans text-sm text-on-card">
                        {horse.birthYear || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Niveaux
                      </dt>
                      <dd className="mt-1 font-sans text-sm text-on-card">
                        {RIDER_LEVEL_LABELS[horse.minLevel]} → {RIDER_LEVEL_LABELS[horse.maxLevel]}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Charge hebdomadaire
                      </dt>
                      <dd className="mt-2">
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-paper"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${load}%` }}
                          />
                        </div>
                        <p className="mt-2 font-sans text-sm text-muted-on-card">
                          {horse.weeklyLoadHours}h / {horse.maxWeeklyLoadHours}h
                        </p>
                      </dd>
                    </div>
                  </dl>
                </Card>
              </div>

              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-sans text-lg font-semibold text-on-card">Carnet de santé</h2>
                  {logs.length > 0 ? (
                    <p className="font-sans text-xs text-muted-on-card">
                      {visibleLogs.length}
                      {logTypeFilter !== 'all' ? ` / ${logs.length}` : ''} entrée
                      {visibleLogs.length > 1 ? 's' : ''}
                    </p>
                  ) : null}
                </div>
                <QueryState
                  isPending={logsQuery.isPending}
                  isError={logsQuery.isError}
                  error={logsQuery.error}
                  onRetry={logsQuery.refetch}
                  skeleton={<Skeleton lines={4} />}
                >
                  {logs.length === 0 ? (
                    <p className="mt-3 font-sans text-sm text-muted-on-card">
                      Aucune visite, ferrure ou soin enregistré pour ce cheval.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <Select
                        label="Filtrer par type"
                        value={logTypeFilter}
                        onChange={(event) => setLogTypeFilter(event.target.value)}
                        options={[
                          { value: 'all', label: 'Tous les types' },
                          ...HEALTH_LOG_TYPE_VALUES.map((value) => ({
                            value,
                            label: HEALTH_LOG_TYPE_LABELS[value],
                          })),
                        ]}
                      />
                      {visibleLogs.length === 0 ? (
                        <p className="font-sans text-sm text-muted-on-card">
                          Aucune entrée de ce type.
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {visibleLogs.map((log) => (
                            <li
                              key={log.id}
                              className="rounded-lg border border-border-on-card bg-paper p-3"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-sans text-sm font-semibold text-on-card">
                                  {HEALTH_LOG_TYPE_LABELS[log.type] ?? log.type}
                                </p>
                                <p className="font-sans text-xs text-muted-on-card">
                                  {formatHealthLogDate(log.occurredAt)}
                                </p>
                              </div>
                              <p className="mt-1 font-sans text-sm text-muted-on-card">
                                {log.notes}
                              </p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </QueryState>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
