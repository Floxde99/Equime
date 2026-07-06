/**
 * Tests unitaires du service de tokens — fonctions pures (aucune I/O).
 */
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { env } from '../config/env.js';

import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from './tokenService.js';

describe('generateRefreshToken', () => {
  it('produit un token à forte entropie (48 octets → 64 caractères base64url)', () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });

  it('ne produit jamais deux fois le même token', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe('hashToken', () => {
  it('est déterministe (le hash stocké doit retrouver le token présenté)', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produit un SHA-256 hexadécimal de 64 caractères', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('deux tokens différents donnent deux hashs différents', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});

describe('signAccessToken / verifyAccessToken', () => {
  const user = { id: 'user_123', role: 'client' };

  it('signe puis vérifie un token (sub, role, jti cohérents)', () => {
    const { token, jti } = signAccessToken(user);
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe('user_123');
    expect(payload.role).toBe('client');
    expect(payload.jti).toBe(jti);
  });

  it('chaque token porte un jti unique (condition de la révocation ciblée)', () => {
    const a = signAccessToken(user);
    const b = signAccessToken(user);
    expect(a.jti).not.toBe(b.jti);
  });

  it('rejette un token falsifié (signature invalide)', () => {
    const { token } = signAccessToken(user);
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => verifyAccessToken(tampered)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejette un token signé avec un autre secret', () => {
    const forged = jwt.sign({ role: 'admin' }, 'not_the_real_secret_but_32_chars_long!!', {
      subject: 'user_123',
      jwtid: 'x',
      issuer: 'equime-api',
    });
    expect(() => verifyAccessToken(forged)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejette un token expiré (TokenExpiredError, déclencheur du refresh front)', () => {
    const expired = jwt.sign({ role: 'client' }, env.JWT_ACCESS_SECRET, {
      subject: 'user_123',
      jwtid: 'x',
      issuer: 'equime-api',
      expiresIn: -1,
    });
    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });

  it("rejette un token émis par un autre émetteur qu'equime-api", () => {
    const other = jwt.sign({ role: 'client' }, env.JWT_ACCESS_SECRET, {
      subject: 'user_123',
      jwtid: 'x',
      issuer: 'someone-else',
    });
    expect(() => verifyAccessToken(other)).toThrow(jwt.JsonWebTokenError);
  });
});
