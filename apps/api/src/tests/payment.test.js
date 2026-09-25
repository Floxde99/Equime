/**
 * Tests paiement Stripe Checkout par échéance, webhook et règlements au club (ADR 011).
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  sessionsCreate: vi.fn(),
  sessionsRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    constructor() {
      this.checkout = {
        sessions: {
          create: stripeMocks.sessionsCreate,
          retrieve: stripeMocks.sessionsRetrieve,
        },
      };
      this.webhooks = { constructEvent: stripeMocks.constructEvent };
    }
  },
}));

vi.mock('../config/env.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    env: {
      ...actual.env,
      STRIPE_SECRET_KEY: 'sk_test_51FakeKeyForVitestOnly000',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_for_vitest_only',
      STRIPE_CURRENCY: 'eur',
    },
    isStripeConfigured: true,
    isSimulatedPaymentAllowed: () => false,
    getPaymentConfig: () => ({ provider: 'stripe', mode: 'test' }),
  };
});

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import * as billingService from '../services/billingService.js';
import * as paymentService from '../services/paymentService.js';

import {
  accessTokenFor,
  authHeader,
  createUser,
  familyIdOf,
  resetAuthTables,
  resetBillingTables,
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();

let adminToken;
let adminId;
let clientToken;
let clientId;
let clientFamilyId;

beforeEach(async () => {
  stripeMocks.constructEvent.mockReset();
  stripeMocks.sessionsCreate.mockReset();
  stripeMocks.sessionsRetrieve.mockReset();
  await resetBillingTables();
  await resetCoreTables();
  await resetAuthTables();
  await resetRateLimits();

  const admin = await createUser({ email: 'admin-pay@test.fr', role: 'admin' });
  adminToken = await accessTokenFor(admin);
  adminId = admin.id;
  const client = await createUser({
    email: 'client-pay@test.fr',
    role: 'client',
    firstName: 'Lina',
  });
  clientToken = await accessTokenFor(client);
  clientId = client.id;
  clientFamilyId = await familyIdOf(client.id);
});

afterAll(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});

/**
 * Facture de test avec son échéancier (une échéance par défaut, ADR 011).
 * @param {{ number: string, status?: string, amounts?: number[], sessionId?: string,
 *   paid?: boolean }} input
 */
async function createInvoice({ number, status = 'sent', amounts = [2500], sessionId, paid }) {
  const totalCents = amounts.reduce((sum, amount) => sum + amount, 0);
  const now = new Date();
  return prisma.invoice.create({
    data: {
      familyId: clientFamilyId,
      number,
      status,
      issuedAt: status === 'draft' ? null : now,
      paidAt: paid ? now : null,
      totalCents,
      items: {
        create: [{ label: 'Stage', quantity: 1, unitCents: totalCents, totalCents }],
      },
      installments: {
        create: amounts.map((amountCents, index) => ({
          sequence: index + 1,
          dueAt: new Date(now.getTime() + index * 30 * 86400000),
          amountCents,
          paidAt: paid ? now : null,
          stripeCheckoutSessionId: index === 0 ? (sessionId ?? null) : null,
        })),
      },
    },
    include: { installments: { orderBy: { sequence: 'asc' } } },
  });
}

/** @param {string} invoiceId */
function paymentsOf(invoiceId) {
  return prisma.payment.findMany({ where: { invoiceId }, orderBy: { createdAt: 'asc' } });
}

/**
 * Événement webhook Checkout payé.
 * @param {{ invoiceId: string, installmentId?: string, amount: number, paymentIntent: string }} input
 */
function paidSessionEvent({ invoiceId, installmentId, amount, paymentIntent }) {
  return {
    id: `evt_${paymentIntent}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${paymentIntent}`,
        client_reference_id: invoiceId,
        metadata: { invoiceId, installmentId, familyId: clientFamilyId },
        payment_status: 'paid',
        amount_total: amount,
        payment_intent: paymentIntent,
      },
    },
  };
}

