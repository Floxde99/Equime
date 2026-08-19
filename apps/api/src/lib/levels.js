// @ts-check
/**
 * Comparaisons de niveaux cavalier (ordre défini dans RIDER_LEVEL_ORDER).
 */
import { RIDER_LEVEL_ORDER } from '@equime/shared';

/**
 * @param {string} level
 * @returns {number}
 */
export function levelIndex(level) {
  const idx = RIDER_LEVEL_ORDER.indexOf(level);
  if (idx === -1) throw new Error(`Niveau inconnu : ${level}`);
  return idx;
}

/**
 * @param {string} riderLevel
 * @param {string} minLevel
 * @param {string} maxLevel
 */
export function isLevelInRange(riderLevel, minLevel, maxLevel) {
  const idx = levelIndex(riderLevel);
  return idx >= levelIndex(minLevel) && idx <= levelIndex(maxLevel);
}
