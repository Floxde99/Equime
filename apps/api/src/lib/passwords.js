// @ts-check
/**
 * Hachage des mots de passe — argon2id (recommandation OWASP Password Storage
 * Cheat Sheet). Paramètres explicites pour rester stables entre versions de la lib.
 */
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — minimum recommandé OWASP
  timeCost: 2,
  parallelism: 1,
};

/**
 * @param {string} plain Mot de passe en clair (jamais loggé, jamais persisté)
 * @returns {Promise<string>} Hash encodé (contient sel + paramètres)
 */
export function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/**
 * Vérification à temps constant (gérée par argon2).
 * @param {string} hash
 * @param {string} plain
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Hash corrompu ou format inattendu : on refuse sans faire fuiter la cause
    return false;
  }
}
