// @ts-check
import * as paymentService from '../services/paymentService.js';

/** GET /api/v1/public/payment-config */
export async function getPaymentConfig(_req, res) {
  res.json(paymentService.getPublicPaymentConfig());
}

/** POST /api/v1/client/invoices/:id/checkout */
export async function createInvoiceCheckout(req, res) {
  const checkout = await paymentService.createInvoiceCheckoutSession(req.user.id, req.params.id);
  res.status(201).json(checkout);
}

/** POST /api/v1/client/invoices/:id/confirm-checkout */
export async function confirmInvoiceCheckout(req, res) {
  const result = await paymentService.confirmInvoiceCheckout(req.user.id, req.params.id);
  res.json(result);
}

/**
 * POST /api/v1/webhooks/stripe — body brut (Buffer), sans JWT.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function handleStripeWebhook(req, res) {
  const result = await paymentService.verifyAndHandleStripeWebhook(
    req.body,
    req.headers['stripe-signature']
  );
  res.json(result);
}
