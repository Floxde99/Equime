import { Link, Outlet } from 'react-router';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { SkipLink } from '@/components/ui/skip-link.jsx';

/**
 * Gabarit auth desktop Stitch : photo à gauche, carte formulaire à droite.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-paper">
      <SkipLink href="#auth" />
      <aside className="relative hidden w-[46%] overflow-hidden lg:block">
        <img
          src="/images/hero-centre.webp"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/50" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="inline-flex w-fit text-white">
            <BrandLockup tone="dark" showMark={false} className="text-white" />
          </Link>
          <div>
            <p className="max-w-sm font-display text-4xl leading-tight text-white">
              Le centre, simplement.
            </p>
            <p className="mt-4 max-w-sm font-sans text-sm text-white/80">
              Planning, cavalerie, réservations et facturation.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link to="/" className="mb-8 inline-flex lg:hidden">
          <BrandLockup tone="light" showMark={false} />
        </Link>
        <main
          id="auth"
          className="w-full max-w-md bg-white p-10 text-on-card shadow-sm [&_.text-text]:text-on-card [&_.text-muted]:text-muted-on-card"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
