import { describe, expect, it } from 'vitest';

import { useAuthStore } from './authStore.js';

describe('authStore', () => {
  it('passe de loading à authenticated puis unauthenticated', () => {
    useAuthStore.setState({ user: null, status: 'loading' });
    useAuthStore.getState().setUser({
      id: '1',
      email: 'a@b.c',
      firstName: 'Lina',
      lastName: 'Test',
      phone: null,
      role: 'client',
    });
    expect(useAuthStore.getState().status).toBe('authenticated');
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
