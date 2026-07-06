import { Outlet } from 'react-router';

import { LogoutButton } from '@/features/auth/LogoutButton.jsx';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Layout de l'espace moniteur (design system §6) : interface sobre orientée
 * consultation rapide — un header simple, le contenu en pleine largeur.
 */
export function InstructorLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl text-text">Equime</span>
            <span className="font-sans text-xs uppercase tracking-wide text-muted">Moniteur</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-sans text-sm text-muted sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        <Outlet />
      </main>
    </div>
  );
}
