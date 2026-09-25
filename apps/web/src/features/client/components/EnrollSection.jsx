import { areRiderDocumentsValidAt, RIDER_LEVEL_LABELS } from '@equime/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert, FeedbackAlert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Select } from '@/components/ui/select.jsx';
import { enrollRider, fetchEnrollableCourses } from '@/features/admin/api.js';
import {
  entitlementOf,
  useEntitlements,
  useRefreshEntitlements,
} from '@/features/billing/useEntitlements.js';
import { fetchRiders } from '@/features/riders/api.js';
import { formatDate, formatDateLong, formatDateTime, formatSlot } from '@/lib/dates.js';
import { useFeedback } from '@/lib/useFeedback.js';

const REFUSAL_LABELS = {
  week_full: 'Séance de la semaine déjà prise',
  no_subscription: 'Pas de forfait',
};

/** @param {{ minLevel: string, maxLevel: string }} course */
function levelRange(course) {
  return course.minLevel === course.maxLevel
    ? RIDER_LEVEL_LABELS[course.minLevel]
    : `${RIDER_LEVEL_LABELS[course.minLevel]} à ${RIDER_LEVEL_LABELS[course.maxLevel]}`;
}

/**
 * Regroupe les séances par semaine (lundi, heure de Paris, fourni par l'API).
 * @param {Array<{ weekStart: string }>} courses
 */
function groupByWeek(courses) {
  /** @type {Map<string, typeof courses>} */
  const weeks = new Map();
  for (const course of courses) {
    const list = weeks.get(course.weekStart) ?? [];
    list.push(course);
    weeks.set(course.weekStart, list);
  }
  return [...weeks.entries()];
}

/** @param {{ course: { entitlement: string | null, refusal: string | null } }} props */
function EntitlementBadge({ course }) {
  if (course.entitlement === 'subscription') {
    return <Badge variant="success">Séance du forfait</Badge>;
  }
  if (course.entitlement === 'makeup') return <Badge variant="info">Rattrapage</Badge>;
  return <Badge>{REFUSAL_LABELS[course.refusal] ?? 'Indisponible'}</Badge>;
}

/**
 * Réservation d'une séance pour un cavalier (US-4.3, ADR 011) : séances de son
 * niveau sur 8 semaines, regroupées par semaine, avec le droit consommé.
 */
