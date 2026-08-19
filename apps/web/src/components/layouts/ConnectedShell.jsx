import { Bell, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { SkipLink } from '@/components/ui/skip-link.jsx';
import { LogoutButton } from '@/features/auth/LogoutButton.jsx';
import { cn } from '@/lib/utils.js';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Chrome Stitch partagé : sidebar claire 288px + header sticky Equime.
 *
 * @param {{
 *   eyebrow: string,
 *   items: Array<{ to: string, label: string, icon: import('react').ComponentType<{ className?: string }>, end?: boolean }>,
 *   cta: { to: string, label: string },
 *   notificationsTo: string,
 *   navLabel: string,
 * }} props
 */
export function ConnectedShell({ eyebrow, items, cta, notificationsTo, navLabel }) {
  const user = useAuthStore((s) => s.user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <SkipLink />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-paper md:flex">
        <SidebarBody eyebrow={eyebrow} items={items} cta={cta} navLabel={navLabel} />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-72 flex-col bg-paper shadow-[0_12px_32px_rgba(26,28,28,0.12)]">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-lg text-on-card"
                aria-label="Fermer le menu"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarBody
              eyebrow={eyebrow}
              items={items}
              cta={cta}
              navLabel={`${navLabel} mobile`}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="md:ml-72">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-lg text-on-card md:hidden"
                aria-label="Ouvrir le menu"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <Menu className="size-5" />
              </button>
              <BrandLockup size="md" tone="dark" showMark={false} />
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={notificationsTo}
                className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-white hover:text-on-card"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
              </Link>
              <span
                className="inline-flex size-10 items-center justify-center rounded-full bg-primary font-sans text-sm font-semibold text-primary-fg"
                aria-hidden="true"
              >
                {initials || 'EQ'}
              </span>
              <span className="sr-only">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
          </div>
        </header>

        <main id="contenu" className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** @param {{ eyebrow: string, items: Array<object>, cta: { to: string, label: string }, navLabel: string, onNavigate?: () => void }} props */
function SidebarBody({ eyebrow, items, cta, navLabel, onNavigate }) {
  return (
    <div className="flex h-full flex-col py-8">
      <div className="mb-8 px-8">
        <BrandLockup size="md" tone="dark" />
        <p className="mt-2 font-sans text-xs uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
      </div>

      <nav aria-label={navLabel} className="flex-1 space-y-1">
        {items.map((item) => (
          <SidebarItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="px-6 pt-4">
        <Link
          to={cta.to}
          onClick={onNavigate}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-primary font-sans text-sm font-semibold text-primary-fg hover:bg-primary-light"
        >
          {cta.label}
        </Link>
      </div>

      <div className="mt-4 px-3">
        <LogoutButton className="w-full justify-start" />
      </div>
    </div>
  );
}

/** @param {{ item: { to: string, label: string, icon: import('react').ComponentType<{ className?: string }>, end?: boolean }, onNavigate?: () => void }} props */
function SidebarItem({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 py-3 font-sans text-sm transition-colors',
          isActive
            ? 'border-l-4 border-primary bg-white/60 pl-4 font-semibold text-primary'
            : 'border-l-4 border-transparent pl-5 text-muted hover:bg-white/50 hover:text-on-card'
        )
      }
    >
      <Icon aria-hidden="true" className="size-5" />
      {item.label}
    </NavLink>
  );
}
