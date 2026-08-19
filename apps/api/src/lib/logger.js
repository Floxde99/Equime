// @ts-check
import pino from 'pino';

import { env, isDev } from '../config/env.js';

/**
 * Chemins pino à masquer (jetons d'accès, cookies). Les jokers `*.headers.*`
 * s'appliquent aux bindings des loggers enfants (pino-http via `log.child({ req })`).
 */
export const LOGGER_REDACT = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    '*.headers.authorization',
    '*.headers.cookie',
    'res.headers["set-cookie"]',
  ],
  censor: '[Redacted]',
};

/**
 * Logger applicatif pino.
 * JSON structuré en production/préproduction, sortie lisible (pino-pretty) en dev.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: LOGGER_REDACT,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
