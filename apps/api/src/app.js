// @ts-check
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env, isTest } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import healthRouter from './routes/health.routes.js';

/**
 * Construit l'application Express (sans l'attacher à un port),
 * ce qui la rend testable avec Supertest.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Derrière le reverse proxy Nginx en préprod/prod (IP réelle, cookies Secure)
  app.set('trust proxy', 1);

  // --- Sécurité ---
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN, // whitelist stricte issue de la config validée
      credentials: true, // nécessaire au cookie httpOnly du refresh token (Phase 2)
    })
  );

  // --- Parsing & logs ---
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger, autoLogging: !isTest }));

  // --- Routes ---
  app.use('/health', healthRouter);
  // Les modules métier seront montés sous /api/v1 à partir de la Phase 2

  // --- 404 & erreurs (toujours en dernier) ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
