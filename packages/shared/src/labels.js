/**
 * Libellés français des énumérations, pour affichage côté front
 * (badges, filtres, emails). Complétés en Phase 1.
 */

import { ROLES } from './constants.js';

/** @type {Record<string, string>} */
export const ROLE_LABELS = Object.freeze({
  [ROLES.CLIENT]: 'Client',
  [ROLES.INSTRUCTOR]: 'Moniteur',
  [ROLES.ADMIN]: 'Administrateur',
});
