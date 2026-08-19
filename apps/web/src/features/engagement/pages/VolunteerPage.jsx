import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  createVolunteerMission,
  deleteVolunteerMission,
  fetchVolunteerMissions,
  signupVolunteerMission,
  updateVolunteerMission,
} from '@/features/engagement/api.js';

const initialForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  slots: 4,
};

/** @param {object} mission */
function missionToForm(mission) {
  const toLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: mission.title,
    description: mission.description ?? '',
    startAt: toLocal(mission.startAt),
    endAt: toLocal(mission.endAt),
    slots: mission.slots,
  };
}

export function VolunteerPage({ admin = false }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const { data: missions = [] } = useQuery({
    queryKey: ['volunteer-missions'],
    queryFn: fetchVolunteerMissions,
  });

  const createMutation = useMutation({
    mutationFn: createVolunteerMission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      setForm(initialForm);
      setStatus('Mission créée.');
    },
    onError: (err) => setStatus(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateVolunteerMission(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      setEditingId(null);
      setForm(initialForm);
      setStatus('Mission mise à jour.');
    },
    onError: (err) => setStatus(err.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteVolunteerMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volunteer-missions'] }),
  });
  const signupMutation = useMutation({
    mutationFn: signupVolunteerMission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      setStatus('Inscription bénévole confirmée.');
    },
    onError: (err) => setStatus(err.message),
  });

  const handleSubmit = () => {
    const body = { ...form };
    if (!body.endAt) delete body.endAt;
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Bénévolat</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          {admin ? 'Gestion des missions bénévoles du club.' : 'Inscription aux missions ouvertes.'}
        </p>
      </div>

      {status ? (
        <Alert variant={status.includes('confirmée') || status.includes('créée') || status.includes('mise à jour') ? 'success' : 'error'}>
          {status}
        </Alert>
      ) : null}

      {admin ? (
        <Card title={editingId ? 'Modifier la mission' : 'Créer une mission'}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titre" htmlFor="mission-title">
              <Input
                id="mission-title"
                value={form.title}
                onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              />
            </Field>
            <Field label="Places" htmlFor="mission-slots">
              <Input
                id="mission-slots"
                type="number"
                min="1"
                value={form.slots}
                onChange={(e) => setForm((current) => ({ ...current, slots: Number(e.target.value || 0) }))}
              />
            </Field>
            <Field label="Début" htmlFor="mission-start">
              <Input
                id="mission-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((current) => ({ ...current, startAt: e.target.value }))}
              />
            </Field>
            <Field label="Fin" htmlFor="mission-end">
              <Input
                id="mission-end"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((current) => ({ ...current, endAt: e.target.value }))}
              />
            </Field>
            <Field label="Description" htmlFor="mission-description" className="md:col-span-2">
              <textarea
                id="mission-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-sans text-sm text-text"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" loading={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editingId ? 'Enregistrer' : 'Créer la mission'}
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
      ) : null}

      <Card title="Missions ouvertes">
        <ul className="space-y-3">
          {missions.map((mission) => (
            <li key={mission.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-sans text-sm font-semibold text-text">{mission.title}</p>
                  <p className="font-sans text-sm text-muted">
                    {new Date(mission.startAt).toLocaleString('fr-FR')} · {mission.remainingSlots} place(s) restante(s)
                  </p>
                  {mission.description ? (
                    <p className="mt-2 font-sans text-sm text-muted">{mission.description}</p>
                  ) : null}
                </div>
                {admin ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(mission.id);
                        setForm(missionToForm(mission));
                        setStatus('');
                      }}
                    >
                      Modifier
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => deleteMutation.mutate(mission.id)}>
                      Supprimer
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={signupMutation.isPending}
                    disabled={mission.remainingSlots <= 0}
                    onClick={() => signupMutation.mutate(mission.id)}
                  >
                    S&apos;inscrire
                  </Button>
                )}
              </div>
            </li>
          ))}
          {missions.length === 0 ? (
            <p className="font-sans text-sm text-muted">Aucune mission ouverte pour le moment.</p>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
