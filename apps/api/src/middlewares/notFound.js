// @ts-check
import { AppError } from '../lib/appError.js';

/**
 * Middleware 404 : toute route non montée aboutit ici et délègue à l'errorHandler.
 * @type {import('express').RequestHandler}
 */
export function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.path} introuvable`));
}
