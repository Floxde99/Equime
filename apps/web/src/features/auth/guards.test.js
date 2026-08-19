import { ROLES } from '@equime/shared';
import { describe, expect, it } from 'vitest';

import { HOME_BY_ROLE } from './guards.jsx';

describe('HOME_BY_ROLE', () => {
  it('redirige chaque rôle vers son espace', () => {
    expect(HOME_BY_ROLE[ROLES.CLIENT]).toBe('/app');
    expect(HOME_BY_ROLE[ROLES.INSTRUCTOR]).toBe('/moniteur');
    expect(HOME_BY_ROLE[ROLES.ADMIN]).toBe('/admin');
  });
});
