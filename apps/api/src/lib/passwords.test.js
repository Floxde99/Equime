/**
 * Tests unitaires du hachage de mots de passe (argon2id).
 */
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './passwords.js';

describe('hashPassword / verifyPassword', () => {
  it('hache en argon2id et vérifie le bon mot de passe', async () => {
    const hash = await hashPassword('MotDePasse123');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, 'MotDePasse123')).resolves.toBe(true);
  });

  it('refuse un mauvais mot de passe', async () => {
    const hash = await hashPassword('MotDePasse123');
    await expect(verifyPassword(hash, 'MotDePasse124')).resolves.toBe(false);
  });

  it('deux hashs du même mot de passe diffèrent (sel aléatoire)', async () => {
    const [a, b] = await Promise.all([hashPassword('MotDePasse123'), hashPassword('MotDePasse123')]);
    expect(a).not.toBe(b);
  });

  it("ne lève pas d'exception sur un hash corrompu (refus silencieux)", async () => {
    await expect(verifyPassword('pas-un-hash', 'MotDePasse123')).resolves.toBe(false);
  });
});
