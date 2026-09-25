// @ts-check
import * as settingsService from '../services/settingsService.js';

/** GET /api/v1/settings — lecture par tout utilisateur connecté (délais affichés aux familles) */
export async function getSettings(_req, res) {
  const settings = await settingsService.getClubSettings();
  res.json({ settings });
}

/** PATCH /api/v1/settings — admin */
export async function updateSettings(req, res) {
  const settings = await settingsService.updateClubSettings(req.body);
  res.json({ settings });
}
