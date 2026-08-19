import { isRouteErrorResponse } from 'react-router';

import { HOME_BY_ROLE } from '@/features/auth/guards.jsx';

export const ROUTE_ERROR_USER_MESSAGE =
  'Un incident temporaire empêche l’affichage. Vous pouvez réessayer, ou revenir à l’accueil.';

/**
 * Distingue le message utilisateur du détail technique (DEV uniquement).
 * @param {unknown} error
 * @returns {{ userMessage: string, devMessage: string }}
 */
export function describeRouteError(error) {
  if (isRouteErrorResponse(error)) {
    return {
      userMessage: ROUTE_ERROR_USER_MESSAGE,
      devMessage: `${error.status} ${error.statusText}`.trim(),
    };
  }
  if (error instanceof Error && error.message) {
    return { userMessage: ROUTE_ERROR_USER_MESSAGE, devMessage: error.message };
  }
  return { userMessage: ROUTE_ERROR_USER_MESSAGE, devMessage: '' };
}

/**
 * Accueil selon le rôle, ou la vitrine si anonyme.
 * @param {{ role?: string } | null | undefined} user
 */
export function homePathForUser(user) {
  if (!user?.role) return '/';
  return HOME_BY_ROLE[user.role] ?? '/';
}
