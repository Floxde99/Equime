import { RIDER_LEVEL_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Select } from '@/components/ui/select.jsx';
import { enrollRider, fetchEnrollableCourses } from '@/features/admin/api.js';
import { fetchRiders } from '@/features/riders/api.js';

/** @param {string | Date | null | undefined} expiresAt */
function isDocumentExpired(expiresAt) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const now = new Date();
  const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return expiryDay < today;
}

/** @param {object} rider */
function riderDocumentsApproved(rider) {
  return (
    rider?.medicalCertificateStatus === 'approved' &&
    rider?.licenseStatus === 'approved' &&
    !isDocumentExpired(rider.medicalCertificateExpiresAt) &&
    !isDocumentExpired(rider.licenseExpiresAt)
  );
}

/** Inscription à un cours compatible (US-4.3). */
export function EnrollSection() {
  const qc = useQueryClient();
  const [riderId, setRiderId] = useState('');

  const { data: riders = [] } = useQuery({ queryKey: ['riders'], queryFn: fetchRiders });
  const { data: courses = [] } = useQuery({
    queryKey: ['enrollable'],
    queryFn: fetchEnrollableCourses,
  });

  const effectiveRiderId = riderId || riders[0]?.id || '';
  const selectedRider = riders.find((rider) => rider.id === effectiveRiderId);
  const docsOk = riderDocumentsApproved(selectedRider);

  const mutation = useMutation({
    mutationFn: ({ courseId, rider }) => enrollRider(courseId, rider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollable'] });
      qc.invalidateQueries({ queryKey: ['planning'] });
      qc.invalidateQueries({ queryKey: ['my-enrollments'] });
    },
  });

  // Sans cavalier, l'inscription est impossible — mais la masquer laisserait
  // l'utilisateur sans indication sur la marche à suivre.
  if (riders.length === 0) {
    return (
      <Card title="Inscrire un cavalier">
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

  return (
    <Card title="Inscrire un cavalier">
      {mutation.isError ? <Alert className="mb-4">{mutation.error.message}</Alert> : null}
      <Select
        id="enroll-rider"
        label="Cavalier"
        value={effectiveRiderId}
        onChange={(e) => setRiderId(e.target.value)}
        options={riders.map((r) => ({
          value: r.id,
          label: `${r.firstName} ${r.lastName} (${RIDER_LEVEL_LABELS[r.level]})`,
        }))}
      />
      {!docsOk && selectedRider ? (
        <p className="mt-2 font-sans text-sm text-muted">
          Le certificat médical et la licence FFE doivent être validés et en cours de validité avant
          toute inscription.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {courses.length === 0 ? (
          <p className="font-sans text-sm text-muted">Aucun cours disponible pour le moment.</p>
        ) : (
          courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-on-card bg-paper p-3"
            >
              <div>
                <p className="font-sans text-sm font-semibold text-text">{course.title}</p>
                <p className="font-sans text-xs text-muted">
                  {new Date(course.startAt).toLocaleString('fr-FR')} — {course.spaceName} (
                  {course.enrolledCount}/{course.capacity})
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!docsOk}
                onClick={() => mutation.mutate({ courseId: course.id, rider: effectiveRiderId })}
                loading={mutation.isPending && mutation.variables?.courseId === course.id}
              >
                Réserver
              </Button>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
