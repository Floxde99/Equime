import { Link } from 'react-router';

/**
 * Vitrine visiteur — placeholder Phase 0.
 * Valide le thème (tokens, polices, focus) ; le contenu réel
 * (stats, stages à venir via API publique) arrive en Phase 5.
 */
export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header>
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5"
        >
          <span className="font-display text-2xl text-text">Equime</span>
          <span className="font-sans text-sm text-muted">Espace membre disponible</span>
        </nav>
      </header>

      <main className="flex flex-1 items-center">
        <section className="mx-auto w-full max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-4xl text-text md:text-6xl">
            L&apos;équitation, simplement.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-base text-muted md:text-lg">
            Planning des cours, cavalerie, réservations et facturation : Equime accompagne votre
            centre équestre au quotidien.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-8 font-sans font-semibold text-primary-fg transition-colors duration-150 hover:bg-primary-light"
            >
              Créer un compte
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center rounded-lg border border-border bg-surface px-8 font-sans font-semibold text-text transition-colors duration-150 hover:bg-surface-raised"
            >
              Se connecter
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center font-sans text-sm text-muted">
          Equime — refonte v3 (Phase 2 — authentification)
        </div>
      </footer>
    </div>
  );
}
