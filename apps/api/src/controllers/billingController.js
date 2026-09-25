// @ts-check
import { prisma } from '../lib/prisma.js';
import * as billingService from '../services/billingService.js';
import { getRidersEntitlements } from '../services/entitlementService.js';
import { runCompatibilityAudit } from '../services/horseAssignment.js';
import { getClubSettings } from '../services/settingsService.js';
import * as subscriptionService from '../services/subscriptionService.js';

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listSubscriptionPlans(_req, res) {
  const plans = await billingService.listSubscriptionPlans();
  res.json({ plans });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createSubscriptionPlan(req, res) {
  const plan = await billingService.createSubscriptionPlan(req.body);
  res.status(201).json({ plan });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateSubscriptionPlan(req, res) {
  const plan = await billingService.updateSubscriptionPlan(req.params.id, req.body);
  res.json({ plan });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteSubscriptionPlan(req, res) {
  await billingService.deleteSubscriptionPlan(req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listDiscountRules(_req, res) {
  const rules = await billingService.listDiscountRules();
  res.json({ rules });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createDiscountRule(req, res) {
  const rule = await billingService.createDiscountRule(req.body);
  res.status(201).json({ rule });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function updateDiscountRule(req, res) {
  const rule = await billingService.updateDiscountRule(req.params.id, req.body);
  res.json({ rule });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function deleteDiscountRule(req, res) {
  await billingService.deleteDiscountRule(req.params.id);
  res.status(204).send();
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function createInvoice(req, res) {
  const invoice = await billingService.createInvoice(req.body);
  res.status(201).json({ invoice });
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function listAdminInvoices(_req, res) {
  const invoices = await billingService.listAdminInvoices();
  res.json({ invoices });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getAdminInvoice(req, res) {
  const invoice = await billingService.getAdminInvoice(req.params.id);
  res.json({ invoice });
}

/**
 * @param {import('express').Response} res
 * @param {{ buffer: Buffer, filename: string }} pdf
 */
function sendInvoicePdf(res, pdf) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(pdf.buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
  res.send(pdf.buffer);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function downloadAdminInvoicePdf(req, res) {
  const pdf = await billingService.getAdminInvoicePdf(req.params.id);
  sendInvoicePdf(res, pdf);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function downloadClientInvoicePdf(req, res) {
  const pdf = await billingService.getClientInvoicePdf(req.user.id, req.params.id);
  sendInvoicePdf(res, pdf);
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function sendInvoice(req, res) {
  const invoice = await billingService.sendInvoice(req.params.id);
  res.json({ invoice });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function remindInvoice(req, res) {
  const invoice = await billingService.remindInvoice(req.params.id);
  res.json({ invoice });
}

/** @param {import('express').Request} _req @param {import('express').Response} res */
export async function runAudit(_req, res) {
  const report = await runCompatibilityAudit();
  res.json({ report });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function listClientInvoices(req, res) {
  const invoices = await billingService.listFamilyInvoices(req.user.id);
  res.json({ invoices });
}

/** @param {import('express').Request} req @param {import('express').Response} res */
export async function payClientInvoice(req, res) {
  const invoice = await billingService.payInvoice(req.user.id, req.params.id);
  res.json({ invoice });
}

/** GET /api/v1/public/plans */
export async function listPublicPlans(_req, res) {
  const plans = await billingService.listActivePublicPlans();
  res.json({ plans });
}

/** @param {import('express').Request} req */
function actorOf(req) {
  return { id: req.user.id, role: req.user.role };
}

/** GET /riders/:id/subscription-preview et /admin/riders/:riderId/subscription-preview */
/** @param {import('express').Request} req @param {import('express').Response} res */
export async function previewSubscription(req, res) {
  const preview = await subscriptionService.previewSubscription(
    actorOf(req),
    req.params.riderId ?? req.params.id,
    req.query
  );
  res.json({ preview });
}

/** POST /riders/:id/subscriptions et /admin/riders/:riderId/subscriptions */
/** @param {import('express').Request} req @param {import('express').Response} res */
export async function subscribeRider(req, res) {
  const result = await subscriptionService.subscribeRider(
    actorOf(req),
    req.params.riderId ?? req.params.id,
    req.body
  );
  res.status(201).json(result);
}

/** POST /admin/subscriptions/:id/end */
/** @param {import('express').Request} req @param {import('express').Response} res */
export async function endSubscription(req, res) {
  const subscription = await subscriptionService.endSubscription(req.params.id);
  res.json({ subscription });
}

/** POST /admin/invoices/:id/payments — règlement saisi au club */
/** @param {import('express').Request} req @param {import('express').Response} res */
export async function recordPayment(req, res) {
  const invoice = await billingService.recordOfflinePayment(req.params.id, req.body, req.user.id);
  res.status(201).json({ invoice });
}

/** GET /client/entitlements — forfaits, séances de la semaine et rattrapages par cavalier */
/** @param {import('express').Request} req @param {import('express').Response} res */
export async function getEntitlements(req, res) {
  const riders = await prisma.rider.findMany({
    where: { family: { userId: req.user.id } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
  const [entitlements, settings] = await Promise.all([
    getRidersEntitlements(riders.map((r) => r.id)),
    getClubSettings(),
  ]);
  res.json({
    riders: riders.map((rider, index) => ({ ...rider, ...entitlements[index] })),
    rules: {
      cancellationDeadlineHours: settings.cancellationDeadlineHours,
      makeupValidityDays: settings.makeupValidityDays,
    },
  });
}
