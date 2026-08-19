import { useEffect } from 'react';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" aria-busy="true">
        <BrandLockup size="lg" tone="dark" />
        <div className="h-4 w-48 animate-pulse rounded-lg bg-border-on-card motion-reduce:animate-none" />
      </div>
    );
  }

  return children;
}
