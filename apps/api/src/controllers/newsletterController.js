// @ts-check
import * as newsletterService from '../services/newsletterService.js';

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function subscribe(req, res) {
  const { created } = await newsletterService.subscribeNewsletter(req.body.email);
  res.status(created ? 201 : 200).json({ ok: true });
}
