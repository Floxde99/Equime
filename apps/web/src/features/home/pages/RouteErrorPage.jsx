import { Link, useRouteError } from 'react-router';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { Button } from '@/components/ui/button.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';
import { describeRouteError, homePathForUser } from '@/lib/routeError.js';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Filet UX pour les erreurs de route (remplace l’écran technique React Router).
 * @param {{ embedded?: boolean }} props
 */
export function RouteErrorPage({ embedded = false }) {
  const error = useRouteError();
  const user = useAuthStore((s) => s.user);
  const { userMessage, devMessage } = describeRouteError(error);
  const homeTo = homePathForUser(user);
  const showDevDetail = Boolean(import.meta.env.DEV && devMessage);

  const content = (
    <>
      <HorseIcon className={embedded ? 'size-12 text-muted' : 'mt-10 size-16 text-muted'} />
      <p className="mt-6 font-sans text-sm uppercase tracking-wide text-muted">Erreur</p>
      <h1 className="mt-2 font-display text-4xl text-on-card">Impossible d’afficher cette page</h1>
      <p className="mt-3 max-w-md font-sans text-sm text-muted">{userMessage}</p>
      {showDevDetail ? (
        <details className="mt-6 max-w-md text-left">
          <summary className="cursor-pointer font-sans text-sm font-semibold text-muted-on-card">
            Détail technique (développement)
          </summary>
          <p className="mt-2 font-sans text-sm text-muted-on-card">{devMessage}</p>
        </details>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
        <Link
          to={homeTo}
          className="inline-flex h-11 items-center rounded-lg border border-border-on-card bg-card px-6 font-sans text-sm font-semibold text-on-card hover:bg-border-on-card/40"
        >
          Retour à l’accueil
        </Link>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col items-center py-8 text-center">{content}</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <BrandLockup tone="light" />
      {content}
    </main>
  );
}
