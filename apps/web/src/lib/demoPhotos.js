/**
 * Photos de démo Stitch, hébergées en local (`public/images/`).
 * Pas de CDN : mapping déterministe pour bandes éditoriales (vitrine, missions, stages).
 */

const MISSION_PHOTOS = [
  '/images/benevolat-pansage.webp',
  '/images/benevolat-balade.webp',
  '/images/experience-ecuries.webp',
];

const EVENT_PHOTOS = [
  '/images/stage-hero.webp',
  '/images/programme-obstacle.webp',
  '/images/programme-dressage.webp',
  '/images/programme-poney.webp',
];

/** @param {string} seed */
function pick(list, seed) {
  let hash = 0;
  const value = String(seed ?? '');
  for (let i = 0; i < value.length; i += 1)
    hash = (hash + value.charCodeAt(i) * (i + 1)) % list.length;
  return list[hash];
}

/** Photo de mission bénévole. @param {string} seed */
export function missionPhotoSrc(seed) {
  return pick(MISSION_PHOTOS, seed);
}

/** Photo de stage / compétition. @param {string} seed */
export function eventPhotoSrc(seed) {
  return pick(EVENT_PHOTOS, seed);
}

export const STITCH_PHOTOS = {
  stables: '/images/experience-ecuries.webp',
  arena: '/images/experience-carriere.webp',
  estate: '/images/hero-centre.webp',
  membersBanner: '/images/domaine-banner.webp',
  billingStables: '/images/ecuries-or.webp',
  instructorPaddock: '/images/paddock-matin.webp',
};
