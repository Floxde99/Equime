import { CalendarDays, ClipboardCheck, HeartPulse, Home, MessageSquare, Siren } from 'lucide-react';

import { ConnectedShell } from '@/components/layouts/ConnectedShell.jsx';

const ITEMS = [
  { to: '/moniteur', label: 'Accueil', icon: Home, end: true },
  { to: '/moniteur/planning', label: 'Planning', icon: CalendarDays },
  { to: '/moniteur/appel', label: 'Appel', icon: ClipboardCheck },
  { to: '/moniteur/incidents', label: 'Incidents', icon: Siren },
  { to: '/moniteur/sante', label: 'Santé', icon: HeartPulse },
  { to: '/moniteur/messages', label: 'Messages', icon: MessageSquare },
];

/** Espace moniteur Stitch : même chrome sidebar + header. */
export function InstructorLayout() {
  return (
    <ConnectedShell
      eyebrow="Espace moniteur"
      items={ITEMS}
      cta={{ to: '/moniteur/appel', label: 'Faire l’appel' }}
      notificationsTo="/moniteur/messages"
      navLabel="Navigation moniteur"
    />
  );
}
