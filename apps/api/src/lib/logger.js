// @ts-check
import pino from 'pino';

import { env, isDev } from '../config/env.js';

/**
 * Logger applicatif pino.
 * JSON structuré en production/préproduction, sortie lisible (pino-pretty) en dev.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
