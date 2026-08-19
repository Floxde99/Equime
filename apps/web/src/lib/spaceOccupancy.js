/**
 * Occupation des espaces à partir des Space réels (boxes / paddocks / carrières).
 * Les chevaux n’ont pas de spaceId : l’occupation des boxes =
 * nombre de chevaux vs somme des capacités des espaces de type `stall`.
 */
import { SPACE_TYPES } from '@equime/shared';

/**
 * @typedef {{ id?: string, name: string, type: string, capacity?: number | null }} SpaceLike
 * @typedef {{ id?: string, name: string, type: string, capacity: number }} OccupancySpace
 */

/**
 * Un box / stalle n’accueille pas de cours — seulement manège, carrière, paddock.
 * @param {string} type
 */
export function isRidingSpaceType(type) {
  return type !== SPACE_TYPES.STALL;
}

/**
 * @param {SpaceLike} space
 * @returns {OccupancySpace}
 */
function summarizeSpace(space) {
  return {
    id: space.id,
    name: space.name,
    type: space.type,
    capacity: space.capacity ?? 0,
  };
}

/**
 * @param {SpaceLike[] | null | undefined} spaces
 * @param {number} horseCount
 */
export function buildSpaceOccupancy(spaces, horseCount) {
  const list = Array.isArray(spaces) ? spaces : [];
  const count = Number.isFinite(horseCount) ? Math.max(0, Math.trunc(horseCount)) : 0;

  const stalls = list.filter((space) => space.type === SPACE_TYPES.STALL).map(summarizeSpace);
  const paddocks = list.filter((space) => space.type === SPACE_TYPES.PADDOCK).map(summarizeSpace);
  const arenas = list
    .filter((space) => space.type === SPACE_TYPES.INDOOR || space.type === SPACE_TYPES.OUTDOOR)
    .map(summarizeSpace);

  const capacity = stalls.reduce((sum, space) => sum + space.capacity, 0);
  const occupied = capacity === 0 ? 0 : Math.min(count, capacity);
  const percent = capacity ? Math.round((count / capacity) * 100) : 0;

  return {
    boxes: {
      spaces: stalls,
      capacity,
      occupied,
      horseCount: count,
      percent,
    },
    paddocks,
    arenas,
  };
}
