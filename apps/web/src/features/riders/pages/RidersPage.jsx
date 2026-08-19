import {
  AFFINITY_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  RIDER_LEVEL_LABELS,
  RIDER_LEVEL_VALUES,
  createRiderSchema,
} from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Select } from '@/components/ui/select.jsx';
import {
  createRider,
  deleteRider,
  fetchHorses,
  fetchRiderAffinities,
  fetchRiders,
  updateRider,
  uploadRiderDocument,
  upsertRiderAffinity,
} from '@/features/riders/api.js';

const DOC_VARIANT = {
  missing: 'danger',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** @param {string} status */
function docBadge(status) {
  return (
    <Badge variant={DOC_VARIANT[status] ?? 'default'}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
  );
}

/** CRUD cavaliers famille + documents + affinités (US-2.1 → 2.3). */
export function RidersPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);

  const { data: riders = [], isLoading } = useQuery({
    queryKey: ['riders'],
    queryFn: fetchRiders,
  });

  const { data: horses = [] } = useQuery({ queryKey: ['horses'], queryFn: fetchHorses });

  const form = useForm({
    resolver: zodResolver(createRiderSchema),
    defaultValues: { firstName: '', lastName: '', birthdate: '', level: 'initiation' },
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editingId) return updateRider(editingId, values);
      return createRider(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riders'] });
      form.reset();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRider,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['riders'] }),
  });

  if (isLoading) return <p className="text-muted">Chargement…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-text">Cavaliers</h1>
        <p className="mt-1 font-sans text-sm text-muted">Gérez les membres de votre famille.</p>
      </div>

      {riders.length === 0 ? (
        <Card className="text-center">
          <p className="font-sans text-muted">Aucun cavalier pour le moment.</p>
          <p className="mt-1 font-sans text-sm text-muted">Ajoutez le premier profil ci-dessous.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {riders.map((rider) => (
            <RiderCard
              key={rider.id}
              rider={rider}
              horses={horses}
              onEdit={() => {
                setEditingId(rider.id);
                form.reset({
                  firstName: rider.firstName,
                  lastName: rider.lastName,
                  birthdate: rider.birthdate.slice(0, 10),
                  level: rider.level,
                });
              }}
              onDelete={() => deleteMutation.mutate(rider.id)}
            />
          ))}
        </ul>
      )}

      <Card title={editingId ? 'Modifier le cavalier' : 'Ajouter un cavalier'}>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="firstName" error={form.formState.errors.firstName?.message}>
              <Input id="firstName" {...form.register('firstName')} />
            </Field>
            <Field label="Nom" htmlFor="lastName" error={form.formState.errors.lastName?.message}>
              <Input id="lastName" {...form.register('lastName')} />
            </Field>
          </div>
          <Field label="Date de naissance" htmlFor="birthdate" error={form.formState.errors.birthdate?.message}>
            <Input id="birthdate" type="date" {...form.register('birthdate')} />
          </Field>
          <Select
            label="Niveau"
            options={RIDER_LEVEL_VALUES.map((v) => ({ value: v, label: RIDER_LEVEL_LABELS[v] }))}
            {...form.register('level')}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Plus className="size-4" aria-hidden="true" />
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={() => { setEditingId(null); form.reset(); }}>
                Annuler
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}

/** @param {{ rider: object, horses: object[], onEdit: () => void, onDelete: () => void }} props */
function RiderCard({ rider, horses, onEdit, onDelete }) {
  const qc = useQueryClient();
  const [medicalConsent, setMedicalConsent] = useState(false);

  const { data: affinities = [] } = useQuery({
    queryKey: ['affinities', rider.id],
    queryFn: () => fetchRiderAffinities(rider.id),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ docType, file }) => uploadRiderDocument(rider.id, docType, file, medicalConsent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['riders'] }),
  });

  const affinityMutation = useMutation({
    mutationFn: ({ horseId, affinity }) => upsertRiderAffinity(rider.id, horseId, affinity),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affinities', rider.id] }),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-sans text-lg font-semibold text-text">
            {rider.firstName} {rider.lastName}
          </h3>
          <p className="font-sans text-sm text-muted">{RIDER_LEVEL_LABELS[rider.level]}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onEdit}>
            Modifier
          </Button>
          <Button type="button" variant="ghost" onClick={onDelete} aria-label="Supprimer">
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="font-sans text-xs text-muted">Certificat :</span> {docBadge(rider.medicalCertificateStatus)}
        {rider.medicalCertificateStatus === 'rejected' && rider.medicalCertificateRejectionReason ? (
          <span className="font-sans text-xs text-danger">({rider.medicalCertificateRejectionReason})</span>
        ) : null}
        <span className="font-sans text-xs text-muted">Licence :</span> {docBadge(rider.licenseStatus)}
        {rider.licenseStatus === 'rejected' && rider.licenseRejectionReason ? (
          <span className="font-sans text-xs text-danger">({rider.licenseRejectionReason})</span>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="font-sans text-sm font-medium text-muted">Documents</p>
        <label className="flex items-center gap-2 font-sans text-sm text-text">
          <input
            type="checkbox"
            checked={medicalConsent}
            onChange={(e) => setMedicalConsent(e.target.checked)}
          />
          Je consens au stockage du certificat médical (RGPD)
        </label>
        <div className="flex flex-wrap gap-2">
          {['medical_certificate', 'license'].map((docType) => (
            <label
              key={docType}
              className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-border px-4 font-sans text-sm text-muted hover:bg-surface-raised"
            >
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate({ docType, file });
                }}
              />
              Téléverser {docType === 'medical_certificate' ? 'certificat' : 'licence'}
            </label>
          ))}
        </div>
      </div>

      {horses.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="font-sans text-sm font-medium text-muted">Affinités chevaux</p>
          {horses.map((horse) => {
            const current = affinities.find((a) => a.horseId === horse.id)?.affinity ?? 'neutral';
            return (
              <div key={horse.id} className="flex items-center justify-between gap-2">
                <span className="font-sans text-sm text-text">{horse.name}</span>
                <Select
                  aria-label={`Affinité pour ${horse.name}`}
                  value={current}
                  onChange={(e) =>
                    affinityMutation.mutate({ horseId: horse.id, affinity: e.target.value })
                  }
                  options={Object.entries(AFFINITY_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
