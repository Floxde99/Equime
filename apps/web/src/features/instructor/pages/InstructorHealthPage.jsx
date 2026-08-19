import { HORSE_STATUS_LABELS } from '@equime/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Field } from '@/components/ui/field.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { fetchHorses } from '@/features/admin/api.js';
import { filterHorsesByQuery } from '@/lib/horseDirectory.js';

const HORSE_VARIANT = {
  fit: 'success',
  rest: 'warning',
  unavailable: 'default',
  injured: 'danger',
};

/** Annuaire santé cavalerie — lecture seule pour le moniteur (US-3.2). */
export function InstructorHealthPage() {
  const [search, setSearch] = useState('');

  const horsesQuery = useQuery({ queryKey: ['instructor-horses'], queryFn: fetchHorses });
  const horses = horsesQuery.data ?? [];
  const filtered = useMemo(
    () => filterHorsesByQuery(horsesQuery.data, search),
    [horsesQuery.data, search]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace moniteur"
        title="Carnet de santé"
        description="Consultez les fiches santé de la cavalerie. La saisie des soins est réservée à l’administration."
      />

      <QueryState
        isPending={horsesQuery.isPending}
        isError={horsesQuery.isError}
        error={horsesQuery.error}
        onRetry={horsesQuery.refetch}
        skeleton={<Skeleton lines={6} />}
      >
        {horses.length === 0 ? (
          <Card>
            <EmptyState title="Aucun cheval enregistré pour le moment." />
          </Card>
        ) : (
          <div className="space-y-4">
            <Field label="Rechercher un cheval" htmlFor="instructor-horse-search">
              <Input
                id="instructor-horse-search"
                type="search"
                value={search}
                autoComplete="off"
                placeholder="Nom du cheval"
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            {filtered.length === 0 ? (
              <Card>
                <EmptyState title={`Aucun cheval ne correspond à « ${search.trim()} ».`} />
              </Card>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((horse) => (
                  <li key={horse.id}>
                    <Link to={`/moniteur/sante/${horse.id}`} className="block">
                      <Card className="overflow-hidden p-0 transition-colors hover:bg-surface-raised">
                        <HorsePortrait horse={horse} alt="" className="aspect-[4/3] w-full" />
                        <div className="flex flex-wrap items-center gap-2 p-4">
                          <span className="font-display text-xl text-on-card">{horse.name}</span>
                          <Badge variant={HORSE_VARIANT[horse.status]}>
                            {HORSE_STATUS_LABELS[horse.status]}
                          </Badge>
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}
