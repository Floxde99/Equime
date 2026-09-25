import { api, apiFetch, apiFetchBlob } from '@/lib/apiClient.js';

export function fetchPublicPlans() {
  return apiFetch('/public/plans').then((r) => r.plans);
}

export function fetchFamilySubscription() {
  return api.get('/client/family/subscription').then((r) => r.subscription);
}

/** @param {string} subscriptionPlanId */
export function subscribeFamilyPlan(subscriptionPlanId) {
  return api
    .post('/client/family/subscription', { subscriptionPlanId })
    .then((r) => r.subscription);
}

/** @param {string} familyId @param {string} subscriptionPlanId */
export function changeFamilySubscription(familyId, subscriptionPlanId) {
  return api
    .patch(`/admin/families/${familyId}/subscription`, { subscriptionPlanId })
    .then((r) => r.subscription);
}

export function fetchSubscriptionPlans() {
  return api.get('/admin/subscription-plans').then((r) => r.plans);
}

export function createSubscriptionPlan(body) {
  return api.post('/admin/subscription-plans', body).then((r) => r.plan);
}

/** @param {string} id @param {object} body */
export function updateSubscriptionPlan(id, body) {
  return api.patch(`/admin/subscription-plans/${id}`, body).then((r) => r.plan);
}

export function fetchDiscountRules() {
  return api.get('/admin/discount-rules').then((r) => r.rules);
}

export function createDiscountRule(body) {
  return api.post('/admin/discount-rules', body).then((r) => r.rule);
}

/** @param {string} id @param {object} body */
export function updateDiscountRule(id, body) {
  return api.patch(`/admin/discount-rules/${id}`, body).then((r) => r.rule);
}

/** @param {string} id */
export function deleteDiscountRule(id) {
  return api.delete(`/admin/discount-rules/${id}`);
}

export function fetchAdminInvoices() {
  return api.get('/admin/invoices').then((r) => r.invoices);
}

export function fetchAdminInvoice(id) {
  return api.get(`/admin/invoices/${id}`).then((r) => r.invoice);
}

export function createInvoice(body) {
  return api.post('/admin/invoices', body).then((r) => r.invoice);
}

export function generateSubscriptionInvoices() {
  return api.post('/admin/invoices/generate-subscriptions', {});
}

export function sendInvoice(id) {
  return api.post(`/admin/invoices/${id}/send`, {}).then((r) => r.invoice);
}

export function remindInvoice(id) {
  return api.post(`/admin/invoices/${id}/remind`, {}).then((r) => r.invoice);
}

export function fetchClientInvoices() {
  return api.get('/client/invoices').then((r) => r.invoices);
}

/** Config publique Stripe / simulé (bandeau mode test). */
export function fetchPaymentConfig() {
  return apiFetch('/public/payment-config');
}

/**
 * Crée une Session Stripe Checkout et retourne l’URL de redirection.
 * @param {string} id
 * @returns {Promise<{ url: string, sessionId: string, mode: string }>}
 */
export function createCheckoutSession(id) {
  return api.post(`/client/invoices/${id}/checkout`, {});
}

/**
 * Confirme auprès de Stripe qu’une session Checkout est payée (retour ?paid=1).
 * @param {string} id
 * @returns {Promise<{ invoice: object, confirmed: boolean }>}
 */
export function confirmCheckoutSession(id) {
  return api.post(`/client/invoices/${id}/confirm-checkout`, {});
}

/** Paiement simulé (dev/test sans Stripe uniquement). */
export function payInvoice(id) {
  return api.post(`/client/invoices/${id}/pay`, {}).then((r) => r.invoice);
}

/**
 * Télécharge le PDF d'une facture (admin ou client selon le chemin).
 * @param {string} path
 * @param {string} filename
 */
export async function downloadInvoicePdf(path, filename) {
  const blob = await apiFetchBlob(path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
