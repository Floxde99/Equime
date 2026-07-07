// @ts-check
/**
 * Envoi d'emails transactionnels via SendGrid.
 * Sans SENDGRID_API_KEY (dev, test), les emails sont loggés au lieu d'être
 * envoyés — le flux reste testable de bout en bout.
 */
import sgMail from '@sendgrid/mail';

import { env } from '../config/env.js';

import { logger } from './logger.js';

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

/**
 * @param {{ to: string, subject: string, text: string, html: string }} message
 */
export async function sendTransactionalEmail(message) {
  if (!env.SENDGRID_API_KEY) {
    logger.info({ to: message.to, subject: message.subject }, '[mailer] email simulé (dev)');
    return;
  }
  try {
    await sgMail.send({ ...message, from: env.MAIL_FROM });
  } catch (err) {
    // Un échec d'email ne doit jamais faire échouer la requête HTTP appelante
    logger.error({ err, to: message.to }, "[mailer] échec d'envoi");
  }
}

/**
 * Email de réinitialisation de mot de passe (lien valable 1 h, usage unique).
 * @param {{ to: string, firstName: string, resetUrl: string }} params
 */
export async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  await sendTransactionalEmail({
    to,
    subject: 'Equime — Réinitialisation de votre mot de passe',
    text: [
      `Bonjour ${firstName},`,
      '',
      'Vous avez demandé la réinitialisation de votre mot de passe Equime.',
      `Cliquez sur ce lien (valable 1 heure) : ${resetUrl}`,
      '',
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
    ].join('\n'),
    html: [
      `<p>Bonjour ${firstName},</p>`,
      '<p>Vous avez demandé la réinitialisation de votre mot de passe Equime.</p>',
      `<p><a href="${resetUrl}">Réinitialiser mon mot de passe</a> (lien valable 1 heure)</p>`,
      "<p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>",
    ].join('\n'),
  });
}
