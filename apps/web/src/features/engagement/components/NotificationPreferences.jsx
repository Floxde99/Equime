import { NOTIFICATION_TYPE_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
} from '@/features/engagement/api.js';

/**
 * Préférences in-app / email par type de notification.
 */
export function NotificationPreferences() {
  const qc = useQueryClient();
  const { data: preferences = [] } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: ({ type, patch }) => updateNotificationPreference(type, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  return (
    <Card title="Préférences">
      <ul className="space-y-3">
        {preferences.map((pref) => (
          <li
            key={pref.type}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-on-card bg-paper p-3"
          >
            <div>
              <p className="font-sans text-sm font-semibold text-text">
                {NOTIFICATION_TYPE_LABELS[pref.type]}
              </p>
              <p className="font-sans text-xs text-muted">{pref.type}</p>
            </div>
            <div className="flex gap-2">
              <ToggleButton
                label="In-app"
                active={pref.inAppEnabled}
                onClick={() =>
                  updateMutation.mutate({
                    type: pref.type,
                    patch: { inAppEnabled: !pref.inAppEnabled },
                  })
                }
              />
              <ToggleButton
                label="Email"
                active={pref.emailEnabled}
                onClick={() =>
                  updateMutation.mutate({
                    type: pref.type,
                    patch: { emailEnabled: !pref.emailEnabled },
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** @param {{ label: string, active: boolean, onClick: () => void }} props */
function ToggleButton({ label, active, onClick }) {
  return (
    <Button type="button" variant={active ? 'secondary' : 'ghost'} onClick={onClick}>
      {label}
    </Button>
  );
}
