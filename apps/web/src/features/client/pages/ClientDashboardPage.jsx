import { Link } from 'react-router';

import { EnrollSection } from '@/features/client/components/EnrollSection.jsx';
import { useAuthStore } from '@/stores/authStore.js';

/** Tableau de bord client — accès rapide aux modules Phase 3. */
export function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text md:text-4xl">Bonjour, {user?.firstName}</h1>
        <p className="mt-2 font-sans text-muted">Gérez vos cavaliers, inscriptions et planning.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display-semi text-xl text-text">Démarrer</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/app/cavaliers"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Mes cavaliers
          </Link>
          <Link
            to="/app/planning"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Planning
          </Link>
          <Link
            to="/app/factures"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Factures
          </Link>
          <Link
            to="/app/evenements"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Événements
          </Link>
          <Link
            to="/app/compte"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Mon compte
          </Link>
          <Link
            to="/app/messages"
            className="inline-flex h-11 items-center rounded-lg border border-border px-6 font-sans text-sm font-semibold text-text hover:bg-surface-raised"
          >
            Messages
          </Link>
        </div>
      </section>

      <EnrollSection />

      <p className="font-sans text-sm text-muted">
        <Link to="/" className="text-text underline underline-offset-2 hover:text-primary">
          Retour à la vitrine
        </Link>
      </p>
    </div>
  );
}