export function EnrollSection() {
  const refresh = useRefreshEntitlements();
  const feedback = useFeedback();
  const [riderId, setRiderId] = useState('');
  const [pending, setPending] = useState(/** @type {object | null} */ (null));

  const { data: riders = [] } = useQuery({ queryKey: ['riders'], queryFn: fetchRiders });
  const { data: entitlements } = useEntitlements();

  const effectiveRiderId = riderId || riders[0]?.id || '';
  const rider = riders.find((item) => item.id === effectiveRiderId);
  const rights = entitlementOf(entitlements, effectiveRiderId);
  const deadlineHours = entitlements?.rules?.cancellationDeadlineHours ?? 24;

  const coursesQuery = useQuery({
    queryKey: ['enrollable', effectiveRiderId],
    queryFn: () => fetchEnrollableCourses(effectiveRiderId),
    enabled: Boolean(effectiveRiderId),
  });
  const courses = coursesQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: (course) => enrollRider(course.id, effectiveRiderId),
    onSuccess: (enrollment, course) => {
      const detail = enrollment.entitlement === 'makeup' ? ' (1 rattrapage utilisé)' : '';
      feedback.success(
        `${rider?.firstName} est inscrit(e) au cours « ${course.title} » du ${formatDateTime(course.startAt)}${detail}.`
      );
      setPending(null);
      refresh();
    },
  });

  // Sans cavalier, l'inscription est impossible — mais la masquer laisserait
  // l'utilisateur sans indication sur la marche à suivre.
  if (riders.length === 0) {
    return (
      <Card title="Réserver une séance">
        <p className="font-sans text-sm text-muted-on-card">
          Aucun cavalier n&apos;est encore rattaché à votre famille. Ajoutez-en un pour pouvoir
          réserver des séances.
        </p>
        <Link
          to="/app/cavaliers"
          className="mt-3 inline-block font-sans text-sm font-semibold text-primary hover:underline"
        >
          Ajouter un cavalier →
        </Link>
      </Card>
    );
  }

  // Documents vérifiés au jour de la séance par l'API ; ici, un premier filtre.
  const docsOk = areRiderDocumentsValidAt(rider);
  const credits = rights?.credits ?? [];

  return (
    <Card title="Réserver une séance">
      <FeedbackAlert feedback={feedback.value} className="mb-4" />
      <Select
        id="enroll-rider"
        label="Cavalier"
        value={effectiveRiderId}
        onChange={(e) => {
          setRiderId(e.target.value);
          feedback.clear();
        }}
        options={riders.map((r) => ({
          value: r.id,
          label: `${r.firstName} ${r.lastName} (${RIDER_LEVEL_LABELS[r.level]})`,
        }))}
      />

      {rights?.subscription ? (
        <p className="mt-2 font-sans text-sm text-muted-on-card">
          Forfait {rights.subscription.plan.name} : {rights.sessionsPerWeek} séance
          {rights.sessionsPerWeek > 1 ? 's' : ''} par semaine
          {credits.length > 0
            ? ` · ${credits.length} rattrapage${credits.length > 1 ? 's' : ''} disponible${credits.length > 1 ? 's' : ''} (avant le ${formatDate(credits[0].expiresAt)})`
            : ''}
        </p>
      ) : rights ? (
        <Alert variant="info" className="mt-3">
          {rider?.firstName} n&apos;a pas encore de forfait.{' '}
          <Link to="/app/cavaliers" className="underline">
            Choisir un forfait
          </Link>
        </Alert>
      ) : null}
      {!docsOk && rider ? (
        <p className="mt-2 font-sans text-sm text-muted">
          Le certificat médical et la licence FFE doivent être validés et en cours de validité avant
          toute inscription.
        </p>
      ) : null}

      <QueryState
        isPending={coursesQuery.isPending}
        isError={coursesQuery.isError}
        error={coursesQuery.error}
        onRetry={coursesQuery.refetch}
      >
        {courses.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-muted">
            Aucune séance de son niveau n’est ouverte sur les 8 prochaines semaines.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {groupByWeek(courses).map(([weekStart, weekCourses]) => (
              <section key={weekStart} aria-label={`Semaine du ${formatDateLong(weekStart)}`}>
                <h4 className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-muted-on-card">
                  Semaine du {formatDateLong(weekStart)}
                </h4>
                <ul className="space-y-2">
                  {weekCourses.map((course) => (
                    <li
                      key={course.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-on-card bg-paper p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-sans text-sm font-semibold text-text">{course.title}</p>
                        <p className="font-sans text-xs text-muted">
                          {formatSlot(course.startAt, course.endAt)} · {levelRange(course)} ·{' '}
                          {course.instructorName}
                        </p>
                        <p className="font-sans text-xs text-muted">
                          {course.spaceName} · {course.remainingSpots} place
                          {course.remainingSpots > 1 ? 's' : ''} restante
                          {course.remainingSpots > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <EntitlementBadge course={course} />
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!docsOk || !course.entitlement}
                          aria-label={`Réserver ${course.title} du ${formatDateTime(course.startAt)}`}
                          onClick={() => {
                            mutation.reset();
                            setPending(course);
                          }}
                        >
                          Réserver
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </QueryState>

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Confirmer la réservation"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Retour
            </Button>
            <Button
              type="button"
              loading={mutation.isPending}
              onClick={() => pending && mutation.mutate(pending)}
            >
              Confirmer la réservation
            </Button>
          </>
        }
      >
        {pending ? (
          <div className="space-y-2 font-sans text-sm text-on-card">
            <p>
              {rider?.firstName} au cours « {pending.title} » du {formatDateTime(pending.startAt)} (
              {pending.instructorName}).
            </p>
            <p>
              {pending.entitlement === 'makeup'
                ? `Cette réservation utilise 1 rattrapage (il en restera ${Math.max(0, credits.length - 1)}).`
                : 'Cette réservation utilise une séance du forfait de la semaine.'}
            </p>
            <p className="text-xs text-muted-on-card">
              Annulation possible jusqu’à {deadlineHours} h avant la séance avec un rattrapage
              offert ; après, la séance est due.
            </p>
          </div>
        ) : null}
        {mutation.isError ? <Alert className="mt-3">{mutation.error.message}</Alert> : null}
      </Dialog>
    </Card>
  );
}
