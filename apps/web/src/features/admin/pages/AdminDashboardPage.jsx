import { useAuthStore } from '@/stores/authStore.js';

/** Tableau de bord admin (Phase 2 placeholder — KPIs en Phase 4). */
export function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Tableau de bord</h1>
        <p className="mt-2 font-sans text-muted">
          Bienvenue {user?.firstName} — les indicateurs d&apos;occupation, de chiffre
          d&apos;affaires et de charge des chevaux arrivent en Phase 4.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Occupation des cours', value: '—', highlight: true },
          { label: "Chiffre d'affaires", value: '—', highlight: false },
          { label: 'Charge cavalerie', value: '—', highlight: false },
        ].map((kpi) => (
          <section key={kpi.label} className="rounded-xl border border-border bg-surface p-5">
            <p className="font-sans text-sm text-muted">{kpi.label}</p>
            <p
              className={
                kpi.highlight
                  ? 'mt-2 font-display text-4xl text-primary'
                  : 'mt-2 font-display text-4xl text-text'
              }
            >
              {kpi.value}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
