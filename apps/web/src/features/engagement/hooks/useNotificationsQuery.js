import { useQuery } from '@tanstack/react-query';

import { fetchNotifications } from '@/features/engagement/api.js';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'];

/**
 * Polling global des notifications in-app (cloche + page).
 */
export function useNotificationsQuery() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
