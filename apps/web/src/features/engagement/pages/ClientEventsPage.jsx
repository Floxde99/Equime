import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Select } from '@/components/ui/select.jsx';
import { fetchPublicEvents, registerForEvent } from '@/features/engagement/api.js';
import { fetchRiders } from '@/features/riders/api.js';

export function ClientEventsPage() {
  const qc = useQueryClient();
  const [selectedRiders, setSelectedRiders] = useState({});
  const [status, setStatus] = useState('');

  const { data: events = [] } = useQuery({
    queryKey: ['public-events'],
    queryFn: fetchPublicEvents,
  });
  const { data: riders = [] } = useQuery({
    queryKey: ['riders'],
    queryFn: fetchRiders,
  });

  const mutation = useMutation({
    mutationFn: ({ eventId, riderId }) => registerForEvent(eventId, riderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-events'] });
      setStatus('Inscription confirmée.');
    },
    onError: (err) => setStatus(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Événements</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          Stages et compétitions à venir, avec inscription par cavalier.
        </p>
      </div>

      {status ? <Alert variant={status.includes('confirmée') ? 'success' : 'error'}>{status}</Alert> : null}

      <div className="grid gap-4">
        {events.map((event) => (
          <Card key={event.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-sans text-lg font-semibold text-text">{event.title}</h2>
                <p className="font-sans text-sm text-muted">
                  {new Date(event.startAt).toLocaleString('fr-FR')} · {event.location || 'Lieu communiqué plus tard'}
                </p>
                {event.description ? (
                  <p className="mt-2 font-sans text-sm text-muted">{event.description}</p>
                ) : null}
              </div>
              <p className="font-sans text-sm text-muted">
                {event.registeredCount}/{event.capacity} inscrits
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Select
                  label="Cavalier"
                  value={selectedRiders[event.id] ?? ''}
                  onChange={(e) =>
                    setSelectedRiders((current) => ({ ...current, [event.id]: e.target.value }))
                  }
                  options={[
                    { value: '', label: '— Sélectionner —' },
                    ...riders.map((rider) => ({
                      value: rider.id,
                      label: `${rider.firstName} ${rider.lastName}`,
                    })),
                  ]}
                />
              </div>
              <Button
                type="button"
                disabled={!selectedRiders[event.id]}
                loading={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    eventId: event.id,
                    riderId: selectedRiders[event.id],
                  })
                }
              >
                Inscrire
              </Button>
            </div>
          </Card>
        ))}
        {events.length === 0 ? (
          <Card>
            <p className="font-sans text-sm text-muted">Aucun événement à venir pour le moment.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
