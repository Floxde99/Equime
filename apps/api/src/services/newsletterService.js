// @ts-check
/**
 * Inscription newsletter publique (pas d'ESP marketing, confirmation unitaire).
 */
import { sendTransactionalEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';

/**
 * Enregistre le consentement et envoie un email de confirmation (une fois).
 * Réinscription : pas de second envoi (anti-spam).
 *
 * @param {string} email Email déjà normalisé (trim + minuscules) par Zod
 * @returns {Promise<{ created: boolean }>}
 */
export async function subscribeNewsletter(email) {
  const existing = await prisma.newsletterSubscription.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { created: false };
  }

  await prisma.newsletterSubscription.create({
    data: { email, consentedAt: new Date() },
  });

  await sendTransactionalEmail({
    to: email,
    subject: 'Equime — inscription à la newsletter',
    text: [
      'Bonjour,',
      '',
      'Votre inscription à la newsletter Equime est enregistrée.',
      'Vous recevrez les dates de stages et les actualités du club.',
      '',
      'Pour vous désinscrire, contactez le club (coordonnées sur le site Equime).',
    ].join('\n'),
    html: [
      '<p>Bonjour,</p>',
      '<p>Votre inscription à la newsletter Equime est enregistrée.</p>',
      '<p>Vous recevrez les dates de stages et les actualités du club.</p>',
      '<p>Pour vous désinscrire, contactez le club (coordonnées sur le site Equime).</p>',
    ].join('\n'),
  });

  return { created: true };
}
