import { useLocation } from 'react-router';

/** Kicker d’en-tête selon l’espace (pages partagées admin / client / moniteur). */
export function useSpaceEyebrow() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return 'Administration';
  if (pathname.startsWith('/moniteur')) return 'Espace moniteur';
  return 'Espace famille';
}
