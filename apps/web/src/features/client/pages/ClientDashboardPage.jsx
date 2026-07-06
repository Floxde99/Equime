import { Link } from 'react-router';

import { Button } from '@/components/ui/button.jsx';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Tableau de bord client (Phase 2 placeholder).
 * La carte d'onboarding « ajoutez votre premier cavalier » arrive en Phase 3.
 */
export function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text md:text-4xl">Bonjour, {user?.firstName}</h1>
        <p className="mt-2 font-sans text-muted">
          Votre espace client est prêt. Les modules famille, planning et facturation arrivent en
          Phase 3.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display-semi text-xl text-text">Prochaines étapes</h2>
        <p className="mt-2 font-sans text-sm text-muted">
          Ajoutez vos cavaliers, consultez le planning et gérez vos factures — tout sera disponible
          très bientôt.
        </p>
        <div className="mt-4">
          <Button variant="secondary" disabled title="Disponible en Phase 3">
            Ajouter un cavalier
          </Button>
        </div>
      </section>

      <p className="font-sans text-sm text-muted">
        Besoin d&apos;aide ?{' '}
        <Link to="/" className="text-text underline underline-offset-2 hover:text-primary">
          Retour à la vitrine
        </Link>
      </p>
    </div>
  );
}
