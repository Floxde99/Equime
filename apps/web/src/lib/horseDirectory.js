/**
 * Filtre l’annuaire cavalerie par nom (insensible à la casse et aux accents).
 * @param {string} value
 */
export function normalizeHorseQuery(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr-FR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {{ name?: string }[] | null | undefined} horses
 * @param {string} [query]
 */
export function filterHorsesByQuery(horses, query) {
  const list = Array.isArray(horses) ? horses : [];
  const needle = normalizeHorseQuery(query);
  if (!needle) return list;
  return list.filter((horse) => normalizeHorseQuery(horse?.name).includes(needle));
}

/**
 * Filtre le carnet de santé par type d’entrée (`all` = aucune restriction).
 * @param {{ type?: string }[] | null | undefined} logs
 * @param {string} [type]
 */
export function filterHealthLogs(logs, type) {
  const list = Array.isArray(logs) ? logs : [];
  if (!type || type === 'all') return list;
  return list.filter((log) => log.type === type);
}

const logDateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/** @param {string | Date | null | undefined} value */
export function formatHealthLogDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return logDateTime.format(date);
}

/** @param {{ weeklyLoadHours?: number, maxWeeklyLoadHours?: number }} horse */
export function horseLoadPercent(horse) {
  if (!horse?.maxWeeklyLoadHours) return 0;
  return Math.min(
    100,
    Math.round((Number(horse.weeklyLoadHours) / horse.maxWeeklyLoadHours) * 100)
  );
}
