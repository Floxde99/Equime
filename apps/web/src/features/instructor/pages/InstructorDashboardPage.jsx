import { useAuthStore } from '@/stores/authStore.js';

/** Tableau de bord moniteur (Phase 2 placeholder — planning en Phase 3). */
export function InstructorDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Mon planning</h1>
        <p className="mt-2 font-sans text-muted">
          Bonjour {user?.firstName} — le calendrier des séances, les présences et l&apos;attribution
          des chevaux seront disponibles en Phase 3.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="font-sans text-sm text-muted">
          En attendant, connectez-vous avec le compte seed{' '}
          <span className="text-text">coach@equime.local</span> pour tester les parcours moniteur.
        </p>
      </section>
    </div>
  );
}
