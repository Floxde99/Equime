/**
 * Convertit une chaîne vide en `undefined` pour les champs optionnels Zod.
 * @param {unknown} value
 */
export function blankToUndefined(value) {
  return value === '' ? undefined : value;
}

/**
 * Formate une date ISO en valeur d'input `datetime-local`.
 * @param {string | Date | null | undefined} iso
 * @returns {string}
 */
export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
