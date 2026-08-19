import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog } from '@/components/ui/dialog.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  createEvent,
  deleteEvent,
  fetchAdminEvents,
  updateEvent,
  assignEventHorses,
  cancelEventRegistration,
} from '@/features/engagement/api.js';

const EVENT_TYPES = [
  { value: 'stage', label: 'Stage' },
  { value: 'competition_internal', label: 'Compétition interne' },
  { value: 'competition_external', label: 'Compétition externe' },
];

const initialForm = {
  title: '',
  description: '',
  type: 'stage',
  startAt: '',
  endAt: '',
  capacity: 12,
  priceCents: 0,
  location: '',
};

/** @param {object} event */
function eventToForm(event) {
  const toLocal = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: event.title,
    description: event.description ?? '',
    type: event.type,
    startAt: toLocal(event.startAt),
    endAt: toLocal(event.endAt),
    capacity: event.capacity,
    priceCents: event.priceCents,
    location: event.location ?? '',
  };
}

export function AdminEventsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const { data: events = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: fetchAdminEvents,
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      setForm(initialForm);
      setStatus('Événement créé.');
    },
    onError: (err) => setStatus(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateEvent(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      setEditingId(null);
      setForm(initialForm);
      setStatus('Événement mis à jour.');
    },
    onError: (err) => setStatus(err.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-events'] }),
  });
  const assignMutation = useMutation({
    mutationFn: assignEventHorses,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      const assigned = result.assignments?.length ?? 0;
      const conflicts = result.conflicts?.length ?? 0;
      setStatus(
        conflicts > 0
          ? `${assigned} cheval(aux) attribué(s), ${conflicts} sans monture éligible.`
          : `${assigned} cheval(aux) attribué(s).`
      );
    },
    onError: (err) => setStatus(err.message),
  });
  const cancelRegistrationMutation = useMutation({
    mutationFn: ({ eventId, registrationId }) => cancelEventRegistration(eventId, registrationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      setStatus('Inscription annulée.');
    },
    onError: (err) => setStatus(err.message),
  });

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Événements"
        description="CRUD admin des stages et compétitions."
      />

      {status ? (
        <Alert
          variant={
            status.includes('créé') ||
            status.includes('mis à jour') ||
            status.includes('attribué') ||
            status.includes('annulée')
              ? 'success'
              : 'error'
          }
        >
          {status}
        </Alert>
      ) : null}

      <Card title={editingId ? "Modifier l'événement" : 'Créer un événement'}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titre" htmlFor="event-title">
            <Input
              id="event-title"
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            />
          </Field>
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
            options={EVENT_TYPES}
          />
          <Field label="Début" htmlFor="event-start">
            <Input
              id="event-start"
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => setForm((current) => ({ ...current, startAt: e.target.value }))}
            />
          </Field>
          <Field label="Fin" htmlFor="event-end">
            <Input
              id="event-end"
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => setForm((current) => ({ ...current, endAt: e.target.value }))}
            />
          </Field>
          <Field label="Capacité" htmlFor="event-capacity">
            <Input
              id="event-capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) =>
                setForm((current) => ({ ...current, capacity: Number(e.target.value || 0) }))
              }
            />
          </Field>
          <Field label="Prix (centimes)" htmlFor="event-price">
            <Input
              id="event-price"
              type="number"
              min="0"
              value={form.priceCents}
              onChange={(e) =>
                setForm((current) => ({ ...current, priceCents: Number(e.target.value || 0) }))
              }
            />
          </Field>
          <Field label="Lieu" htmlFor="event-location">
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
            />
          </Field>
          <Field label="Description" htmlFor="event-description" className="md:col-span-2">
            <Textarea
              id="event-description"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {editingId ? 'Enregistrer' : 'Créer'}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Annuler
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Événements planifiés">
        <ul className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className="space-y-3 rounded-xl border border-border-on-card bg-paper p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-sm font-semibold text-text">{event.title}</p>
                  <p className="font-sans text-sm text-muted">
                    {new Date(event.startAt).toLocaleString('fr-FR')} · {event.registeredCount}/
                    {event.capacity}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={assignMutation.isPending}
                    onClick={() => assignMutation.mutate(event.id)}
                  >
                    Attribuer les chevaux
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(event.id);
                      setForm(eventToForm(event));
                      setStatus('');
                    }}
                  >
                    Modifier
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingDelete(event)}>
                    Supprimer
                  </Button>
                </div>
              </div>
              {event.registrations?.length ? (
                <ul className="space-y-2 border-t border-border pt-3">
                  {event.registrations.map((registration) => (
                    <li
                      key={registration.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <p className="font-sans text-sm text-on-card">
                        {registration.rider.firstName} {registration.rider.lastName}
                        {' — '}
                        {registration.horse?.name ?? 'cheval non attribué'}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        loading={cancelRegistrationMutation.isPending}
                        onClick={() =>
                          cancelRegistrationMutation.mutate({
                            eventId: event.id,
                            registrationId: registration.id,
                          })
                        }
                      >
                        Annuler l’inscription
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-sans text-xs text-muted">Aucune inscription confirmée.</p>
              )}
            </li>
          ))}
          {events.length === 0 ? (
            <p className="font-sans text-sm text-muted">Aucun événement enregistré.</p>
          ) : null}
        </ul>
      </Card>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Supprimer l'événement ${pendingDelete.title} ?` : ''}
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
