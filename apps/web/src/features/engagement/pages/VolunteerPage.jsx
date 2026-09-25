import { createVolunteerMissionSchema } from '@equime/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FeedbackAlert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { ConfirmDialog } from '@/components/ui/dialog.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  createVolunteerMission,
  deleteVolunteerMission,
  fetchVolunteerMissions,
  signupVolunteerMission,
  updateVolunteerMission,
} from '@/features/engagement/api.js';
import { formatSlot } from '@/lib/dates.js';
import { missionPhotoSrc } from '@/lib/demoPhotos.js';
import { blankToUndefined, toDatetimeLocalValue } from '@/lib/formValues.js';
import { useFeedback } from '@/lib/useFeedback.js';
import { useSpaceEyebrow } from '@/lib/useSpaceEyebrow.js';

const initialForm = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  slots: 4,
};

/** @param {object} mission */
function missionToForm(mission) {
  return {
    title: mission.title,
    description: mission.description ?? '',
    startAt: toDatetimeLocalValue(mission.startAt),
    endAt: toDatetimeLocalValue(mission.endAt),
    slots: mission.slots,
  };
}

/**
 * @param {{ isAdmin: boolean }} props
 */
function VolunteerPageView({ isAdmin }) {
  const eyebrow = useSpaceEyebrow();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const feedback = useFeedback();
  const [pendingDelete, setPendingDelete] = useState(null);
  const missionForm = useForm({
    resolver: zodResolver(createVolunteerMissionSchema),
    defaultValues: initialForm,
  });
  const { data: missions = [] } = useQuery({
    queryKey: ['volunteer-missions'],
    queryFn: fetchVolunteerMissions,
  });

  const createMutation = useMutation({
    mutationFn: createVolunteerMission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      missionForm.reset(initialForm);
      feedback.success('Mission créée.');
    },
    onError: (err) => feedback.error(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateVolunteerMission(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      setEditingId(null);
      missionForm.reset(initialForm);
      feedback.success('Mission mise à jour.');
    },
    onError: (err) => feedback.error(err.message),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteVolunteerMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['volunteer-missions'] }),
  });
  const signupMutation = useMutation({
    mutationFn: signupVolunteerMission,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volunteer-missions'] });
      feedback.success('Inscription bénévole confirmée.');
    },
    onError: (err) => feedback.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={isAdmin ? 'Bénévolat' : 'Espace bénévole'}
        description={
          isAdmin
            ? 'Gestion des missions bénévoles du club.'
            : 'Donnez un peu de votre temps aux écuries — missions ouvertes, photos du domaine.'
        }
      />

      <FeedbackAlert feedback={feedback.value} />

      {isAdmin ? (
        <Card title={editingId ? 'Modifier la mission' : 'Créer une mission'}>
          <form
            className="grid gap-4 md:grid-cols-2"
            noValidate
            onSubmit={missionForm.handleSubmit((values) => {
              if (editingId) {
                updateMutation.mutate({ id: editingId, body: values });
              } else {
                createMutation.mutate(values);
              }
            })}
          >
            <Field
              label="Titre"
              htmlFor="mission-title"
              error={missionForm.formState.errors.title?.message}
            >
              <Input
                id="mission-title"
                invalid={!!missionForm.formState.errors.title}
                {...missionForm.register('title')}
              />
            </Field>
            <Field
              label="Places"
              htmlFor="mission-slots"
              error={missionForm.formState.errors.slots?.message}
            >
              <Input
                id="mission-slots"
                type="number"
                min="1"
                invalid={!!missionForm.formState.errors.slots}
                {...missionForm.register('slots')}
              />
            </Field>
            <Field
              label="Début"
              htmlFor="mission-start"
              error={missionForm.formState.errors.startAt?.message}
            >
              <Input
                id="mission-start"
                type="datetime-local"
                invalid={!!missionForm.formState.errors.startAt}
                {...missionForm.register('startAt')}
              />
            </Field>
            <Field
              label="Fin"
              htmlFor="mission-end"
              error={missionForm.formState.errors.endAt?.message}
            >
              <Input
                id="mission-end"
                type="datetime-local"
                invalid={!!missionForm.formState.errors.endAt}
                {...missionForm.register('endAt', { setValueAs: blankToUndefined })}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="mission-description"
              className="md:col-span-2"
              error={missionForm.formState.errors.description?.message}
            >
              <Textarea
                id="mission-description"
                rows={4}
                invalid={!!missionForm.formState.errors.description}
                {...missionForm.register('description')}
              />
            </Field>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingId ? 'Enregistrer' : 'Créer la mission'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    missionForm.reset(initialForm);
                  }}
                >
                  Annuler
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}

      <div className={isAdmin ? 'space-y-3' : 'grid gap-6 md:grid-cols-2'}>
        {missions.map((mission) => (
          <Card key={mission.id} className="overflow-hidden p-0">
            <img src={missionPhotoSrc(mission.id)} alt="" className="h-48 w-full object-cover" />
            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div>
                <p className="font-display text-xl text-on-card">{mission.title}</p>
                <p className="mt-1 font-sans text-sm text-muted-on-card">
                  {formatSlot(mission.startAt, mission.endAt)} · {mission.remainingSlots} place(s)
                  restante(s)
                </p>
                {mission.description ? (
                  <p className="mt-2 font-sans text-sm text-muted-on-card">{mission.description}</p>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(mission.id);
                      missionForm.reset(missionToForm(mission));
                      feedback.clear();
                    }}
                  >
                    Modifier
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingDelete(mission)}>
                    Supprimer
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  loading={signupMutation.isPending && signupMutation.variables === mission.id}
                  disabled={mission.remainingSlots <= 0}
                  onClick={() => signupMutation.mutate(mission.id)}
                >
                  S&apos;inscrire
                </Button>
              )}
            </div>
          </Card>
        ))}
        {missions.length === 0 ? (
          <Card>
            <p className="font-sans text-sm text-muted-on-card">
              Aucune mission ouverte pour le moment.
            </p>
          </Card>
        ) : null}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Supprimer la mission ${pendingDelete.title} ?` : ''}
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

/** Espace famille / moniteur — inscription aux missions. */
export function VolunteerPage() {
  return <VolunteerPageView isAdmin={false} />;
}

/** Administration — CRUD des missions bénévoles. */
export function AdminVolunteerPage() {
  return <VolunteerPageView isAdmin={true} />;
}
