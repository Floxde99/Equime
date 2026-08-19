import {
  Bell,
  CalendarDays,
  HandHelping,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Siren,
  Users,
} from 'lucide-react';

import { ConnectedShell } from '@/components/layouts/ConnectedShell.jsx';
import { HorseIcon } from '@/components/ui/horse-icon.jsx';

const ITEMS = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/planning', label: 'Planning', icon: CalendarDays },
  { to: '/admin/cavalerie', label: 'Cavalerie', icon: HorseIcon },
  { to: '/admin/evenements', label: 'Événements', icon: CalendarDays },
  { to: '/admin/incidents', label: 'Incidents', icon: Siren },
  { to: '/admin/benevolat', label: 'Bénévolat', icon: HandHelping },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/facturation', label: 'Facturation', icon: Receipt },
];

/** Administration Stitch : même chrome sidebar + header. */
export function AdminLayout() {
  return (
    <ConnectedShell
      eyebrow="Administration"
      items={ITEMS}
      cta={{ to: '/admin/planning', label: 'Nouveau cours' }}
      notificationsTo="/admin/notifications"
      navLabel="Navigation d'administration"
    />
  );
}
