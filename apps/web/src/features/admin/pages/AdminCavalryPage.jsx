import {
  HORSE_STATUS_LABELS,
  HORSE_STATUS_VALUES,
  SPACE_GROUP_LABELS,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_VALUES,
  createHorseSchema,
  createSpaceSchema,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Field } from '@/components/ui/field.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  createHorse,
  createSpace,
  deleteSpace,
  fetchHorses,
  fetchSpaces,
  updateSpace,
  uploadHorsePhoto,
} from '@/features/admin/api.js';
import { filterHorsesByQuery, horseLoadPercent } from '@/lib/horseDirectory.js';
import { buildSpaceOccupancy } from '@/lib/spaceOccupancy.js';

const HORSE_VARIANT = {
  fit: 'success',
  rest: 'warning',
  unavailable: 'default',
  injured: 'danger',
};

/** Cavalerie + espaces admin (US-3.1 → 3.3). */
export function AdminCavalryPage() {
  const [tab, setTab] = useState('horses');
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Cavalerie & espaces"
        description="Chevaux, santé, boxes, paddocks et carrières."
      />
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'horses', label: 'Chevaux' },
          { id: 'spaces', label: 'Boxes / paddocks / carrières' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-full bg-primary px-4 py-2 font-sans text-sm font-semibold text-primary-fg'
                : 'rounded-full px-4 py-2 font-sans text-sm text-muted hover:bg-paper hover:text-on-card'
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'horses' ? <HorsesPanel /> : <SpacesPanel />}
    </div>
  );
}

function HorsesPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [photoFile, setPhotoFile] = useState(/** @type {File | null} */ (null));

  const horsesQuery = useQuery({ queryKey: ['admin-horses'], queryFn: fetchHorses });
  const horses = horsesQuery.data ?? [];
  const { data: spaces = [] } = useQuery({ queryKey: ['spaces'], queryFn: fetchSpaces });
  const filtered = useMemo(
    () => filterHorsesByQuery(horsesQuery.data, search),
    [horsesQuery.data, search]
  );

  const form = useForm({
    resolver: zodResolver(createHorseSchema),
    defaultValues: {
      name: '',
      status: 'fit',
      minLevel: 'initiation',
      maxLevel: 'galop_7',
      maxWeeklyLoadHours: 12,
      alertThresholdHours: 10,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const horse = await createHorse(values);
      if (photoFile) await uploadHorsePhoto(horse.id, photoFile);
      return horse;
    },
    onSuccess: (horse) => {
      qc.invalidateQueries({ queryKey: ['admin-horses'] });
      form.reset();
      setPhotoFile(null);
      setCreateOpen(false);
      navigate(`/admin/cavalerie/${horse.id}`);
    },
  });

  const occupancy = buildSpaceOccupancy(spaces, horses.length);
  const healthAlerts = horses.filter(
    (horse) =>
      horse.status === 'injured' ||
      horse.status === 'rest' ||
      horse.weeklyLoadHours >= horse.alertThresholdHours
  );
  const avgLoad = horses.length
    ? Math.round(
        (horses.reduce((sum, horse) => sum + horse.weeklyLoadHours, 0) / horses.length) * 10
      ) / 10
    : 0;
  const fitCount = horses.filter((horse) => horse.status === 'fit').length;
  const healthIndex = horses.length ? Math.round((fitCount / horses.length) * 100) : 100;

  function closeCreate() {
    setCreateOpen(false);
    form.reset();
    setPhotoFile(null);
    saveMutation.reset();
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-12 gap-6">
        <OccupancyCard occupancy={occupancy} />

        <Card className="col-span-12 lg:col-span-5">
          <h3 className="font-display text-xl text-primary">Alertes santé</h3>
          {healthAlerts.length === 0 ? (
            <p className="mt-4 font-sans text-sm text-muted-on-card">
              Aucune alerte santé en cours.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {healthAlerts.slice(0, 4).map((horse) => (
                <li key={horse.id}>
                  <Link
                    to={`/admin/cavalerie/${horse.id}`}
                    className="block rounded-lg bg-danger/10 p-4 hover:bg-danger/15"
                  >
                    <p className="font-sans text-sm font-semibold text-on-card">{horse.name}</p>
                    <p className="mt-1 font-sans text-xs text-muted-on-card">
                      {HORSE_STATUS_LABELS[horse.status]} — {horse.weeklyLoadHours}h /{' '}
                      {horse.maxWeeklyLoadHours}h
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <section className="col-span-12 flex flex-col justify-between rounded-xl bg-primary p-8 text-primary-fg lg:col-span-3">
          <div>
            <h3 className="font-display text-xl">Matching affinités</h3>
            <p className="mt-3 font-sans text-sm text-primary-fg/80">
              Appariements cavalier–cheval selon le niveau et les préférences, via l&apos;audit du
              planning.
            </p>
          </div>
          <p className="mt-6 font-sans text-xs text-primary-fg/70">
            Charge moyenne {avgLoad} h · indice santé {healthIndex} %
          </p>
          <Link
            to="/admin/planning"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-primary-fg/40 px-4 font-sans text-sm font-semibold text-primary-fg"
          >
            Ouvrir le planning
          </Link>
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl text-on-card">Annuaire de la cavalerie</h3>
            <p className="mt-1 font-sans text-sm text-muted">
              {filtered.length} cheval{filtered.length > 1 ? 'aux' : ''}
              {search.trim() ? ` pour « ${search.trim()} »` : ''}
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Nouveau cheval
          </Button>
        </div>

        <Field label="Rechercher un cheval" htmlFor="horse-search">
          <Input
            id="horse-search"
            type="search"
            value={search}
            autoComplete="off"
            placeholder="Nom du cheval"
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>

        <QueryState
          isPending={horsesQuery.isPending}
          isError={horsesQuery.isError}
          error={horsesQuery.error}
          onRetry={horsesQuery.refetch}
          skeleton={<Skeleton lines={6} />}
        >
          {horses.length === 0 ? (
            <Card>
              <EmptyState
                icon={<HorseIcon className="size-10" />}
                title="Aucun cheval enregistré pour le moment."
                action={
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>
                    Créer le premier cheval
                  </Button>
                }
              />
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState title={`Aucun cheval ne correspond à « ${search.trim()} ».`} />
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((horse) => (
                <li key={horse.id}>
                  <Link to={`/admin/cavalerie/${horse.id}`} className="block">
                    <Card className="overflow-hidden p-0 transition-colors hover:bg-surface-raised">
                      <HorsePortrait horse={horse} alt="" className="aspect-[4/3] w-full" />
                      <div className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-xl text-on-card">{horse.name}</span>
                          <Badge variant={HORSE_VARIANT[horse.status]}>
                            {HORSE_STATUS_LABELS[horse.status]}
                          </Badge>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-paper"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${horseLoadPercent(horse)}%` }}
                          />
                        </div>
                        <p className="font-sans text-sm text-muted-on-card">
                          Charge : {horse.weeklyLoadHours}h / {horse.maxWeeklyLoadHours}h
                        </p>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>

      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title="Nouveau cheval"
        className="max-w-md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeCreate}>
              Annuler
            </Button>
            <Button type="submit" form="create-horse-form" loading={saveMutation.isPending}>
              Ajouter
            </Button>
          </>
        }
      >
        <form
          id="create-horse-form"
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <Field label="Nom" htmlFor="horse-name" error={form.formState.errors.name?.message}>
            <Input id="horse-name" {...form.register('name')} />
          </Field>
          <Select
            label="Statut"
            options={HORSE_STATUS_VALUES.map((v) => ({ value: v, label: HORSE_STATUS_LABELS[v] }))}
            {...form.register('status')}
          />
          <Field
            label="Photo"
            htmlFor="horse-photo"
            hint="Facultatif. JPEG, PNG ou WebP, 5 Mo maximum."
          >
            <Input
              id="horse-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          {saveMutation.isError ? (
            <p role="alert" className="font-sans text-sm text-danger">
              {saveMutation.error?.message ?? 'Création impossible'}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}

/**
 * @param {{ occupancy: ReturnType<typeof buildSpaceOccupancy> }} props
 */
function OccupancyCard({ occupancy }) {
  const { boxes, paddocks, arenas } = occupancy;
  const slotCount = boxes.capacity;

  return (
    <Card className="col-span-12 bg-paper lg:col-span-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-primary">Occupation des boxes</h3>
          <p className="font-sans text-sm text-muted-on-card">
            {boxes.horseCount} cheval{boxes.horseCount > 1 ? 'aux' : ''} · {boxes.capacity} place
            {boxes.capacity > 1 ? 's' : ''} en stalle
          </p>
        </div>
        <span className="font-display text-4xl italic text-primary">{boxes.percent}%</span>
      </div>

      {slotCount === 0 ? (
        <p className="mt-6 font-sans text-sm text-muted-on-card">
          Aucun box défini. Créez des espaces de type « Box / stalle » dans l&apos;onglet Boxes /
          paddocks / carrières.
        </p>
      ) : (
        <div
          className="mt-6 grid grid-cols-5 gap-2"
          role="img"
          aria-label={`${boxes.occupied} boxes occupés sur ${boxes.capacity}`}
        >
          {Array.from({ length: slotCount }, (_, index) => {
            const occupied = index < boxes.occupied;
            return (
              <div
                key={index}
                className={
                  occupied
                    ? 'flex h-10 items-center justify-center rounded-sm bg-text font-sans text-[10px] font-bold text-primary-fg'
                    : 'flex h-10 items-center justify-center rounded-sm border border-border-on-card bg-card font-sans text-[10px] font-bold text-muted-on-card'
                }
              >
                {index + 1}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-4 font-sans text-xs text-muted-on-card">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-text" /> Occupé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-border-on-card bg-card" /> Disponible
        </span>
      </div>

      <SpaceCapacityList title={SPACE_GROUP_LABELS.paddock} items={paddocks} />
      <SpaceCapacityList title={SPACE_GROUP_LABELS.arena} items={arenas} />
    </Card>
  );
}

/**
 * @param {{ title: string, items: { id?: string, name: string, capacity: number }[] }} props
 */
function SpaceCapacityList({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <h4 className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
        {title}
      </h4>
      <ul className="mt-2 space-y-2">
        {items.map((space) => (
          <li key={space.id ?? space.name} className="flex items-baseline justify-between gap-2">
            <span className="font-sans text-sm text-on-card">{space.name}</span>
            <span className="font-sans text-xs text-muted-on-card">
              {space.capacity ? `${space.capacity} places` : 'Capacité non renseignée'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpacesPanel() {
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editing, setEditing] = useState(/** @type {object | null} */ (null));
  const { data: spaces = [] } = useQuery({ queryKey: ['spaces'], queryFn: fetchSpaces });

  const form = useForm({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: { name: '', type: 'stall', capacity: 12 },
  });

  const editForm = useForm({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: { name: '', type: 'stall', capacity: 12 },
  });

  const saveMutation = useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }) => updateSpace(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      closeEdit();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSpace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces'] }),
  });

  const arenaItems = spaces.filter((space) => space.type === 'indoor' || space.type === 'outdoor');
  const stallItems = spaces.filter((space) => space.type === 'stall');
  const paddockItems = spaces.filter((space) => space.type === 'paddock');

  function openEdit(space) {
    setEditing(space);
    editForm.reset({
      name: space.name,
      type: space.type,
      capacity: space.capacity ?? '',
    });
    updateMutation.reset();
  }

  function closeEdit() {
    setEditing(null);
    editForm.reset({ name: '', type: 'stall', capacity: 12 });
    updateMutation.reset();
  }

  return (
    <div className="space-y-8">
      <SpaceTypeSection
        title={SPACE_GROUP_LABELS.stall}
        items={stallItems}
        onEdit={openEdit}
        onDelete={setPendingDelete}
      />
      <SpaceTypeSection
        title={SPACE_GROUP_LABELS.paddock}
        items={paddockItems}
        onEdit={openEdit}
        onDelete={setPendingDelete}
      />
      <SpaceTypeSection
        title={SPACE_GROUP_LABELS.arena}
        items={arenaItems}
        onEdit={openEdit}
        onDelete={setPendingDelete}
      />

      <Card title="Nouvel espace">
        <form className="space-y-3" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
          <Field label="Nom" htmlFor="space-name">
            <Input id="space-name" {...form.register('name')} />
          </Field>
          <Select
            label="Type"
            options={SPACE_TYPE_VALUES.map((v) => ({ value: v, label: SPACE_TYPE_LABELS[v] }))}
            {...form.register('type')}
          />
          <Field label="Capacité (places / boxes)" htmlFor="space-cap">
            <Input id="space-cap" type="number" {...form.register('capacity')} />
          </Field>
          <Button type="submit">Créer</Button>
        </form>
      </Card>
      <Dialog
        open={Boolean(editing)}
        onClose={closeEdit}
        title="Modifier l'espace"
        className="max-w-md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeEdit}>
              Annuler
            </Button>
            <Button type="submit" form="edit-space-form" loading={updateMutation.isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <form
          id="edit-space-form"
          className="space-y-3"
          onSubmit={editForm.handleSubmit((values) => {
            if (!editing) return;
            updateMutation.mutate({ id: editing.id, values });
          })}
        >
          <Field
            label="Nom"
            htmlFor="edit-space-name"
            error={editForm.formState.errors.name?.message}
          >
            <Input id="edit-space-name" {...editForm.register('name')} />
          </Field>
          <Select
            id="edit-space-type"
            label="Type"
            error={editForm.formState.errors.type?.message}
            options={SPACE_TYPE_VALUES.map((v) => ({ value: v, label: SPACE_TYPE_LABELS[v] }))}
            {...editForm.register('type')}
          />
          <Field
            label="Capacité (places / boxes)"
            htmlFor="edit-space-cap"
            error={editForm.formState.errors.capacity?.message}
          >
            <Input id="edit-space-cap" type="number" {...editForm.register('capacity')} />
          </Field>
          {updateMutation.isError ? (
            <p role="alert" className="font-sans text-sm text-danger">
              {updateMutation.error?.message ?? 'Modification impossible'}
            </p>
          ) : null}
        </form>
      </Dialog>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Supprimer l'espace ${pendingDelete.name} ?` : ''}
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          deleteMutation.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
      />
    </div>
  );
}

/**
 * @param {{
 *   title: string,
 *   items: object[],
 *   onEdit: (space: object) => void,
 *   onDelete: (space: object) => void,
 * }} props
 */
function SpaceTypeSection({ title, items, onEdit, onDelete }) {
  return (
    <section>
      <h3 className="mb-3 font-display text-2xl text-primary">{title}</h3>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-muted-on-card">
          Aucun espace de ce type pour le moment.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((space) => (
            <Card key={space.id}>
              <h4 className="font-display text-xl text-on-card">{space.name}</h4>
              <p className="font-sans text-sm text-muted">{SPACE_TYPE_LABELS[space.type]}</p>
              <p className="mt-1 font-sans text-sm text-muted-on-card">
                {space.capacity ? `${space.capacity} places` : 'Capacité non renseignée'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => onEdit(space)}>
                  Modifier
                </Button>
                <Button type="button" variant="ghost" onClick={() => onDelete(space)}>
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
