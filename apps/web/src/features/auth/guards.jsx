import { ROLES } from '@equime/shared';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '@/stores/authStore.js';

/** Route d'accueil de chaque rôle après connexion. */
export const HOME_BY_ROLE = {
  [ROLES.CLIENT]: '/app',
  [ROLES.INSTRUCTOR]: '/moniteur',
  [ROLES.ADMIN]: '/admin',
};

/**
 * Guard d'authentification : redirige vers /login (en mémorisant la page
 * demandée) si la session est absente.
 * @param {{ roles?: string[] }} props Rôles autorisés (tous si omis)
 */
export function RequireAuth({ roles }) {
  const { user, status } = useAuthStore();
  const location = useLocation();

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    // Connecté mais pas le bon rôle : renvoi vers son espace, pas vers /login
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  }
  return <Outlet />;
}

/**
 * Guard inverse pour les pages publiques d'auth : un utilisateur déjà
 * connecté est renvoyé vers son espace.
 */
export function RedirectIfAuthenticated() {
  const { user, status } = useAuthStore();

  if (status === 'authenticated') {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  }
  return <Outlet />;
}
