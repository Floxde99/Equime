/**
 * Tests paiement Stripe Checkout + webhook (mocks — pas d’appel réseau).
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
  resetCoreTables,
  resetRateLimits,
} from './coreHelpers.js';

const app = createApp();

let clientToken;
let clientId;
let clientFamilyId;

async function resetPaymentTables() {
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await resetCoreTables();
}

beforeEach(async () => {
  stripeMocks.constructEvent.mockReset();
  stripeMocks.sessionsCreate.mockReset();
  stripeMocks.sessionsRetrieve.mockReset();
  await resetPaymentTables();
  await resetAuthTables();
  await resetRateLimits();

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

describe('GET /api/v1/public/payment-config', () => {
  it('expose provider stripe en mode test', async () => {
    const res = await request(app).get('/api/v1/public/payment-config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ provider: 'stripe', mode: 'test' });
  });
});

describe('POST /api/v1/client/invoices/:id/checkout', () => {
  it('crée une session Checkout et persiste stripeCheckoutSessionId', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7001',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 4900,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 4900, totalCents: 4900 }],
        },
      },
    });

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

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.stripeCheckoutSessionId).toBe('cs_test_session_abc');
  });

  it('refuse le paiement simulé lorsque Stripe est configuré (410)', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7002',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 1000,
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1000, totalCents: 1000 }],
        },
      },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/pay`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(410);
  });

  it('refuse checkout si facture déjà payée', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7010',
        status: 'paid',
        issuedAt: new Date(),
        paidAt: new Date(),
        totalCents: 1000,
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1000, totalCents: 1000 }],
        },
      },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuse checkout si montant invalide', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7011',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 0,
      },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsCreate).not.toHaveBeenCalled();
  });

  it('répond 503 si Stripe ne renvoie pas d’URL', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7012',
        status: 'overdue',
        issuedAt: new Date(),
        totalCents: 2000,
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 2000, totalCents: 2000 }],
        },
      },
    });

    stripeMocks.sessionsCreate.mockResolvedValue({
      id: 'cs_test_no_url',
      url: null,
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(503);
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

  it('marque la facture payée une seule fois (double delivery idempotente)', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7003',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 2500,
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 2500, totalCents: 2500 }],
        },
      },
    });

    const event = {
      id: 'evt_test_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_paid',
          client_reference_id: invoice.id,
          metadata: { invoiceId: invoice.id, familyId: clientFamilyId },
          payment_intent: 'pi_test_intent_1',
        },
      },
    };

    stripeMocks.constructEvent.mockReturnValue(event);

    const payload = Buffer.from(JSON.stringify(event));

    const first = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=ok')
      .send(payload);

    expect(first.status).toBe(200);
    expect(first.body.handled).toBe(true);

    const second = await request(app)
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=ok')
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.handled).toBe(true);

    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe('paid');
    expect(paid.stripePaymentIntentId).toBe('pi_test_intent_1');
    expect(paid.paidAt).not.toBeNull();

    const notifications = await prisma.notification.findMany({
      where: { userId: clientId, type: 'payment_confirmed' },
    });
    expect(notifications).toHaveLength(1);
  });
});

describe('POST /api/v1/client/invoices/:id/confirm-checkout', () => {
  it('marque la facture payée quand la session Stripe est paid', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7005',
        status: 'overdue',
        issuedAt: new Date(),
        totalCents: 3200,
        stripeCheckoutSessionId: 'cs_test_confirm_paid',
        items: {
          create: [{ label: 'Abonnement', quantity: 1, unitCents: 3200, totalCents: 3200 }],
        },
      },
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_confirm_paid',
      payment_status: 'paid',
      payment_intent: 'pi_test_confirm_1',
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    expect(res.body.invoice.status).toBe('paid');
    expect(stripeMocks.sessionsRetrieve).toHaveBeenCalledWith('cs_test_confirm_paid');

    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe('paid');
    expect(paid.stripePaymentIntentId).toBe('pi_test_confirm_1');
    expect(paid.paidAt).not.toBeNull();
  });

  it('no-op si la facture est déjà payée (idempotent)', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7006',
        status: 'paid',
        issuedAt: new Date(),
        paidAt: new Date(),
        totalCents: 1500,
        stripeCheckoutSessionId: 'cs_test_already_paid',
        stripePaymentIntentId: 'pi_existing',
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1500, totalCents: 1500 }],
        },
      },
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
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7013',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 1100,
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1100, totalCents: 1100 }],
        },
      },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(400);
    expect(stripeMocks.sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('ne confirme pas si payment_status Stripe n’est pas paid', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7014',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 1200,
        stripeCheckoutSessionId: 'cs_test_unpaid',
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1200, totalCents: 1200 }],
        },
      },
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
  });

  it('extrait payment_intent objet lors du confirm', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7015',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 1300,
        stripeCheckoutSessionId: 'cs_test_pi_obj',
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1300, totalCents: 1300 }],
        },
      },
    });

    stripeMocks.sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_pi_obj',
      payment_status: 'paid',
      payment_intent: { id: 'pi_from_object' },
    });

    const res = await request(app)
      .post(`/api/v1/client/invoices/${invoice.id}/confirm-checkout`)
      .set(authHeader(clientToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.confirmed).toBe(true);
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.stripePaymentIntentId).toBe('pi_from_object');
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

  it('accepte async_payment_succeeded via client_reference_id et payment_intent objet', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7016',
        status: 'sent',
        issuedAt: new Date(),
        totalCents: 1800,
        items: {
          create: [{ label: 'Stage', quantity: 1, unitCents: 1800, totalCents: 1800 }],
        },
      },
    });

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
    expect(paid.stripePaymentIntentId).toBe('pi_async_obj');
  });

  it('est idempotent via markInvoicePaidFromPayment', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        familyId: clientFamilyId,
        number: 'FAC-2026-7004',
        status: 'overdue',
        issuedAt: new Date(),
        totalCents: 990,
        items: {
          create: [{ label: 'Relance', quantity: 1, unitCents: 990, totalCents: 990 }],
        },
      },
    });

    await billingService.markInvoicePaidFromPayment(invoice.id, {
      paymentIntentId: 'pi_first',
    });
    const again = await billingService.markInvoicePaidFromPayment(invoice.id, {
      paymentIntentId: 'pi_second',
    });

    expect(again.status).toBe('paid');
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored.stripePaymentIntentId).toBe('pi_first');
  });
});
