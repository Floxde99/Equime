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
