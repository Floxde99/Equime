import { NOTIFICATION_TYPE_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { useSpaceEyebrow } from '@/lib/useSpaceEyebrow.js';
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markNotificationRead,
  updateNotificationPreference,
} from '@/features/engagement/api.js';

export function NotificationsPage() {
  const eyebrow = useSpaceEyebrow();
  const qc = useQueryClient();
  const { data: preferences = [] } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ type, patch }) => updateNotificationPreference(type, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });
  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Notifications"
        description="Gérez vos préférences par canal et consultez vos dernières alertes."
      />

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

      <Card title="Centre de notifications">
        {notifications.length === 0 ? (
          <p className="font-sans text-sm text-muted">Aucune notification pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className="rounded-xl border border-border-on-card bg-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm font-semibold text-text">{notification.title}</p>
                    <Badge variant={notification.readAt ? 'default' : 'info'}>
                      {notification.readAt ? 'Lue' : 'Nouvelle'}
                    </Badge>
                  </div>
                  {!notification.readAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => readMutation.mutate(notification.id)}
                    >
                      Marquer comme lue
                    </Button>
                  ) : null}
                </div>
                {notification.body ? (
                  <p className="mt-2 font-sans text-sm text-muted">{notification.body}</p>
                ) : null}
                {notification.linkUrl ? (
                  <a
                    href={notification.linkUrl}
                    className="mt-2 inline-block font-sans text-xs text-on-card underline underline-offset-2"
                  >
                    Ouvrir le lien
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ToggleButton({ label, active, onClick }) {
  return (
    <Button type="button" variant={active ? 'secondary' : 'ghost'} onClick={onClick}>
      {label}
    </Button>
  );
}
