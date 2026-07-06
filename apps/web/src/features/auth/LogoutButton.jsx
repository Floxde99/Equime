import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

import { logout } from './api.js';

import { useAuthStore } from '@/stores/authStore.js';

/** Bouton de déconnexion commun aux trois layouts. */
export function LogoutButton({ className = '' }) {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 font-sans text-sm text-muted transition-colors hover:bg-surface hover:text-text ${className}`}
    >
      <LogOut aria-hidden="true" className="size-4" />
      Se déconnecter
    </button>
  );
}
