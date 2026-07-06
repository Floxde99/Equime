import { useEffect } from 'react';

import { refreshSession, setOnSessionExpired } from '@/lib/apiClient.js';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Amorce la session au chargement de l'application :
 * tente un refresh silencieux (cookie httpOnly) — si un refresh token valide
 * existe, l'utilisateur est reconnecté sans revoir l'écran de login.
 * Branche aussi la déconnexion automatique quand la session meurt
 * (refresh refusé en cours d'usage : expiration, révocation, ban).
 */
export function AuthProvider({ children }) {
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    setOnSessionExpired(clear);

    refreshSession()
      .then((data) => {
        if (data) setUser(data.user);
        else clear();
      })
      .catch(() => clear());
  }, [setUser, clear]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <span className="font-display text-3xl text-muted">Equime</span>
      </div>
    );
  }

  return children;
}
