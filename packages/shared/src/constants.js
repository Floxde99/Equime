/**
 * Énumérations métier — source unique de vérité front/back.
 * Complétées en Phase 1 avec l'ensemble des statuts du modèle de données.
 */

/** Rôles applicatifs. `visitor` désigne un utilisateur non connecté (jamais persisté). */
export const ROLES = Object.freeze({
  CLIENT: 'client',
  INSTRUCTOR: 'instructor',
  ADMIN: 'admin',
});

/** @type {ReadonlyArray<string>} */
export const ROLE_VALUES = Object.freeze(Object.values(ROLES));