describe('GET /api/v1/public/payment-config', () => {
  it('expose provider stripe en mode test', async () => {
    const res = await request(app).get('/api/v1/public/payment-config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ provider: 'stripe', mode: 'test' });
  });
});

describe('POST /api/v1/client/invoices/:id/checkout', () => {
  it('crée une session pour l’échéance suivante et la mémorise sur l’échéance', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7001', amounts: [4900] });

    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_test_session_abc',
      url: 'https://checkout.stripe.com/c/pay/cs_test_session_abc',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.url).toContain('checkout.stripe.com');
    expect(res.body.sessionId).toBe('cs_test_session_abc');
    expect(res.body.mode).toBe('test');
    expect(stripeMocks.sessionsCreate).toHaveBeenCalledOnce();
    const params = stripeMocks.sessionsCreate.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(4900);
    expect(params.line_items[0].price_data.product_data.name).toBe('Facture FAC-2026-7001');
    expect(params.metadata.installmentId).toBe(invoice.installments[0].id);

    const installment = await prisma.invoiceInstallment.findUniqueOrThrow({
      where: { id: invoice.installments[0].id },
    });
    expect(installment.stripeCheckoutSessionId).toBe('cs_test_session_abc');
  });

  it('facture au trimestre : la session règle le reste de l’échéance suivante', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7021',
      amounts: [33_334, 33_333, 33_333],
    });
    // Premier trimestre réglé au club, plus un acompte de 10 € sur le deuxième
    await prisma.payment.createMany({
      data: [
        { invoiceId: invoice.id, method: 'cheque', amountCents: 33_334, paidAt: new Date() },
        { invoiceId: invoice.id, method: 'cash', amountCents: 1_000, paidAt: new Date() },
      ],
    });
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_test_q2',
      url: 'https://checkout.stripe.com/c/pay/cs_test_q2',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(201);
    const params = stripeMocks.sessionsCreate.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(32_333);
    expect(params.line_items[0].price_data.product_data.name).toBe(
      'Facture FAC-2026-7021 — échéance 2/3'
    );
    expect(params.metadata.installmentId).toBe(invoice.installments[1].id);
  });

  it('refuse le paiement simulé lorsque Stripe est configuré (410)', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7002', amounts: [1000] });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/pay`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(410);
  });

  it('refuse checkout si facture déjà payée', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7010',
      status: 'paid',
      amounts: [1000],
      paid: true,
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuse checkout si montant invalide', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7011', amounts: [] });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it('répond 503 si Stripe ne renvoie pas d’URL', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7012',
      status: 'overdue',
      amounts: [2000],
    });

    stripeMocks.sessionsCreate.mockResolvedValue({ id: 'cs_test_no_url', url: null });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(503);
  });

  it('réutilise la session encore ouverte au lieu d’en créer une seconde', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7017',
      amounts: [2100],
      sessionId: 'cs_test_open',
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_open',
      status: 'open',
      amount_total: 2100,
      url: 'https://checkout.stripe.com/c/pay/cs_test_open',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe('cs_test_open');
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it('crée une nouvelle session si le reste dû a changé depuis la session ouverte', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7022',
      amounts: [2100],
      sessionId: 'cs_test_stale_amount',
    });
    await prisma.payment.create({
      data: { invoiceId: invoice.id, method: 'cash', amountCents: 100, paidAt: new Date() },
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_stale_amount',
      status: 'open',
      amount_total: 2100,
      url: 'https://checkout.stripe.com/c/pay/cs_test_stale_amount',
    });
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_test_new_amount',
      url: 'https://checkout.stripe.com/c/pay/cs_test_new_amount',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe('cs_test_new_amount');
    expect(stripeMocks.sessionsCreate.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(
      2000
    );
  });

  it('crée une nouvelle session si la précédente a expiré', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7018',
      amounts: [2200],
      sessionId: 'cs_test_expired',
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_expired',
      status: 'expired',
      url: null,
    });
    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_test_fresh',
      url: 'https://checkout.stripe.com/c/pay/cs_test_fresh',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBe('cs_test_fresh');
    const installment = await prisma.invoiceInstallment.findUniqueOrThrow({
      where: { id: invoice.installments[0].id },
    });
    expect(installment.stripeCheckoutSessionId).toBe('cs_test_fresh');
  });
});

