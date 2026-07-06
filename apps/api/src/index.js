// @ts-check
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API Equime démarrée sur le port ${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Arrêt propre : ferme le serveur HTTP puis les connexions externes,
 * pour que Docker (SIGTERM) n'interrompe pas de requête en cours.
 * @param {string} signal
 */
function shutdown(signal) {
  logger.info(`${signal} reçu, arrêt en cours…`);
  server.close(async () => {
    await redis.quit().catch(() => redis.disconnect());
    logger.info('Arrêt terminé');
    process.exit(0);
  });
  // Garde-fou si des connexions restent ouvertes
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
