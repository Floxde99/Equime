// @ts-check
/**
 * Paiement Stripe Checkout (ADR 008).
 * Services purs : pas de req/res.
 */
import { PAYMENT_METHODS } from '@equime/shared';
import Stripe from 'stripe';

import { env, getPaymentConfig, isStripeConfigured } from '../config/env.js';
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
 * Identifiant du PaymentIntent d'une session (chaîne ou objet développé).
 * @param {unknown} paymentIntent
 * @returns {string | null}
 */
function paymentIntentIdOf(paymentIntent) {
  if (typeof paymentIntent === 'string') return paymentIntent;
  if (paymentIntent && typeof paymentIntent === 'object' && 'id' in paymentIntent) {
    return String(/** @type {{ id: string }} */ (paymentIntent).id);
  }
  return null;
}

/**
 * Crée une Session Checkout pour l'échéance suivante d'une facture client
 * (sent | overdue). Une session encore ouverte pour le même montant est reprise.
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
  const next = invoice.nextInstallment;
  if (!next || next.amountCents <= 0) {
    throw AppError.badRequest('Le montant de la facture est invalide');
  }

  const stripe = getStripe();
  const config = getPaymentConfig();

  // Une session encore ouverte pour cette échéance est réutilisée : en créer une
  // seconde laisserait deux sessions payables (double débit possible). Si le reste
  // dû a changé (règlement au club entre-temps), une nouvelle session est créée.
  const installment = await prisma.invoiceInstallment.findUniqueOrThrow({
    where: { id: next.id },
    select: { stripeCheckoutSessionId: true },
  });
  if (installment.stripeCheckoutSessionId) {
    const existing = await stripe.checkout.sessions.retrieve(installment.stripeCheckoutSessionId);
    if (existing.status === 'open' && existing.url && existing.amount_total === next.amountCents) {
      return { url: existing.url, sessionId: existing.id, mode: config.mode };
    }
  }

  const count = invoice.installments.length;
  const productName =
    count > 1
      ? `Facture ${invoice.number} — échéance ${next.sequence}/${count}`
      : `Facture ${invoice.number}`;

  const successUrl = `${env.APP_URL}/app/factures?paid=1&invoice=${encodeURIComponent(invoice.id)}`;
  const cancelUrl = `${env.APP_URL}/app/factures?cancelled=1&invoice=${encodeURIComponent(invoice.id)}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: invoice.id,
    metadata: {
      invoiceId: invoice.id,
      installmentId: next.id,
      familyId: invoice.family.id,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: next.amountCents,
          product_data: {
            name: productName,
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

  await prisma.invoiceInstallment.update({
    where: { id: next.id },
    data: { stripeCheckoutSessionId: session.id },
  });

  return {
    url: session.url,
    sessionId: session.id,
    mode: config.mode,
  };
}

/**
 * Enregistre le règlement d'une session Checkout payée (idempotent par PaymentIntent).
 * @param {{ id: string, amount_total?: number | null, payment_intent?: unknown,
 *   metadata?: Record<string, string> | null }} session
 * @param {string} invoiceId
 */
async function recordCheckoutPayment(session, invoiceId) {
  const paymentIntentId = paymentIntentIdOf(session.payment_intent);
  if (!paymentIntentId) {
    logger.error({ sessionId: session.id }, 'Session Stripe payée sans PaymentIntent');
    return null;
  }
  const installmentId = session.metadata?.installmentId ?? null;
  // Stripe fournit toujours `amount_total` ; à défaut, l'échéance suivante.
  const amountCents =
    typeof session.amount_total === 'number'
      ? session.amount_total
      : ((await billingService.getAdminInvoice(invoiceId)).nextInstallment?.amountCents ?? 0);
  if (amountCents <= 0) {
    logger.error({ sessionId: session.id, invoiceId }, 'Session Stripe payée sans montant');
    return null;
  }

  return billingService.recordPayment({
    invoiceId,
    installmentId,
    method: PAYMENT_METHODS.CARD_ONLINE,
    amountCents,
    stripePaymentIntentId: paymentIntentId,
  });
}

/**
 * Confirme un Checkout après retour success_url (?paid=1).
 * Interroge Stripe (pas de confiance client) ; idempotent avec le webhook.
 *
 * @param {string} userId
 * @param {string} invoiceId
 * @returns {Promise<{ invoice: object, confirmed: boolean }>}
 */
export async function confirmInvoiceCheckout(userId, invoiceId) {
  if (!isStripeConfigured) {
    throw AppError.serviceUnavailable('Paiement Stripe non configuré');
  }

  const invoice = await billingService.getClientInvoice(userId, invoiceId);
  if (invoice.status === 'paid') {
    return { invoice, confirmed: false };
  }

  const pending = await prisma.invoiceInstallment.findMany({
    where: { invoiceId, paidAt: null, stripeCheckoutSessionId: { not: null } },
    select: { stripeCheckoutSessionId: true },
    orderBy: { sequence: 'asc' },
  });
  if (pending.length === 0) {
    throw AppError.badRequest('Aucune session Checkout associée à cette facture');
  }

  const stripe = getStripe();
  let confirmed = false;
  for (const { stripeCheckoutSessionId } of pending) {
    const session = await stripe.checkout.sessions.retrieve(
      /** @type {string} */ (stripeCheckoutSessionId)
    );
    if (session.payment_status !== 'paid') continue;
    const result = await recordCheckoutPayment(/** @type {any} */ (session), invoiceId);
    if (result?.recorded) confirmed = true;
  }

  return { invoice: await billingService.getClientInvoice(userId, invoiceId), confirmed };
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

  const session = event.data.object;

  // Moyen de paiement différé (SEPA…) en échec : la facture n'a jamais été
  // marquée payée (voir ci-dessous), elle reste due — on trace seulement.
  if (event.type === 'checkout.session.async_payment_failed') {
    logger.warn({ sessionId: session.id }, 'Paiement Stripe différé en échec');
    return { handled: false };
  }

  if (!payableTypes.has(event.type)) {
    logger.debug({ type: event.type }, 'Événement Stripe ignoré');
    return { handled: false };
  }

  // `completed` arrive aussi pour les moyens différés avec payment_status
  // `unpaid` : l'encaissement sera confirmé par `async_payment_succeeded`.
  if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') {
    logger.info({ sessionId: session.id }, 'Checkout terminé, paiement en attente');
    return { handled: false };
  }
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

  await recordCheckoutPayment(/** @type {any} */ (session), invoiceId);
  return { handled: true };
}
