// @ts-check
/**
 * Middleware de validation Zod (règle n° 2 : toute entrée traversant le réseau
 * est validée). Remplace la source par les données parsées (trim, coercitions).
 */
import { AppError } from '../lib/appError.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'query' | 'params'} [source]
 * @returns {import('express').RequestHandler}
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      next(AppError.badRequest('Données invalides', details));
      return;
    }
    if (source === 'body') {
      req.body = result.data;
    } else {
      // Express 5 : req.query / req.params sont des getters non réassignables
      Object.defineProperty(req, source, { value: result.data, writable: false });
    }
    next();
  };
}