describe('POST /api/v1/webhooks/stripe', () => {
  it('répond 400 si la signature est invalide', async () => {
    stripeMocks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=bad')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('BAD_REQUEST');
  });

  it('répond 400 si Stripe-Signature est absent', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));

    expect(res.status).toBe(400);
    expect(stripeMocks.constructEvent).not.toHaveBeenCalled();
  });

  it('enregistre un seul règlement en cas de double livraison', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7003', amounts: [2500] });
    const event = paidSessionEvent({
      invoiceId: invoice.id,
      installmentId: invoice.installments[0].id,
      amount: 2500,
      paymentIntent: 'pi_test_intent_1',
    });
    stripeMocks.constructEvent.mockReturnValue(event);
    const payload = Buffer.from(JSON.stringify(event));

    for (let delivery = 0; delivery < 2; delivery += 1) {
      const res = await request(app)
        .post('/api/v1/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 't=1,v1=ok')
        .send(payload);
      expect(res.status).toBe(200);
      expect(res.body.handled).toBe(true);
    }

    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe('paid');
    expect(paid.paidAt).not.toBeNull();

    const payments = await paymentsOf(invoice.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      method: 'card_online',
      amountCents: 2500,
      stripePaymentIntentId: 'pi_test_intent_1',
      installmentId: invoice.installments[0].id,
    });

    const notifications = await prisma.notification.findMany({
      where: { userId: clientId, type: 'payment_confirmed' },
    });
    expect(notifications).toHaveLength(1);
  });

  it('une échéance payée en ligne ne solde pas la facture de saison', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7023',
      amounts: [30_000, 30_000, 30_000],
    });
    stripeMocks.constructEvent.mockReturnValue(
      paidSessionEvent({
        invoiceId: invoice.id,
        installmentId: invoice.installments[0].id,
        amount: 30_000,
        paymentIntent: 'pi_first_quarter',
      })
    );

    const res = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=ok')
      .send('{}');
    expect(res.status).toBe(200);

    const stored = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { installments: { orderBy: { sequence: 'asc' } } },
    });
    expect(stored.status).toBe('sent');
    expect(stored.installments.map((i) => Boolean(i.paidAt))).toEqual([true, false, false]);

    const notification = await prisma.notification.findFirst({
      where: { userId: clientId, type: 'payment_confirmed' },
    });
    expect(notification?.body).toMatch(/Reste dû : 600,00/);
  });
});

describe('POST /api/v1/client/invoices/:id/confirm-checkout', () => {
  it('enregistre le règlement quand la session Stripe est payée', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7005',
      status: 'overdue',
      amounts: [3200],
      sessionId: 'cs_test_confirm_paid',
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_confirm_paid',
      payment_status: 'paid',
      amount_total: 3200,
      metadata: { invoiceId: invoice.id, installmentId: invoice.installments[0].id },
      payment_intent: 'pi_test_confirm_1',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    expect(res.body.invoice.status).toBe('paid');
    expect(res.body.invoice.remainingCents).toBe(0);
    expect(stripeMocks.sessionsRetrieve).toHaveBeenCalledWith('cs_test_confirm_paid');

    const payments = await paymentsOf(invoice.id);
    expect(payments.map((p) => p.stripePaymentIntentId)).toEqual(['pi_test_confirm_1']);
  });

  it('no-op si la facture est déjà payée (idempotent)', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7006',
      status: 'paid',
      amounts: [1500],
      sessionId: 'cs_test_already_paid',
      paid: true,
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(false);
    expect(res.body.invoice.status).toBe('paid');
    expect(stripeMocks.sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('refuse confirm sans session Checkout associée', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7013', amounts: [1100] });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('ne confirme pas si payment_status Stripe n’est pas paid', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7014',
      amounts: [1200],
      sessionId: 'cs_test_unpaid',
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_unpaid',
      payment_status: 'unpaid',
      payment_intent: null,
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(false);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored.status).toBe('sent');
    expect(await paymentsOf(invoice.id)).toHaveLength(0);
  });

  it('extrait payment_intent objet lors du confirm', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7015',
      amounts: [1300],
      sessionId: 'cs_test_pi_obj',
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_pi_obj',
      payment_status: 'paid',
      amount_total: 1300,
      payment_intent: { id: 'pi_from_object' },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    const [payment] = await paymentsOf(invoice.id);
    expect(payment.stripePaymentIntentId).toBe('pi_from_object');
  });
});

