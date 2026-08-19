// @ts-check
/**
 * Store d'authentification (Zustand) — état client global minimal :
 * l'utilisateur courant et l'état de la session. Tout le reste (données
 * serveur) passe par TanStack Query.
 */
import { create } from 'zustand';

/**
 * @typedef {{ id: string, email: string, firstName: string, lastName: string,
 *   phone: string | null, role: string, sessionQuota?: number | null }} AuthUser
 * @typedef {'loading' | 'authenticated' | 'unauthenticated'} AuthStatus
 */

export const useAuthStore = create((set) => ({
  /** @type {AuthUser | null} */
  user: null,
  /** @type {AuthStatus} `loading` au démarrage, le temps du refresh silencieux */
  status: 'loading',

  /** @param {AuthUser} user */
  setUser: (user) => set({ user, status: 'authenticated' }),

  clear: () => set({ user: null, status: 'unauthenticated' }),
}));
