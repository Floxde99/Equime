/**
 * Schémas Zod du module authentification — source unique de vérité :
 * validés côté API (middleware validate) ET côté front (react-hook-form).
 */
import { z } from 'zod';

/** Politique de mot de passe (affichée telle quelle sous les champs). */
export const PASSWORD_POLICY =
  'Au moins 12 caractères, dont une majuscule, une minuscule et un chiffre.';

export const passwordSchema = z
  .string()
  .min(12, PASSWORD_POLICY)
  .regex(/[a-z]/, PASSWORD_POLICY)
  .regex(/[A-Z]/, PASSWORD_POLICY)
  .regex(/[0-9]/, PASSWORD_POLICY);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Adresse email invalide'));

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'Le prénom est requis').max(80),
  lastName: z.string().trim().min(1, 'Le nom est requis').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 .-]{6,20}$/, 'Numéro de téléphone invalide')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Jeton manquant'),
  password: passwordSchema,
});
