// @ts-check
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { env, isTest } from './config/env.js';
import { logger } from './lib/logger.js';
import { handleMulterError } from './lib/uploads.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import adminRouter from './routes/admin.routes.js';
import authRouter from './routes/auth.routes.js';
import clientRouter from './routes/client.routes.js';
import coursesRouter from './routes/courses.routes.js';
import eventsRouter from './routes/events.routes.js';
import healthRouter from './routes/health.routes.js';
import horsesRouter from './routes/horses.routes.js';
import incidentsRouter from './routes/incidents.routes.js';
import messagesRouter from './routes/messages.routes.js';
import notificationsRouter from './routes/notifications.routes.js';
import publicRouter from './routes/public.routes.js';
import ridersRouter from './routes/riders.routes.js';
import spacesRouter from './routes/spaces.routes.js';
import volunteerRouter from './routes/volunteer.routes.js';

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
  app.use(cookieParser()); // cookie httpOnly du refresh token
  app.use(pinoHttp({ logger, autoLogging: !isTest }));

  // --- Routes ---
  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1/riders', ridersRouter);
  app.use('/api/v1/horses', horsesRouter);
  app.use('/api/v1/spaces', spacesRouter);
  app.use('/api/v1/courses', coursesRouter);
  app.use('/api/v1/events', eventsRouter);
  app.use('/api/v1/incidents', incidentsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/volunteer-missions', volunteerRouter);
  app.use('/api/v1/messages', messagesRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/client', clientRouter);

  // --- 404 & erreurs (toujours en dernier) ---
  app.use(notFound);
  app.use(handleMulterError);
  app.use(errorHandler);

  return app;
}
