/**
 * Messages de validation Zod en français, pour le front comme pour le back.
 *
 * Les schémas portent déjà leurs messages métier ; ce module couvre les cas
 * génériques (champ vide, nombre invalide, longueur…) qui s'affichaient en
 * anglais (« Invalid input: expected string, received undefined »). Ce qui
 * n'est pas couvert ici retombe sur la locale française officielle de Zod.
 */
import { config } from 'zod';
import fr from 'zod/v4/locales/fr.js';

/** @param {unknown} input */
const isEmpty = (input) =>
  input === undefined || input === null || (typeof input === 'string' && input.trim() === '');

/**
 * @param {any} issue
 * @returns {string | undefined}
 */
export function frenchIssueMessage(issue) {
  switch (issue.code) {
    case 'invalid_type':
      if (isEmpty(issue.input)) return 'Ce champ est requis';
      if (issue.expected === 'number' || issue.expected === 'int')
        return 'Saisissez un nombre valide';
      if (issue.expected === 'date') return 'Date invalide';
      return undefined;
    case 'too_small': {
      const min = Number(issue.minimum);
      if (issue.origin === 'string') {
        return min <= 1 ? 'Ce champ est requis' : `Au moins ${min} caractères`;
      }
      if (issue.origin === 'number') {
        return issue.inclusive === false
          ? `La valeur doit être supérieure à ${min}`
          : `La valeur doit être au moins ${min}`;
      }
      if (issue.origin === 'array') return `Au moins ${min} élément${min > 1 ? 's' : ''}`;
      return undefined;
    }
    case 'too_big': {
      const max = Number(issue.maximum);
      if (issue.origin === 'string') return `${max} caractères maximum`;
      if (issue.origin === 'number') {
        return issue.inclusive === false
          ? `La valeur doit être inférieure à ${max}`
          : `La valeur ne peut pas dépasser ${max}`;
      }
      if (issue.origin === 'array') return `${max} élément${max > 1 ? 's' : ''} maximum`;
      return undefined;
    }
    case 'invalid_value':
      return 'Choisissez une valeur dans la liste';
    case 'invalid_format':
      if (issue.format === 'email') return 'Adresse e-mail invalide';
      return undefined;
    default:
      return undefined;
  }
}

config({ ...fr(), customError: frenchIssueMessage });
