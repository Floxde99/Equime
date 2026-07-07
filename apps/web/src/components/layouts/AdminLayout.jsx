import {
  Bell,
  CalendarDays,
  HandHelping,
  LayoutDashboard,
  MessageSquare,
  PawPrint,
  Receipt,
  Siren,
  Users,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { LogoutButton } from '@/features/auth/LogoutButton.jsx';
import { cn } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Sections admin — activées au fil des Phases 3-6. */
const NAV_ITEMS = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true, ready: true },
  { to: '/admin/planning', label: 'Planning', icon: CalendarDays, ready: true },
  { to: '/admin/cavalerie', label: 'Cavalerie', icon: PawPrint, ready: true },
  { to: '/admin/evenements', label: 'Événements', icon: CalendarDays, ready: true },
  { to: '/admin/incidents', label: 'Incidents', icon: Siren, ready: true },
  { to: '/admin/benevolat', label: 'Bénévolat', icon: HandHelping, ready: true },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare, ready: true },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell, ready: true },
  { to: '/admin/clients', label: 'Clients', icon: Users, ready: true },
  { to: '/admin/facturation', label: 'Facturation', icon: Receipt, ready: true },
];

/**
 * Layout de l'espace admin (design system §6) : sidebar fixe sur desktop,
 * header + navigation repliée en liste sur mobile.
 */
export function AdminLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 py-6">
          <span className="font-display text-2xl text-text">Equime</span>
          <p className="mt-0.5 font-sans text-xs uppercase tracking-wide text-muted">
            Administration
          </p>
        </div>
        <nav aria-label="Navigation d'administration" className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => (
            <SidebarItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="px-3 pb-1 font-sans text-xs text-muted">
            {user?.firstName} {user?.lastName}
          </p>
          <LogoutButton className="w-full justify-start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center justify-between border-b border-border px-4 py-4 md:hidden">
          <span className="font-display text-xl text-text">Equime — Admin</span>
          <LogoutButton />
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** @param {{ item: (typeof NAV_ITEMS)[number] }} props */
function SidebarItem({ item }) {
  const Icon = item.icon;
  const base = 'flex items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm';

  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title="Disponible dans une prochaine phase"
        className={cn(base, 'cursor-not-allowed text-muted/50')}
      >
        <Icon aria-hidden="true" className="size-4" />
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
          isActive
            ? 'bg-surface-raised text-primary'
            : 'text-muted hover:bg-surface-raised hover:text-text'
        )
      }
    >
      <Icon aria-hidden="true" className="size-4" />
      {item.label}
    </NavLink>
  );
}
