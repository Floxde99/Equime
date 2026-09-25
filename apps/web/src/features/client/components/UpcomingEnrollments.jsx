import { ATTENDANCE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FeedbackAlert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { cancelEnrollment, fetchMyEnrollments } from '@/features/admin/api.js';
import { useEntitlements, useRefreshEntitlements } from '@/features/billing/useEntitlements.js';
import { formatDate, formatDateTime, formatDayShort, formatSlot, formatTime } from '@/lib/dates.js';
import { useFeedback } from '@/lib/useFeedback.js';

/** @param {object} enrollment */
function enrollmentBadge(enrollment) {
  if (enrollment.attendance === 'excused') {
    return { variant: 'warning', label: ATTENDANCE_STATUS_LABELS.excused };
  }
  if (enrollment.entitlement === 'makeup') return { variant: 'info', label: 'Rattrapage' };
  return { variant: 'success', label: 'Confirmé' };
}

/**
 * Conséquence d'une annulation maintenant, selon le délai du club (ADR 011).
 * @param {object} enrollment
 * @param {{ cancellationDeadlineHours: number, makeupValidityDays: number }} rules
 */
function cancellationOutcome(enrollment, rules) {
  const inTime = new Date(enrollment.cancellationDeadline) > new Date();
  const name = enrollment.rider.firstName;
  if (!inTime) {
    return `Moins de ${rules.cancellationDeadlineHours} h avant la séance : la place sera libérée, mais sans rattrapage.`;
  }
  if (enrollment.entitlement === 'makeup') {
    return `Le rattrapage utilisé pour cette séance sera rendu à ${name}.`;
  }
  if (enrollment.entitlement === 'forced') return 'La place sera libérée.';
  return `Annulation avant le ${formatDateTime(enrollment.cancellationDeadline)} : ${name} recevra un rattrapage, valable ${rules.makeupValidityDays} jours après la séance.`;
}

/**
 * Séances à venir de la famille, avec annulation (ADR 011) : la règle du délai
 * est rappelée avant de confirmer.
 * @param {{ compact?: boolean, limit?: number }} [props]
 */
export function UpcomingEnrollments({ compact = false, limit } = {}) {
  const refresh = useRefreshEntitlements();
  const feedback = useFeedback();
  const [pending, setPending] = useState(/** @type {object | null} */ (null));
  const { data: entitlements } = useEntitlements();
  const rules = entitlements?.rules ?? { cancellationDeadlineHours: 24, makeupValidityDays: 60 };

  const { data: enrollments = [] } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: fetchMyEnrollments,
  });

  const mutation = useMutation({
    mutationFn: (enrollment) => cancelEnrollment(enrollment.courseId, enrollment.id),
    onSuccess: (result, enrollment) => {
      feedback.success(
        result.credit
          ? `Séance annulée. Rattrapage disponible pour ${enrollment.rider.firstName} jusqu’au ${formatDate(result.credit.expiresAt)}.`
          : 'Séance annulée, la place est libérée.'
      );
      setPending(null);
      refresh();
    },
  });

  const items = typeof limit === 'number' ? enrollments.slice(0, limit) : enrollments;

  const list = (
    <ul className={compact ? 'mt-6 space-y-4' : 'space-y-3'}>
      {items.map((enrollment) => {
        const start = new Date(enrollment.course.startAt);
        const badge = enrollmentBadge(enrollment);
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
                  {formatDayShort(start).split(' ')[0].replace('.', '').toUpperCase()}
                </span>
                <span className="font-display text-2xl text-on-card">
                  {formatDayShort(start).split(' ')[1]}
                </span>
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-semibold text-on-card">
                {enrollment.course.title}
              </p>
              <p className="mt-1 font-sans text-xs text-muted-on-card">
                {enrollment.rider.firstName} {enrollment.rider.lastName}
                {' · '}
                {compact
                  ? `${formatTime(start)} – ${formatTime(enrollment.course.endAt)}`
                  : formatSlot(start, enrollment.course.endAt)}
                {enrollment.course.spaceName ? ` · ${enrollment.course.spaceName}` : ''}
              </p>
              <p className="font-sans text-xs text-muted-on-card">
                {enrollment.course.instructorName}
                {enrollment.horse ? ` · cheval : ${enrollment.horse.name}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Annuler la séance de ${enrollment.rider.firstName} au cours ${enrollment.course.title}`}
                onClick={() => {
                  mutation.reset();
                  setPending(enrollment);
                }}
              >
                Annuler
              </Button>
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
      title="Annuler la séance"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => setPending(null)}>
            Garder la séance
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={mutation.isPending}
            onClick={() => pending && mutation.mutate(pending)}
          >
            Annuler la séance
          </Button>
        </>
      }
    >
      {pending ? (
        <div className="space-y-2 font-sans text-sm text-on-card">
          <p>
            {pending.rider.firstName} au cours « {pending.course.title} » du{' '}
            {formatDateTime(pending.course.startAt)}.
          </p>
          <p>{cancellationOutcome(pending, rules)}</p>
        </div>
      ) : null}
      {mutation.isError ? <p className="mt-2 text-danger">{mutation.error.message}</p> : null}
    </Dialog>
  );

  const empty = <p className="font-sans text-sm text-muted-on-card">Aucune séance à venir.</p>;

  if (compact) {
    return (
      <>
        <FeedbackAlert feedback={feedback.value} className="mt-4" />
        {items.length === 0 ? <div className="mt-6">{empty}</div> : list}
        {dialog}
      </>
    );
  }

  return (
    <Card title="Séances à venir">
      <FeedbackAlert feedback={feedback.value} className="mb-4" />
      {items.length === 0 ? empty : list}
      {dialog}
    </Card>
  );
}
