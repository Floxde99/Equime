/**
 * Coordonnées et tarifs publics du club (Excel 1.1 / vitrine).
 * Valeurs non secrètes, injectées au build via `VITE_CLUB_*`.
 *
 * Licence FFE et cotisation club : aucun montant n'existe en schéma, seed ni Excel.
 * `VITE_CLUB_LICENSE_CENTS` / `VITE_CLUB_COTISATION_CENTS` (centimes, optionnels) :
 * affichés sur la vitrine seulement s'ils sont renseignés ; masqués si vides.
 */
import { z } from 'zod';

const clubPublicEnvSchema = z.object({
  VITE_CLUB_ADDRESS: z.string().optional(),
  VITE_CLUB_PHONE: z.string().optional(),
  VITE_CLUB_EMAIL: z.string().optional(),
  VITE_CLUB_LICENSE_CENTS: z.union([z.string(), z.number()]).optional(),
  VITE_CLUB_COTISATION_CENTS: z.union([z.string(), z.number()]).optional(),
});

/**
 * @param {unknown} value
 * @param {string} key
 * @returns {number | null}
 */
function parseOptionalCents(value, key) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const result = z
    .string()
    .regex(/^\d+$/, `${key} doit être un entier ≥ 0 (centimes)`)
    .transform(Number)
    .safeParse(trimmed);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * @param {Record<string, unknown> | undefined} env
 */
export function readClubContact(env) {
  const parsed = clubPublicEnvSchema.parse(env ?? {});
  return {
    address: String(parsed.VITE_CLUB_ADDRESS ?? '').trim(),
    phone: String(parsed.VITE_CLUB_PHONE ?? '').trim(),
    email: String(parsed.VITE_CLUB_EMAIL ?? '').trim(),
    /** Licence FFE en centimes, ou `null` si non configurée. */
    licenseCents: parseOptionalCents(parsed.VITE_CLUB_LICENSE_CENTS, 'VITE_CLUB_LICENSE_CENTS'),
    /** Cotisation club en centimes, ou `null` si non configurée. */
    cotisationCents: parseOptionalCents(
      parsed.VITE_CLUB_COTISATION_CENTS,
      'VITE_CLUB_COTISATION_CENTS'
    ),
  };
}

export const clubContact = readClubContact(import.meta.env);
