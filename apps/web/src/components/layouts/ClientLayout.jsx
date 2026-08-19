import {
  Bell,
  CalendarDays,
  CircleUser,
  HandHelping,
  Home,
  MessageSquare,
  Receipt,
  Ticket,
  Users,
} from 'lucide-react';

import { ConnectedShell } from '@/components/layouts/ConnectedShell.jsx';

const ITEMS = [
  { to: '/app', label: 'Accueil', icon: Home, end: true },
  { to: '/app/cavaliers', label: 'Famille', icon: Users },
  { to: '/app/planning', label: 'Réservations', icon: CalendarDays },
  { to: '/app/factures', label: 'Facturation', icon: Receipt },
  { to: '/app/evenements', label: 'Événements', icon: Ticket },
  { to: '/app/benevolat', label: 'Bénévolat', icon: HandHelping },
  { to: '/app/messages', label: 'Messages', icon: MessageSquare },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/compte', label: 'Mon compte', icon: CircleUser },
];

/** Portail famille Stitch : sidebar claire + header sticky. */
export function ClientLayout() {
  return (
    <ConnectedShell
      eyebrow="Portail famille"
      items={ITEMS}
      cta={{ to: '/app/planning', label: 'Réserver' }}
      notificationsTo="/app/notifications"
      navLabel="Navigation famille"
    />
  );
}
