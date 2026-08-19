import {
  HORSE_STATUS_LABELS,
  HORSE_STATUS_VALUES,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_VALUES,
  createHorseSchema,
  createSpaceSchema,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import {
  createHealthLog,
  createHorse,
  createSpace,
  deleteHorse,
  deleteSpace,
  fetchHealthLogs,
  fetchHorses,
  fetchSpaces,
} from '@/features/admin/api.js';

const HORSE_VARIANT = { fit: 'success', rest: 'warning', unavailable: 'default', injured: 'danger' };

/** Cavalerie + espaces admin (US-3.1 → 3.3). */
export function AdminCavalryPage() {
  const [tab, setTab] = useState('horses');
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text">Cavalerie & espaces</h1>
      <div className="flex gap-2">
        {[
          { id: 'horses', label: 'Chevaux' },
          { id: 'spaces', label: 'Espaces' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? 'rounded-lg bg-surface-raised px-3 py-1.5 font-sans text-sm text-primary'
                : 'rounded-lg px-3 py-1.5 font-sans text-sm text-muted hover:bg-surface-raised'
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
  const [selectedId, setSelectedId] = useState(null);

  const { data: horses = [] } = useQuery({ queryKey: ['admin-horses'], queryFn: fetchHorses });
  const { data: logs = [] } = useQuery({
    queryKey: ['health-logs', selectedId],
    queryFn: () => fetchHealthLogs(selectedId),
    enabled: Boolean(selectedId),
  });

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
    mutationFn: (values) => createHorse(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-horses'] });
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHorse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-horses'] }),
  });

  const logForm = useForm({
    defaultValues: { type: 'veterinarian', notes: '', occurredAt: '' },
  });

  const logMutation = useMutation({
    mutationFn: (values) =>
      createHealthLog(selectedId, { ...values, occurredAt: new Date(values.occurredAt).toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['health-logs', selectedId] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {horses.map((horse) => (
          <Card key={horse.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <button
                  type="button"
                  className="text-left font-sans text-lg font-semibold text-text hover:text-primary"
                  onClick={() => setSelectedId(horse.id)}
                >
                  {horse.name}
                </button>
                <Badge variant={HORSE_VARIANT[horse.status]} className="mt-1">
                  {HORSE_STATUS_LABELS[horse.status]}
                </Badge>
                <p className="mt-1 font-sans text-sm text-muted">
                  Charge : {horse.weeklyLoadHours}h / {horse.maxWeeklyLoadHours}h
                  {horse.weeklyLoadHours >= horse.alertThresholdHours ? (
                    <span className="text-warning"> — seuil atteint</span>
                  ) : null}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => deleteMutation.mutate(horse.id)}>
                Supprimer
              </Button>
            </div>
          </Card>
        ))}

        <Card title="Nouveau cheval">
          <form className="space-y-3" onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}>
            <Field label="Nom" htmlFor="horse-name">
              <Input id="horse-name" {...form.register('name')} />
            </Field>
            <Select
              label="Statut"
              options={HORSE_STATUS_VALUES.map((v) => ({ value: v, label: HORSE_STATUS_LABELS[v] }))}
              {...form.register('status')}
            />
            <Button type="submit">Ajouter</Button>
          </form>
        </Card>
      </div>

      {selectedId ? (
        <Card title="Carnet de santé">
          <ul className="mb-4 space-y-2">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-border p-3">
                <p className="font-sans text-sm font-semibold text-text">{log.type}</p>
                <p className="font-sans text-sm text-muted">{log.notes}</p>
                <p className="font-sans text-xs text-muted">
                  {new Date(log.occurredAt).toLocaleDateString('fr-FR')}
                </p>
              </li>
            ))}
          </ul>
          <form className="space-y-3" onSubmit={logForm.handleSubmit((v) => logMutation.mutate(v))}>
            <Field label="Notes" htmlFor="log-notes">
              <Input id="log-notes" {...logForm.register('notes')} />
            </Field>
            <Field label="Date" htmlFor="log-date">
              <Input id="log-date" type="datetime-local" {...logForm.register('occurredAt')} />
            </Field>
            <Button type="submit">Ajouter une entrée</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function SpacesPanel() {
  const qc = useQueryClient();
  const { data: spaces = [] } = useQuery({ queryKey: ['spaces'], queryFn: fetchSpaces });

  const form = useForm({
    resolver: zodResolver(createSpaceSchema),
    defaultValues: { name: '', type: 'indoor', capacity: 12 },
  });

  const saveMutation = useMutation({
    mutationFn: createSpace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSpace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spaces'] }),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {spaces.map((space) => (
        <Card key={space.id}>
          <h3 className="font-sans text-lg font-semibold text-text">{space.name}</h3>
          <p className="font-sans text-sm text-muted">{SPACE_TYPE_LABELS[space.type]}</p>
          <Button type="button" variant="ghost" className="mt-2" onClick={() => deleteMutation.mutate(space.id)}>
            Supprimer
          </Button>
        </Card>
      ))}
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
          <Field label="Capacité" htmlFor="space-cap">
            <Input id="space-cap" type="number" {...form.register('capacity')} />
          </Field>
          <Button type="submit">Créer</Button>
        </form>
      </Card>
    </div>
  );
}
