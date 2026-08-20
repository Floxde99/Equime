import {
  HEALTH_LOG_TYPE_LABELS,
  HEALTH_LOG_TYPE_VALUES,
  HORSE_STATUS_LABELS,
  HORSE_STATUS_VALUES,
  RIDER_LEVEL_LABELS,
  RIDER_LEVEL_VALUES,
  createHealthLogSchema,
  updateHorseSchema,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog } from '@/components/ui/dialog.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Field } from '@/components/ui/field.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  createHealthLog,
  deleteHorse,
  deleteHorsePhoto,
  fetchHealthLogs,
  fetchHorse,
  updateHorse,
  uploadHorsePhoto,
} from '@/features/admin/api.js';
import { filterHealthLogs, formatHealthLogDate, horseLoadPercent } from '@/lib/horseDirectory.js';

const HORSE_VARIANT = {
  fit: 'success',
  rest: 'warning',
  unavailable: 'default',
  injured: 'danger',
};

const LEVEL_OPTIONS = RIDER_LEVEL_VALUES.map((value) => ({
  value,
  label: RIDER_LEVEL_LABELS[value],
}));

/** Identité cheval : champs du schéma partagé, année vide autorisée dans le formulaire. */
const horseIdentitySchema = updateHorseSchema
  .pick({
    name: true,
    breed: true,
    birthYear: true,
    minLevel: true,
    maxLevel: true,
    maxWeeklyLoadHours: true,
    alertThresholdHours: true,
  })
  .required({
    name: true,
    minLevel: true,
    maxLevel: true,
    maxWeeklyLoadHours: true,
    alertThresholdHours: true,
  })
  .extend({
    birthYear: z.union([z.literal(''), z.coerce.number().int().min(1980).max(2100)]).optional(),
  })
  .superRefine((data, ctx) => {
    if (RIDER_LEVEL_VALUES.indexOf(data.minLevel) > RIDER_LEVEL_VALUES.indexOf(data.maxLevel)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Le niveau minimum ne peut pas dépasser le niveau maximum',
        path: ['minLevel'],
      });
    }
  });

