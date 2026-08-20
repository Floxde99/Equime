import { createEventSchema, EVENT_TYPE_LABELS, EVENT_TYPE_VALUES } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
import { toDatetimeLocalValue } from '@/lib/formValues.js';

const EVENT_TYPE_OPTIONS = EVENT_TYPE_VALUES.map((value) => ({
  value,
  label: EVENT_TYPE_LABELS[value],
}));

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
  return {
    title: event.title,
    description: event.description ?? '',
    type: event.type,
    startAt: toDatetimeLocalValue(event.startAt),
    endAt: toDatetimeLocalValue(event.endAt),
    capacity: event.capacity,
    priceCents: event.priceCents,
    location: event.location ?? '',
  };
}

export function AdminEventsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const eventForm = useForm({
    resolver: zodResolver(createEventSchema),
    defaultValues: initialForm,
  });
  const { data: events = [] } = useQuery({
    queryKey: ['admin-events'],
    queryFn: fetchAdminEvents,
  });

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      eventForm.reset(initialForm);
      setStatus('Événement créé.');
    },
    onError: (err) => setStatus(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateEvent(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-events'] });
      setEditingId(null);
      eventForm.reset(initialForm);
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
        <form
          className="grid gap-4 md:grid-cols-2"
          noValidate
          onSubmit={eventForm.handleSubmit((values) => {
            if (editingId) {
              updateMutation.mutate({ id: editingId, body: values });
            } else {
              createMutation.mutate(values);
            }
          })}
        >
          <Field
            label="Titre"
            htmlFor="event-title"
            error={eventForm.formState.errors.title?.message}
          >
            <Input
              id="event-title"
              invalid={!!eventForm.formState.errors.title}
              {...eventForm.register('title')}
            />
          </Field>
          <Select
            id="event-type"
            label="Type"
            error={eventForm.formState.errors.type?.message}
            options={EVENT_TYPE_OPTIONS}
            {...eventForm.register('type')}
          />
          <Field
            label="Début"
            htmlFor="event-start"
            error={eventForm.formState.errors.startAt?.message}
          >
            <Input
              id="event-start"
              type="datetime-local"
              invalid={!!eventForm.formState.errors.startAt}
              {...eventForm.register('startAt')}
            />
          </Field>
          <Field label="Fin" htmlFor="event-end" error={eventForm.formState.errors.endAt?.message}>
            <Input
              id="event-end"
              type="datetime-local"
              invalid={!!eventForm.formState.errors.endAt}
              {...eventForm.register('endAt')}
            />
          </Field>
          <Field
            label="Capacité"
            htmlFor="event-capacity"
            error={eventForm.formState.errors.capacity?.message}
          >
            <Input
              id="event-capacity"
              type="number"
              min="1"
              invalid={!!eventForm.formState.errors.capacity}
              {...eventForm.register('capacity')}
            />
          </Field>
          <Field
            label="Prix (centimes)"
            htmlFor="event-price"
            error={eventForm.formState.errors.priceCents?.message}
          >
            <Input
              id="event-price"
              type="number"
              min="0"
              invalid={!!eventForm.formState.errors.priceCents}
              {...eventForm.register('priceCents')}
            />
          </Field>
          <Field
            label="Lieu"
            htmlFor="event-location"
            error={eventForm.formState.errors.location?.message}
          >
            <Input
              id="event-location"
              invalid={!!eventForm.formState.errors.location}
              {...eventForm.register('location')}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="event-description"
            className="md:col-span-2"
            error={eventForm.formState.errors.description?.message}
          >
            <Textarea
              id="event-description"
              rows={4}
              invalid={!!eventForm.formState.errors.description}
              {...eventForm.register('description')}
            />
          </Field>
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingId ? 'Enregistrer' : 'Créer'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  eventForm.reset(initialForm);
                }}
              >
                Annuler
              </Button>
            ) : null}
          </div>
        </form>
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
                      eventForm.reset(eventToForm(event));
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
