import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/engagement/api.js';
import {
  NOTIFICATIONS_QUERY_KEY,
  useNotificationsQuery,
} from '@/features/engagement/hooks/useNotificationsQuery.js';

/**
 * Centre de notifications in-app (liste + tout marquer comme lu).
 */
export function NotificationInbox() {
  const qc = useQueryClient();
  const { data } = useNotificationsQuery();
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (updated) => {
      qc.setQueryData(NOTIFICATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        const wasUnread = old.notifications.some((n) => n.id === updated.id && !n.readAt);
        return {
          notifications: old.notifications.map((n) => (n.id === updated.id ? updated : n)),
          unreadCount: wasUnread ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
        };
      });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.setQueryData(NOTIFICATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        return {
          notifications: old.notifications.map((n) => ({
            ...n,
            readAt: n.readAt ?? now,
          })),
          unreadCount: 0,
        };
      });
    },
  });

  return (
    <Card title="Centre de notifications">
      {unreadCount > 0 ? (
        <div className="mb-4 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            Tout marquer comme lu
          </Button>
        </div>
      ) : null}
      {notifications.length === 0 ? (
        <p className="font-sans text-sm text-muted">Aucune notification pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="rounded-xl border border-border-on-card bg-paper p-4"
            >
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
                <Link
                  to={notification.linkUrl}
                  className="mt-2 inline-block font-sans text-xs text-on-card underline underline-offset-2"
                  onClick={() => {
                    if (!notification.readAt) {
                      readMutation.mutate(notification.id);
                    }
                  }}
                >
                  Ouvrir le lien
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
