import { Link } from 'react-router';

import { Card } from '@/components/ui/card.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { STITCH_PHOTOS } from '@/lib/demoPhotos.js';
import { useAuthStore } from '@/stores/authStore.js';

/** Tableau de bord moniteur — accès rapides, photo paddock Stitch. */
export function InstructorDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace moniteur"
        title={`Bonjour, ${user?.firstName}`}
        description="Planning des séances, appel et incidents."
      />

      <div className="overflow-hidden rounded-xl">
        <img src={STITCH_PHOTOS.instructorPaddock} alt="" className="h-48 w-full object-cover" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl text-on-card">Planning</h2>
          <p className="mt-1 font-sans text-sm text-muted-on-card">
            Consultez vos cours et l&apos;attribution des chevaux.
          </p>
          <Link
            to="/moniteur/planning"
            className="mt-4 inline-block font-sans text-sm font-semibold text-primary hover:underline"
          >
            Ouvrir le planning →
          </Link>
        </Card>
        <Card>
          <h2 className="font-display text-xl text-on-card">Appel</h2>
          <p className="mt-1 font-sans text-sm text-muted-on-card">
            Saisissez les présences de la séance en cours.
          </p>
          <Link
            to="/moniteur/appel"
            className="mt-4 inline-block font-sans text-sm font-semibold text-primary hover:underline"
          >
            Faire l&apos;appel →
          </Link>
        </Card>
      </div>
    </div>
  );
}
