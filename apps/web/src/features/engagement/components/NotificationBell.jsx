import { Bell } from 'lucide-react';
import { Link } from 'react-router';

import { useNotificationsQuery } from '@/features/engagement/hooks/useNotificationsQuery.js';
import { cn } from '@/lib/utils.js';

/**
 * Cloche header avec badge du nombre de notifications non lues.
 * @param {{ to: string, className?: string }} props
 */
export function NotificationBell({ to, className }) {
  const { data } = useNotificationsQuery();
  const unreadCount = data?.unreadCount ?? 0;
  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
      : 'Notifications';

  return (
    <Link
      to={to}
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-card hover:text-on-card',
        className
      )}
      aria-label={label}
    >
      <Bell className="size-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 font-sans text-[10px] font-semibold leading-4 text-danger-fg"
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
