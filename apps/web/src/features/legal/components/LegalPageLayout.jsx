import { Link } from 'react-router';

import { BrandLockup } from '@/components/ui/brand-lockup.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useLegalInfo } from '@/features/legal/api.js';
import { LegalLinks } from '@/features/legal/components/LegalLinks.jsx';

/**
 * Gabarit commun des pages légales : charge l'identité de l'instance puis
 * passe les données à `children` (fonction de rendu).
 *
 * @param {{ title: string, children: (info: object) => import('react').ReactNode }} props
 */
export function LegalPageLayout({ title, children }) {
  const { data, isPending, isError, error, refetch } = useLegalInfo();

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-border-on-card bg-card px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" aria-label="Retour à l’accueil">
            <BrandLockup tone="light" showMark={false} />
          </Link>
          <Link to="/" className="font-sans text-sm text-muted-on-card hover:text-primary">
            Accueil
          </Link>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-display text-4xl text-on-card">{title}</h1>
        <QueryState
          isPending={isPending}
          isError={isError}
          error={error}
          onRetry={refetch}
          skeleton={<Skeleton lines={8} />}
        >
          {data ? (
            <div className="mt-8 space-y-8 font-sans text-sm leading-relaxed text-on-card">
              {data.demo ? (
                <p
                  role="note"
                  className="rounded-lg border border-warning/30 bg-warning/15 p-4 text-on-card"
                >
                  Instance de démonstration : le centre équestre et ses coordonnées sont fictifs,
                  les paiements s’effectuent en mode test et aucune vente réelle n’est conclue.
                </p>
              ) : null}
              {children(data)}
            </div>
          ) : null}
        </QueryState>
      </main>

      <footer className="border-t border-border-on-card px-6 py-6">
        <LegalLinks className="mx-auto max-w-3xl" />
      </footer>
    </div>
  );
}

/**
 * Section titrée d'une page légale.
 * @param {{ title: string, children: import('react').ReactNode }} props
 */
export function LegalSection({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-on-card">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Ligne « libellé : valeur » ; valeur absente = à compléter par l'éditeur.
 * @param {{ label: string, value?: string | null }} props
 */
export function LegalItem({ label, value }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-semibold">{label} :</dt>
      <dd className={value ? undefined : 'text-muted-on-card'}>
        {value || 'non renseigné par l’éditeur de l’instance'}
      </dd>
    </div>
  );
}
