import { Link, Outlet } from 'react-router';

/**
 * Gabarit des pages publiques d'authentification :
 * carte centrée sur fond navy, logo cliquable vers la vitrine.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 font-display text-4xl text-text">
        Equime
      </Link>
      <main className="w-full max-w-md rounded-2xl border border-border bg-surface p-8">
        <Outlet />
      </main>
    </div>
  );
}
