import { describe, expect, it } from 'vitest';

import { eventPhotoSrc, missionPhotoSrc } from './demoPhotos.js';

describe('demoPhotos', () => {
  it('associe un même identifiant à la même photo', () => {
    expect(missionPhotoSrc('m1')).toBe(missionPhotoSrc('m1'));
    expect(eventPhotoSrc('e1')).toBe(eventPhotoSrc('e1'));
  });

  it('pointe vers des fichiers locaux', () => {
    expect(missionPhotoSrc('m1')).toMatch(/^\/images\//);
    expect(eventPhotoSrc('e1')).toMatch(/^\/images\//);
  });
});
