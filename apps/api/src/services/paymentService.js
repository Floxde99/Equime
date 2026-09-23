// @ts-check
/**
 * Paiement Stripe Checkout (ADR 008).
 * Services purs : pas de req/res.
 */
import Stripe from 'stripe';

import {
  env,
  getPaymentConfig,
  isStripeConfigured,
} from '../config/env.js';
import { AppError } from '../lib/appError.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

import * as billingService from './billingService.js';

/** @type {import('stripe').default | null} */
let stripeClient = null;

/**
 * Client Stripe lazy (évite d’instancier sans clé).
 * @returns {import('stripe').default}
 */
function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw AppError.serviceUnavailable('Paiement Stripe non configuré');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

/**
 * Config publique pour le bandeau front.
 * @returns {{ provider: 'stripe' | 'simulated', mode: 'test' | 'live' }}
 */
export function getPublicPaymentConfig() {
  return getPaymentConfig();
}

/**
 * Crée une Session Checkout pour une facture client (sent | overdue).
 *
 * @param {string} userId
 * @param {string} invoiceId
 * @returns {Promise<{ url: string, sessionId: string, mode: 'test' | 'live' }>}
 */
export async function createInvoiceCheckoutSession(userId, invoiceId) {
  if (!isStripeConfigured) {
    throw AppError.serviceUnavailable(
      'Paiement Stripe non configuré. En développement, utilisez le paiement simulé.'
    );
  }

  const invoice = await billingService.getClientInvoice(userId, invoiceId);
  if (invoice.status === 'paid') {
    throw AppError.badRequest('Cette facture est déjà payée');
  }
  if (invoice.status !== 'sent' && invoice.status !== 'overdue') {
    throw AppError.badRequest('Cette facture ne peut pas être payée');
  }
  if (invoice.totalCents <= 0) {
    throw AppError.badRequest('Le montant de la facture est invalide');
  }

  const stripe = getStripe();
  const config = getPaymentConfig();
  const successUrl = `${env.APP_URL}/app/factures?paid=1&invoice=${encodeURIComponent(invoice.id)}`;
  const cancelUrl = `${env.APP_URL}/app/factures?cancelled=1&invoice=${encodeURIComponent(invoice.id)}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: invoice.id,
    metadata: {
      invoiceId: invoice.id,
      familyId: invoice.family.id,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: invoice.totalCents,
          product_data: {
            name: `Facture ${invoice.number}`,
          },
        },
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw AppError.serviceUnavailable('Stripe n’a pas renvoyé d’URL de paiement');
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return {
    url: session.url,
    sessionId: session.id,
    mode: config.mode,
  };
}

/**
 * Confirme un Checkout après retour success_url (?paid=1).
 * Interroge Stripe (pas de confiance client) ; idempotent avec le webhook.
 *
 * @param {string} userId
 * @param {string} invoiceId
 * @returns {Promise<{ invoice: Awaited<ReturnType<typeof billingService.getClientInvoice>>, confirmed: boolean }>}
 */
export async function confirmInvoiceCheckout(userId, invoiceId) {
  if (!isStripeConfigured) {
    throw AppError.serviceUnavailable('Paiement Stripe non configuré');
  }

  const invoice = await billingService.getClientInvoice(userId, invoiceId);

  if (invoice.status === 'paid') {
    return { invoice, confirmed: false };
  }

  if (!invoice.stripeCheckoutSessionId) {
    throw AppError.badRequest('Aucune session Checkout associée à cette facture');
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(invoice.stripeCheckoutSessionId);

  if (session.payment_status !== 'paid') {
    return { invoice, confirmed: false };
  }

  const paymentIntent = session.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === 'string'
      ? paymentIntent
      : paymentIntent && typeof paymentIntent === 'object' && 'id' in paymentIntent
        ? String(/** @type {{ id: string }} */ (paymentIntent).id)
        : null;

  const paid = await billingService.markInvoicePaidFromPayment(invoice.id, {
    paymentIntentId,
  });

  return { invoice: paid, confirmed: true };
}

/**
 * Vérifie la signature et délègue au handler métier.
 *
 * @param {Buffer | string} rawBody
 * @param {string | string[] | undefined} signatureHeader
 * @returns {Promise<{ received: true, handled: boolean }>}
 */
export async function verifyAndHandleStripeWebhook(rawBody, signatureHeader) {
  if (!isStripeConfigured || !env.STRIPE_WEBHOOK_SECRET) {
    throw AppError.serviceUnavailable('Webhook Stripe non configuré');
  }

  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) {
    throw AppError.badRequest('En-tête Stripe-Signature manquant');
  }

  const stripe = getStripe();
  /** @type {import('stripe').Stripe.Event} */
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Signature webhook Stripe invalide');
    throw AppError.badRequest('Signature webhook Stripe invalide');
  }

  const result = await handleStripeWebhookEvent(event);
  return { received: true, handled: result.handled };
}

/**
 * Traite un événement Stripe déjà vérifié (idempotent sur facture déjà payée).
 *
 * @param {{ type: string, data: { object: Record<string, unknown> } }} event
 * @returns {Promise<{ handled: boolean }>}
 */
export async function handleStripeWebhookEvent(event) {
  const payableTypes = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ]);

  if (!payableTypes.has(event.type)) {
    logger.debug({ type: event.type }, 'Événement Stripe ignoré');
    return { handled: false };
  }

  const session = event.data.object;
  const metadata =
    session.metadata && typeof session.metadata === 'object'
      ? /** @type {Record<string, string>} */ (session.metadata)
      : {};
  const invoiceId =
    metadata.invoiceId ||
    (typeof session.client_reference_id === 'string' ? session.client_reference_id : null);

  if (!invoiceId) {
    logger.warn({ type: event.type }, 'Webhook Stripe sans invoiceId — ignoré');
    return { handled: false };
  }

  const paymentIntent = session.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === 'string'
      ? paymentIntent
      : paymentIntent && typeof paymentIntent === 'object' && 'id' in paymentIntent
        ? String(/** @type {{ id: string }} */ (paymentIntent).id)
        : null;

  await billingService.markInvoicePaidFromPayment(invoiceId, { paymentIntentId });
  return { handled: true };
}
