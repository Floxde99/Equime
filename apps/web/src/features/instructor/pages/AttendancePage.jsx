import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_VALUES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { HorsePortrait } from '@/components/ui/horse-portrait.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { Select } from '@/components/ui/select.jsx';
import { fetchEnrollments, fetchPlanning, updateAttendance } from '@/features/admin/api.js';

/** Appel d'une séance — cartes cavaliers (artboard Stitch `d_tail_de_s_ance_moniteur`). */
export function AttendancePage() {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');

  const range = {
    from: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
    to: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
  };

  const { data: events = [] } = useQuery({
    queryKey: ['planning', range, 'mine'],
    queryFn: () => fetchPlanning(range.from, range.to, 'mine'),
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: () => fetchEnrollments(courseId),
    enabled: Boolean(courseId),
  });

  const mutation = useMutation({
    mutationFn: ({ enrollmentId, attendance }) =>
      updateAttendance(courseId, enrollmentId, attendance),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments', courseId] }),
  });

  const selected = events.find((event) => event.id === courseId);
  const start = selected ? new Date(selected.start) : null;
  const end = selected ? new Date(selected.end) : null;
  const live = start && end ? Date.now() >= start.getTime() && Date.now() <= end.getTime() : false;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Espace moniteur"
        title="Détail de séance"
        description="Présences et montures attribuées."
      />

      <Card title="Choisir une séance">
        <Select
          label="Cours"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={[
            { value: '', label: '— Sélectionner —' },
            ...events.map((event) => ({
              value: event.id,
              label: `${event.title} (${new Date(event.start).toLocaleString('fr-FR')})`,
            })),
          ]}
        />
      </Card>

      {selected ? (
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              {live ? <Badge variant="success">En cours</Badge> : <Badge>Planifié</Badge>}
              <span className="font-sans text-sm text-muted">
                {selected.extendedProps?.spaceName}
              </span>
            </div>
            <h2 className="font-display text-4xl text-primary">{selected.title}</h2>
            <p className="mt-2 font-sans text-sm text-muted">
              {start?.toLocaleString('fr-FR')} · {selected.extendedProps?.instructorName}
            </p>
          </div>
        </header>
      ) : null}

      {courseId ? (
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-8" title="Liste des élèves">
            {enrollments.length === 0 ? (
              <p className="font-sans text-sm text-muted-on-card">
                Aucun cavalier inscrit sur cette séance.
              </p>
            ) : (
              <ul className="space-y-4">
                {enrollments.map((enrollment) => {
                  const initials =
                    `${enrollment.rider.firstName?.[0] ?? ''}${enrollment.rider.lastName?.[0] ?? ''}`.toUpperCase();
                  return (
                    <li
                      key={enrollment.id}
                      className="flex flex-col gap-4 rounded-xl bg-paper p-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          aria-hidden="true"
                          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-sans text-sm font-semibold text-primary-fg"
                        >
                          {initials}
                        </span>
                        <div>
                          <p className="font-sans text-sm font-semibold text-on-card">
                            {enrollment.rider.firstName} {enrollment.rider.lastName}
                          </p>
                          <p className="mt-1 flex items-center gap-2 font-sans text-sm text-muted-on-card">
                            {enrollment.horse ? (
                              <>
                                <HorsePortrait
                                  horse={enrollment.horse}
                                  alt=""
                                  className="size-6 rounded-full"
                                />
                                {enrollment.horse.name}
                              </>
                            ) : (
                              'Monture non attribuée'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ATTENDANCE_STATUS_VALUES.map((status) => (
                          <Button
                            key={status}
                            type="button"
                            variant={enrollment.attendance === status ? 'secondary' : 'ghost'}
                            onClick={() =>
                              mutation.mutate({ enrollmentId: enrollment.id, attendance: status })
                            }
                          >
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </Button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="col-span-12 lg:col-span-4">
            <h3 className="font-display text-xl text-primary">Effectif</h3>
            <p className="mt-4 font-display text-5xl text-on-card">{enrollments.length}</p>
            <p className="mt-2 font-sans text-sm text-muted-on-card">cavalier(s) inscrit(s)</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
