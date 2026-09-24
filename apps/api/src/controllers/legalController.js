// @ts-check
import * as legalService from '../services/legalService.js';

/** GET /api/v1/public/legal */
export async function getLegalInfo(_req, res) {
  res.json(legalService.getPublicLegalInfo());
}
