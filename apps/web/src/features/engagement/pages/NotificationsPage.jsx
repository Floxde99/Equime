import { PageHeader } from '@/components/ui/page-header.jsx';
import { NotificationInbox } from '@/features/engagement/components/NotificationInbox.jsx';
import { NotificationPreferences } from '@/features/engagement/components/NotificationPreferences.jsx';
import { useSpaceEyebrow } from '@/lib/useSpaceEyebrow.js';

export function NotificationsPage() {
  const eyebrow = useSpaceEyebrow();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Notifications"
        description="Gérez vos préférences par canal et consultez vos dernières alertes."
      />

      <NotificationPreferences />
      <NotificationInbox />
    </div>
  );
}
