import { ATTENDANCE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { excuseEnrollment, fetchMyEnrollments } from '@/features/admin/api.js';

/** @param {object} enrollment */
function attendanceBadge(enrollment) {
  if (enrollment.attendance === 'excused')
    return { variant: 'warning', label: ATTENDANCE_STATUS_LABELS.excused };
  return { variant: 'success', label: 'Confirmé' };
}

/**
 * Liste des inscriptions famille à venir, avec action « signaler une absence » (Excel 3.7).
 * @param {{ compact?: boolean, limit?: number }} [props]
 */
export function UpcomingEnrollments({ compact = false, limit } = {}) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(null);

  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: fetchMyEnrollments,
  });

  const mutation = useMutation({
    mutationFn: (enrollment) => excuseEnrollment(enrollment.courseId, enrollment.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-enrollments'] });
      qc.invalidateQueries({ queryKey: ['planning'] });
      setPending(null);
    },
  });

  const items = typeof limit === 'number' ? enrollments.slice(0, limit) : enrollments;

  const list = (
    <ul className={compact ? 'mt-6 space-y-4' : 'space-y-3'}>
      {items.map((enrollment) => {
        const start = new Date(enrollment.course.startAt);
        const badge = attendanceBadge(enrollment);
        const canExcuse = enrollment.attendance !== 'excused';
        return (
          <li
            key={enrollment.id}
            className={
              compact
                ? 'flex items-start gap-4 rounded-xl p-3 hover:bg-paper'
                : 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-on-card bg-paper p-3'
            }
          >
            {compact ? (
              <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-paper">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {start
                    .toLocaleDateString('fr-FR', { weekday: 'short' })
                    .replace('.', '')
                    .toUpperCase()}
                </span>
                <span className="font-display text-2xl text-on-card">{start.getDate()}</span>
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-semibold text-on-card">
                {enrollment.course.title}
              </p>
              <p className="mt-1 font-sans text-xs text-muted-on-card">
                {enrollment.rider.firstName} {enrollment.rider.lastName}
                {' · '}
                {start.toLocaleString('fr-FR', {
                  dateStyle: compact ? undefined : 'short',
                  timeStyle: 'short',
                })}
                {enrollment.course.spaceName ? ` · ${enrollment.course.spaceName}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {canExcuse ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Signaler l'absence de ${enrollment.rider.firstName} au cours ${enrollment.course.title}`}
                  onClick={() => setPending(enrollment)}
                >
                  Signaler une absence
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const dialog = (
    <Dialog
      open={Boolean(pending)}
      onClose={() => setPending(null)}
      title="Signaler une absence"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setPending(null)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => pending && mutation.mutate(pending)}
          >
            Confirmer l&apos;absence
          </Button>
        </>
      }
    >
      {pending ? (
        <p>
          {pending.rider.firstName} sera marqué(e) excusé(e) pour le cours « {pending.course.title}{' '}
          » du {new Date(pending.course.startAt).toLocaleString('fr-FR')}.
        </p>
      ) : null}
      {mutation.isError ? <p className="mt-2 text-danger">{mutation.error.message}</p> : null}
    </Dialog>
  );

  if (compact) {
    return (
      <>
        {items.length === 0 ? (
          <p className="mt-6 font-sans text-sm text-muted-on-card">Aucune séance à venir.</p>
        ) : (
          list
        )}
        {dialog}
      </>
    );
  }

  return (
    <Card title="Séances à venir">
      {items.length === 0 ? (
        <p className="font-sans text-sm text-muted">Aucune séance à venir.</p>
      ) : (
        list
      )}
      {dialog}
    </Card>
  );
}
