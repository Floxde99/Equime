/**
 * Clés de cache planning — isolation scope `mine` / `all`.
 */
import { describe, expect, it } from 'vitest';

import { buildPlanningCacheKey } from './planningCache.js';

describe('buildPlanningCacheKey', () => {
  const from = new Date('2026-11-01T00:00:00.000Z');
  const to = new Date('2026-11-15T00:00:00.000Z');

  it('segmente scope=mine par userId (client) et ne fusionne jamais vers all', () => {
    const a = buildPlanningCacheKey({ from, to, scope: 'mine', userId: 'user-a' });
    const b = buildPlanningCacheKey({ from, to, scope: 'mine', userId: 'user-b' });
    const all = buildPlanningCacheKey({ from, to, scope: 'all' });

    expect(a).toContain(':mine:user-a');
    expect(b).toContain(':mine:user-b');
    expect(a).not.toBe(b);
    expect(a).not.toBe(all);
    expect(b).not.toBe(all);
    expect(all).toMatch(/:all$/);
  });

  it('préfère instructorId pour un moniteur en scope mine', () => {
    const key = buildPlanningCacheKey({
      from,
      to,
      scope: 'mine',
      userId: 'user-x',
      instructorId: 'instructor-1',
    });
    expect(key).toContain(':mine:instructor-1');
    expect(key).not.toContain('user-x');
  });
});
