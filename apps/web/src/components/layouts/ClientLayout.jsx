import { CalendarDays, Home, Receipt, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { LogoutButton } from '@/features/auth/LogoutButton.jsx';
import { cn } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Entrées de navigation client — les sections arrivent en Phases 3-5. */
const NAV_ITEMS = [
  { to: '/app', label: 'Accueil', icon: Home, end: true, ready: true },
  { to: '/app/planning', label: 'Planning', icon: CalendarDays, ready: false },
  { to: '/app/cavaliers', label: 'Cavaliers', icon: Users, ready: false },
  { to: '/app/factures', label: 'Factures', icon: Receipt, ready: false },
];

/**
 * Layout de l'espace client (design system §6) :
 * tab bar en bas sur mobile, barre horizontale en haut sur desktop.
 */
export function ClientLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col pb-20 md:pb-0">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <span className="font-display text-2xl text-text">Equime</span>

          {/* Navigation desktop */}
          <nav aria-label="Navigation principale" className="hidden gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} variant="top" />
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden font-sans text-sm text-muted sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6">
        <Outlet />
      </main>

      {/* Tab bar mobile */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface md:hidden"
      >
        <div className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} variant="tab" />
          ))}
        </div>
      </nav>
    </div>
  );
}

/** @param {{ item: (typeof NAV_ITEMS)[number], variant: 'top' | 'tab' }} props */
function NavItem({ item, variant }) {
  const Icon = item.icon;
  const base =
    variant === 'tab'
      ? 'flex flex-col items-center gap-1 py-2.5 font-sans text-xs'
      : 'flex items-center gap-2 rounded-lg px-3 py-2 font-sans text-sm';

  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title="Disponible dans une prochaine phase"
        className={cn(base, 'cursor-not-allowed text-muted/50')}
      >
        <Icon aria-hidden="true" className={variant === 'tab' ? 'size-5' : 'size-4'} />
        {item.label}
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          base,
          'transition-colors',
          isActive ? 'text-primary' : 'text-muted hover:bg-surface-raised hover:text-text'
        )
      }
    >
      <Icon aria-hidden="true" className={variant === 'tab' ? 'size-5' : 'size-4'} />
      {item.label}
    </NavLink>
  );
}
