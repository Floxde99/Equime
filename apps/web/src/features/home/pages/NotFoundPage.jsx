import { Link } from 'react-router';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';

/**
 * Page 404 — URL inconnue.
 */
export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandLockup tone="light" />
      <HorseIcon className="mt-10 size-16 text-muted" />
      <p className="mt-6 font-sans text-sm uppercase tracking-wide text-muted">Erreur 404</p>
      <h1 className="mt-2 font-display text-4xl text-on-card">Page introuvable</h1>
      <p className="mt-3 max-w-md font-sans text-sm text-muted">
        Cette adresse n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-6 font-sans text-sm font-semibold text-primary-fg hover:bg-primary-light"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
