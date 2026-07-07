import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_VALUES } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { Select } from '@/components/ui/select.jsx';
import { fetchEnrollments, fetchPlanning, updateAttendance } from '@/features/admin/api.js';

/** Appel d'une séance — présences (US-4.4). */
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

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-text">Appel</h1>
      <Card title="Choisir une séance">
        <Select
          label="Cours"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={[
            { value: '', label: '— Sélectionner —' },
            ...events.map((e) => ({
              value: e.id,
              label: `${e.title} (${new Date(e.start).toLocaleString('fr-FR')})`,
            })),
          ]}
        />
      </Card>

      {courseId ? (
        <Card title="Présences">
          <ul className="space-y-3">
            {enrollments.map((enrollment) => (
              <li key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-sans text-sm text-text">
                  {enrollment.rider.firstName} {enrollment.rider.lastName}
                </span>
                <div className="flex flex-wrap gap-2">
                  {ATTENDANCE_STATUS_VALUES.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={enrollment.attendance === status ? 'primary' : 'ghost'}
                      onClick={() => mutation.mutate({ enrollmentId: enrollment.id, attendance: status })}
                    >
                      {ATTENDANCE_STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
