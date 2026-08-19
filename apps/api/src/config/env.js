// @ts-check
/**
 * Configuration d'environnement validée par Zod au démarrage.
 * Toute variable manquante ou invalide provoque un crash explicite (règle n° 7).
 */
import process from 'node:process';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  /** Requise — aucune valeur par défaut : les identifiants ne vivent qu'en .env (règle n° 7) */
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().default('redis://localhost:6379'),
  /** Origines CORS autorisées, séparées par des virgules. */
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  // --- Authentification (Phase 2) ---
  /** Secret de signature des access tokens JWT — requis, ≥ 32 caractères */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
  /** Durée de vie de l'access token, en minutes */
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  /** Durée de vie du refresh token, en jours */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  /** URL publique du front (liens des emails : réinitialisation de mot de passe) */
  APP_URL: z.url().default('http://localhost:5173'),

  // --- Emails (SendGrid) ---
  /** Optionnelle en dev : sans clé, les emails sont loggés au lieu d'être envoyés */
  SENDGRID_API_KEY: z.string().optional(),
  MAIL_FROM: z.email().default('no-reply@equime.local'),

  /** Répertoire de stockage des fichiers téléversés (documents cavaliers) */
  UPLOAD_DIR: z.string().default('./uploads'),

  // --- Émetteur des PDF de facture (coordonnées publiques, pas de secrets) ---
  CLUB_NAME: z.string().default('Equime'),
  CLUB_ADDRESS: z.string().default('12 chemin des Écuries, 31000 Toulouse'),
  CLUB_PHONE: z.string().default('05 61 00 00 00'),
  CLUB_EMAIL: z.string().default('contact@equime.local'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuration invalide — variables d’environnement :');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

/** @typedef {z.infer<typeof envSchema>} Env */

/** @type {Env} */
export const env = parsed.data;

export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
export const isProd = env.NODE_ENV === 'production';
