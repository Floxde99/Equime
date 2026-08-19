import { describe, expect, it } from 'vitest';

import { easeInOutCubic, inPageAnchorId, scrollDurationMs } from './inPageScroll.js';

describe('inPageAnchorId', () => {
  it('extrait l’id d’une ancre interne', () => {
    expect(inPageAnchorId('#formules')).toBe('formules');
    expect(inPageAnchorId('#evenements')).toBe('evenements');
  });

  it('ignore les liens externes ou vides', () => {
    expect(inPageAnchorId('/login')).toBeNull();
    expect(inPageAnchorId('#')).toBeNull();
    expect(inPageAnchorId('')).toBeNull();
    expect(inPageAnchorId(null)).toBeNull();
  });
});

describe('easeInOutCubic', () => {
  it('démarre et termine aux bornes', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('est plus lent au début et à la fin qu’au milieu', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
  });
});

describe('scrollDurationMs', () => {
  it('borne la durée pour un saut court ou très long', () => {
    expect(scrollDurationMs(40)).toBe(480);
    expect(scrollDurationMs(4000)).toBe(920);
  });

  it('augmente avec la distance', () => {
    expect(scrollDurationMs(800)).toBeGreaterThan(scrollDurationMs(200));
  });
});
