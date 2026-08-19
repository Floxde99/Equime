import { RIDER_LEVEL_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Select } from '@/components/ui/select.jsx';
import { enrollRider, fetchEnrollableCourses } from '@/features/admin/api.js';
import { fetchRiders } from '@/features/riders/api.js';

/** Inscription à un cours compatible (US-4.3). */
export function EnrollSection() {
  const qc = useQueryClient();
  const [riderId, setRiderId] = useState('');

  const { data: riders = [] } = useQuery({ queryKey: ['riders'], queryFn: fetchRiders });
  const { data: courses = [] } = useQuery({ queryKey: ['enrollable'], queryFn: fetchEnrollableCourses });

  const mutation = useMutation({
    mutationFn: ({ courseId, rider }) => enrollRider(courseId, rider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enrollable'] });
      qc.invalidateQueries({ queryKey: ['planning'] });
    },
  });

  if (riders.length === 0) return null;

  return (
    <Card title="Inscrire un cavalier">
      <Select
        id="enroll-rider"
        label="Cavalier"
        value={riderId || riders[0]?.id}
        onChange={(e) => setRiderId(e.target.value)}
        options={riders.map((r) => ({
          value: r.id,
          label: `${r.firstName} ${r.lastName} (${RIDER_LEVEL_LABELS[r.level]})`,
        }))}
      />
      <ul className="mt-4 space-y-2">
        {courses.length === 0 ? (
          <p className="font-sans text-sm text-muted">Aucun cours disponible pour le moment.</p>
        ) : (
          courses.map((course) => (
            <li
              key={course.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
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
                onClick={() =>
                  mutation.mutate({ courseId: course.id, rider: riderId || riders[0].id })
                }
                loading={mutation.isPending}
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
