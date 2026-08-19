// @ts-check
/**
 * Erreur applicative opérationnelle : portée par le flux métier
 * (validation, ressource absente, droits insuffisants…), par opposition
 * aux bugs. Le middleware errorHandler la transforme en réponse HTTP.
 */
export class AppError extends Error {
  /**
   * @param {string} message Message destiné au client (jamais de détail interne)
   * @param {object} [options]
   * @param {number} [options.statusCode] Code HTTP (défaut 500)
   * @param {string} [options.code] Code d'erreur machine-readable (ex. `RESOURCE_NOT_FOUND`)
   * @param {unknown} [options.details] Détails additionnels sûrs à exposer (ex. erreurs de champ Zod)
   */
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    /** Distingue les erreurs métier attendues des bugs imprévus. */
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  /** @param {string} message @param {unknown} [details] */
  static badRequest(message, details) {
    return new AppError(message, { statusCode: 400, code: 'BAD_REQUEST', details });
  }

  /** @param {string} [message] */
  static unauthorized(message = 'Authentification requise') {
    return new AppError(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  /** @param {string} [message] */
  static forbidden(message = 'Accès refusé') {
    return new AppError(message, { statusCode: 403, code: 'FORBIDDEN' });
  }

  /** @param {string} [message] */
  static notFound(message = 'Ressource introuvable') {
    return new AppError(message, { statusCode: 404, code: 'NOT_FOUND' });
  }

  /** @param {string} message */
  static conflict(message) {
    return new AppError(message, { statusCode: 409, code: 'CONFLICT' });
  }

  /** @param {string} [message] */
  static tooManyRequests(message = 'Trop de tentatives, réessayez plus tard') {
    return new AppError(message, { statusCode: 429, code: 'TOO_MANY_REQUESTS' });
  }

  /** @param {string} [message] */
  static payloadTooLarge(message = 'Fichier trop volumineux') {
    return new AppError(message, { statusCode: 413, code: 'PAYLOAD_TOO_LARGE' });
  }
}
