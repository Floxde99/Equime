// @ts-check
import { isDev } from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { logger } from '../lib/logger.js';

/**
 * Gestion d'erreurs centralisée.
 * - AppError (opérationnelle) → code HTTP + payload contrôlé
 * - Erreur inattendue (bug) → 500 générique, détail loggé côté serveur uniquement
 * La stack trace n'est JAMAIS exposée hors développement (OWASP A05 — Security Misconfiguration).
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars -- Express identifie un errorHandler à ses 4 paramètres
export function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError && err.isOperational;

  if (isOperational) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err?.code === 'P2025') {
    logger.warn({ code: 'NOT_FOUND', path: req.path }, err.message);
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Ressource introuvable' },
    });
  }

  logger.error({ err, path: req.path }, 'Erreur non gérée');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue',
      ...(isDev ? { stack: err.stack } : {}),
    },
  });
}