describe('handleStripeWebhookEvent (unit)', () => {
  it('ignore les types non gérés', async () => {
    const result = await paymentService.handleStripeWebhookEvent({
      type: 'customer.created',
      data: { object: {} },
    });
    expect(result.handled).toBe(false);
  });

  it('ignore un événement sans invoiceId', async () => {
    const result = await paymentService.handleStripeWebhookEvent({
      type: 'checkout.session.completed',
      data: { object: { metadata: {}, payment_intent: null } },
    });
    expect(result.handled).toBe(false);
  });

  it('ne marque pas payée une session completed au paiement différé (unpaid)', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7019', amounts: [1400] });

    const result = await paymentService.handleStripeWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_sepa',
          metadata: { invoiceId: invoice.id },
          payment_status: 'unpaid',
          payment_intent: 'pi_sepa',
        },
      },
    });

    expect(result.handled).toBe(false);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored.status).toBe('sent');
  });

  it('laisse la facture due sur async_payment_failed', async () => {
    const result = await paymentService.handleStripeWebhookEvent({
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_test_sepa_failed', metadata: { invoiceId: 'inv_x' } } },
    });
    expect(result.handled).toBe(false);
  });

  it('accepte async_payment_succeeded via client_reference_id (montant de l’échéance)', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7016', amounts: [1800] });

    const result = await paymentService.handleStripeWebhookEvent({
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          client_reference_id: invoice.id,
          metadata: null,
          payment_intent: { id: 'pi_async_obj' },
        },
      },
    });

    expect(result.handled).toBe(true);
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe('paid');
    const [payment] = await paymentsOf(invoice.id);
    expect(payment).toMatchObject({ amountCents: 1800, stripePaymentIntentId: 'pi_async_obj' });
  });

  it('un second paiement Stripe sur une facture soldée est enregistré (trop-perçu)', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7004', amounts: [990] });
    const input = { invoiceId: invoice.id, method: 'card_online', amountCents: 990 };

    const first = await billingService.recordPayment({
      ...input,
      stripePaymentIntentId: 'pi_first',
    });
    const again = await billingService.recordPayment({
      ...input,
      stripePaymentIntentId: 'pi_second',
    });

    expect(first.recorded).toBe(true);
    expect(again.recorded).toBe(true);
    expect(again.invoice.status).toBe('paid');
    // L'argent a bien été reçu : le trop-perçu reste visible pour être remboursé
    expect((await paymentsOf(invoice.id)).map((p) => p.stripePaymentIntentId)).toEqual([
      'pi_first',
      'pi_second',
    ]);
  });

  it('webhook et confirm simultanés : un seul règlement et une seule notification', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7020', amounts: [1600] });
    const input = {
      invoiceId: invoice.id,
      method: 'card_online',
      amountCents: 1600,
      stripePaymentIntentId: 'pi_race',
    };

    const results = await Promise.all([
      billingService.recordPayment(input),
      billingService.recordPayment(input),
    ]);

    expect(results.filter((r) => r.recorded)).toHaveLength(1);
    expect(await paymentsOf(invoice.id)).toHaveLength(1);
    const notifications = await prisma.notification.findMany({
      where: { userId: clientId, type: 'payment_confirmed' },
    });
    expect(notifications).toHaveLength(1);
  });
});

describe('POST /api/v1/admin/invoices/:id/payments (règlements au club)', () => {
  /** @param {string} invoiceId @param {object} body */
  const record = (invoiceId, body) =>
    request(app)
      .post(`/api/v1/admin/invoices/${invoiceId}/payments`)
      .set(authHeader(adminToken))
      .send(body);

  it('encaisse un chèque partiel puis le solde, échéance par échéance', async () => {
    const invoice = await createInvoice({
      number: 'FAC-2026-7030',
      amounts: [30_000, 30_000, 30_000],
    });

    const first = await record(invoice.id, {
      method: 'cheque',
      amountCents: 30_000,
      reference: 'CHQ 1234567',
    });
    expect(first.status).toBe(201);
    expect(first.body.invoice.status).toBe('sent');
    expect(first.body.invoice.remainingCents).toBe(60_000);
    expect(first.body.invoice.nextInstallment.sequence).toBe(2);
    expect(first.body.invoice.payments[0]).toMatchObject({
      method: 'cheque',
      reference: 'CHQ 1234567',
    });

    const ancv = await record(invoice.id, { method: 'ancv', amountCents: 60_000 });
    expect(ancv.status).toBe(201);
    expect(ancv.body.invoice.status).toBe('paid');
    expect(ancv.body.invoice.installments.every((i) => i.paidAt)).toBe(true);

    const [payment] = await paymentsOf(invoice.id);
    expect(payment.recordedById).toBe(adminId);
  });

  it('refuse un règlement supérieur au reste dû, en ligne ou sur un brouillon', async () => {
    const invoice = await createInvoice({ number: 'FAC-2026-7031', amounts: [5_000] });

    const tooMuch = await record(invoice.id, { method: 'cash', amountCents: 5_001 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.error.message).toMatch(/reste dû \(50,00/);

    const online = await record(invoice.id, { method: 'card_online', amountCents: 1_000 });
    expect(online.status).toBe(400);

    const draft = await createInvoice({
      number: 'FAC-2026-7032',
      status: 'draft',
      amounts: [5_000],
    });
    expect((await record(draft.id, { method: 'cash', amountCents: 1_000 })).status).toBe(400);

    const future = await record(invoice.id, {
      method: 'cash',
      amountCents: 1_000,
      paidAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    });
    expect(future.status).toBe(400);
    expect(await paymentsOf(invoice.id)).toHaveLength(0);
  });
});