/** Fiche cheval admin : identité, charge, photo, carnet de santé (US-3.1, US-3.2). */
export function AdminHorsePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const horseQuery = useQuery({
    queryKey: ['admin-horse', id],
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

  const identityForm = useForm({
    resolver: zodResolver(horseIdentitySchema),
    values: horse
      ? {
          name: horse.name,
          breed: horse.breed ?? '',
          birthYear: horse.birthYear ?? '',
          minLevel: horse.minLevel,
          maxLevel: horse.maxLevel,
          maxWeeklyLoadHours: horse.maxWeeklyLoadHours,
          alertThresholdHours: horse.alertThresholdHours,
        }
      : undefined,
  });

  const identityMutation = useMutation({
    mutationFn: (values) => {
      const birthYear =
        values.birthYear === '' || values.birthYear == null ? undefined : Number(values.birthYear);
      return updateHorse(id, {
        name: values.name,
        breed: values.breed || undefined,
        birthYear: Number.isFinite(birthYear) ? birthYear : undefined,
        minLevel: values.minLevel,
        maxLevel: values.maxLevel,
        maxWeeklyLoadHours: Number(values.maxWeeklyLoadHours),
        alertThresholdHours: Number(values.alertThresholdHours),
      });
    },
    onSuccess: (updated) => {
      qc.setQueryData(['admin-horse', id], updated);
      qc.invalidateQueries({ queryKey: ['horses'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status) => updateHorse(id, { status }),
    onSuccess: (updated) => {
      qc.setQueryData(['admin-horse', id], updated);
      qc.invalidateQueries({ queryKey: ['horses'] });
    },
  });

  const photoMutation = useMutation({
    mutationFn: (file) => uploadHorsePhoto(id, file),
    onSuccess: (updated) => {
      qc.setQueryData(['admin-horse', id], updated);
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: ['horse-photo-blob', id] });
    },
  });

  const removePhotoMutation = useMutation({
    mutationFn: () => deleteHorsePhoto(id),
    onSuccess: (updated) => {
      qc.setQueryData(['admin-horse', id], updated);
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: ['horse-photo-blob', id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHorse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horses'] });
      navigate('/admin/cavalerie');
    },
  });

  const logForm = useForm({
    resolver: zodResolver(createHealthLogSchema),
    defaultValues: { type: 'veterinarian', notes: '', occurredAt: '' },
  });

  const logMutation = useMutation({
    mutationFn: (values) => {
      const occurredAt =
        values.occurredAt instanceof Date
          ? values.occurredAt.toISOString()
          : new Date(values.occurredAt).toISOString();
      return createHealthLog(id, {
        type: values.type,
        notes: values.notes,
        occurredAt,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health-logs', id] });
      logForm.reset({ type: 'veterinarian', notes: '', occurredAt: '' });
    },
  });

  const load = horse ? horseLoadPercent(horse) : 0;
  const overAlert = horse ? horse.weeklyLoadHours >= horse.alertThresholdHours : false;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/cavalerie"
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
                  onClick={() => navigate('/admin/cavalerie')}
                >
                  Retour à l’annuaire
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <PageHeader
              eyebrow="Cavalerie"
              title={horse.name}
              description="Fiche, charge de travail et carnet de santé."
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
                  <div className="flex flex-wrap gap-2 p-4">
                    <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border-on-card bg-card px-4 font-sans text-sm font-semibold text-on-card hover:bg-border-on-card/40">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) photoMutation.mutate(file);
                          event.target.value = '';
                        }}
                      />
                      {horse.photoUrl ? 'Remplacer' : 'Ajouter une photo'}
                    </label>
                    {horse.photoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={removePhotoMutation.isPending}
                        onClick={() => removePhotoMutation.mutate()}
                      >
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </Card>

                <Card>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Charge hebdomadaire
                      </p>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${load}%` }}
                        />
                      </div>
                      <p className="mt-2 font-sans text-sm text-muted-on-card">
                        {horse.weeklyLoadHours}h / {horse.maxWeeklyLoadHours}h
                        {overAlert ? (
                          <span className="text-warning"> — seuil d’alerte atteint</span>
                        ) : null}
                      </p>
                    </div>
                    <Select
                      label="Statut"
                      value={horse.status}
                      disabled={statusMutation.isPending}
                      error={
                        statusMutation.isError
                          ? (statusMutation.error?.message ?? 'Statut non enregistré')
                          : undefined
                      }
                      onChange={(event) => statusMutation.mutate(event.target.value)}
                      options={HORSE_STATUS_VALUES.map((value) => ({
                        value,
                        label: HORSE_STATUS_LABELS[value],
                      }))}
                    />
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                        Niveaux
                      </p>
                      <p className="mt-2 font-sans text-sm text-on-card">
                        {RIDER_LEVEL_LABELS[horse.minLevel]} → {RIDER_LEVEL_LABELS[horse.maxLevel]}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card title="Identité">
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={identityForm.handleSubmit((values) => identityMutation.mutate(values))}
                >
                  <Field
                    label="Nom"
                    htmlFor="edit-horse-name"
                    error={identityForm.formState.errors.name?.message}
                  >
                    <Input id="edit-horse-name" {...identityForm.register('name')} />
                  </Field>
                  <Field label="Race" htmlFor="edit-horse-breed" hint="Facultatif.">
                    <Input id="edit-horse-breed" {...identityForm.register('breed')} />
                  </Field>
                  <Field label="Année de naissance" htmlFor="edit-horse-year" hint="Facultatif.">
                    <Input
                      id="edit-horse-year"
                      type="number"
                      {...identityForm.register('birthYear')}
                    />
                  </Field>
                  <Select
                    label="Niveau minimum"
                    options={LEVEL_OPTIONS}
                    {...identityForm.register('minLevel')}
                  />
                  <Select
                    label="Niveau maximum"
                    error={identityForm.formState.errors.minLevel?.message}
                    options={LEVEL_OPTIONS}
                    {...identityForm.register('maxLevel')}
                  />
                  <Field label="Charge max (heures / semaine)" htmlFor="edit-horse-max">
                    <Input
                      id="edit-horse-max"
                      type="number"
                      step="0.5"
                      {...identityForm.register('maxWeeklyLoadHours')}
                    />
                  </Field>
                  <Field label="Seuil d’alerte (heures)" htmlFor="edit-horse-alert">
                    <Input
                      id="edit-horse-alert"
                      type="number"
                      step="0.5"
                      {...identityForm.register('alertThresholdHours')}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                    {identityMutation.isError ? (
                      <p role="alert" className="font-sans text-sm text-danger">
                        {identityMutation.error?.message ?? 'Enregistrement impossible'}
                      </p>
                    ) : null}
                    {identityMutation.isSuccess ? (
                      <p className="font-sans text-sm text-success">Fiche enregistrée.</p>
                    ) : null}
                    <Button type="submit" variant="secondary" loading={identityMutation.isPending}>
                      Enregistrer la fiche
                    </Button>
                  </div>
                </form>
              </Card>

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
                <p className="mt-1 font-sans text-sm text-muted-on-card">
                  {logs.length === 0
                    ? 'Aucune visite, ferrure ou soin enregistré. Ajoutez la première entrée.'
                    : 'Historique des soins, visites et observations.'}
                </p>

                <form
                  className="mt-5 grid gap-3 sm:grid-cols-2"
                  onSubmit={logForm.handleSubmit((values) => logMutation.mutate(values))}
                >
                  <Select
                    label="Type"
                    error={logForm.formState.errors.type?.message}
                    options={HEALTH_LOG_TYPE_VALUES.map((value) => ({
                      value,
                      label: HEALTH_LOG_TYPE_LABELS[value],
                    }))}
                    {...logForm.register('type')}
                  />
                  <Field
                    label="Date"
                    htmlFor="log-date"
                    error={logForm.formState.errors.occurredAt?.message}
                  >
                    <Input
                      id="log-date"
                      type="datetime-local"
                      invalid={Boolean(logForm.formState.errors.occurredAt)}
                      {...logForm.register('occurredAt')}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="Notes"
                      htmlFor="log-notes"
                      error={logForm.formState.errors.notes?.message}
                    >
                      <Textarea
                        id="log-notes"
                        rows={3}
                        invalid={Boolean(logForm.formState.errors.notes)}
                        {...logForm.register('notes')}
                      />
                    </Field>
                  </div>
                  {logMutation.isError ? (
                    <p role="alert" className="font-sans text-sm text-danger sm:col-span-2">
                      {logMutation.error?.message ?? "Impossible d'ajouter l'entrée"}
                    </p>
                  ) : null}
                  <div className="sm:col-span-2">
                    <Button type="submit" loading={logMutation.isPending}>
                      Ajouter une entrée
                    </Button>
                  </div>
                </form>

                {logs.length > 0 ? (
                  <div className="mt-6 space-y-3 border-t border-border-on-card pt-5">
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
                    <QueryState
                      isPending={logsQuery.isPending}
                      isError={logsQuery.isError}
                      error={logsQuery.error}
                      onRetry={logsQuery.refetch}
                      skeleton={<Skeleton lines={4} />}
                    >
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
                    </QueryState>
                  </div>
                ) : logsQuery.isPending || logsQuery.isError ? (
                  <div className="mt-5">
                    <QueryState
                      isPending={logsQuery.isPending}
                      isError={logsQuery.isError}
                      error={logsQuery.error}
                      onRetry={logsQuery.refetch}
                      skeleton={<Skeleton lines={2} />}
                    />
                  </div>
                ) : null}
              </Card>

              <Button type="button" variant="ghost" onClick={() => setPendingDelete(true)}>
                Supprimer ce cheval
              </Button>
            </div>

            <ConfirmDialog
              open={pendingDelete}
              title={`Supprimer le cheval ${horse.name} ?`}
              confirmLabel="Supprimer"
              loading={deleteMutation.isPending}
              onClose={() => setPendingDelete(false)}
              onConfirm={() => deleteMutation.mutate()}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}
