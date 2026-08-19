import { ROLES } from '@equime/shared';
import { describe, expect, it } from 'vitest';

import { describeRouteError, homePathForUser, ROUTE_ERROR_USER_MESSAGE } from './routeError.js';

describe('describeRouteError', () => {
  it('expose le message d’une Error uniquement en détail technique', () => {
    const described = describeRouteError(new Error('useRef is not defined'));
    expect(described.userMessage).toBe(ROUTE_ERROR_USER_MESSAGE);
    expect(described.devMessage).toBe('useRef is not defined');
  });

  it('reste générique pour un objet inconnu', () => {
    const described = describeRouteError({ foo: 'bar' });
    expect(described.userMessage).toBe(ROUTE_ERROR_USER_MESSAGE);
    expect(described.devMessage).toBe('');
  });
});

describe('homePathForUser', () => {
  it('renvoie l’espace admin', () => {
    expect(homePathForUser({ role: ROLES.ADMIN })).toBe('/admin');
  });

  it('renvoie l’espace client', () => {
    expect(homePathForUser({ role: ROLES.CLIENT })).toBe('/app');
  });

  it('renvoie la vitrine pour un visiteur anonyme', () => {
    expect(homePathForUser(null)).toBe('/');
    expect(homePathForUser(undefined)).toBe('/');
    expect(homePathForUser({})).toBe('/');
  });
});
