import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Card } from '@/components/ui/card.jsx';
import { fetchPublicEvents } from '@/features/engagement/api.js';

/**
 * Vitrine visiteur — placeholder Phase 0.
 * Valide le thème (tokens, polices, focus) ; le contenu réel
 * (stats, stages à venir via API publique) arrive en Phase 5.
 */
export function HomePage() {
  const { data: events = [] } = useQuery({
    queryKey: ['public-events'],
    queryFn: fetchPublicEvents,
  });

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

      <main className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-6 py-16 text-center">
          <h1 className="font-display text-4xl text-text md:text-6xl">L&apos;équitation, simplement.</h1>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-base text-muted md:text-lg">
            Planning des cours, cavalerie, réservations et facturation : Equime accompagne votre centre
            équestre au quotidien.
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

        <section className="mx-auto w-full max-w-7xl px-6 pb-16">
          <div className="mb-6">
            <h2 className="font-display-semi text-2xl text-text">Stages et événements à venir</h2>
            <p className="mt-1 font-sans text-sm text-muted">
              Lecture publique des prochains rendez-vous du centre.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <Card key={event.id}>
                <h3 className="font-sans text-lg font-semibold text-text">{event.title}</h3>
                <p className="mt-1 font-sans text-sm text-muted">
                  {new Date(event.startAt).toLocaleString('fr-FR')}
                </p>
                {event.location ? (
                  <p className="mt-1 font-sans text-sm text-muted">{event.location}</p>
                ) : null}
                {event.description ? (
                  <p className="mt-3 font-sans text-sm text-muted">{event.description}</p>
                ) : null}
              </Card>
            ))}
            {events.length === 0 ? (
              <Card>
                <p className="font-sans text-sm text-muted">Aucun événement public planifié pour le moment.</p>
              </Card>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 text-center font-sans text-sm text-muted">
          Equime — refonte v3 (Phase 5 — modules relationnels)
        </div>
      </footer>
    </div>
  );
}
