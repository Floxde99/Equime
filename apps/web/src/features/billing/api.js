import { api } from '@/lib/apiClient.js';

export function fetchSubscriptionPlans() {
  return api.get('/admin/subscription-plans').then((r) => r.plans);
}

export function createSubscriptionPlan(body) {
  return api.post('/admin/subscription-plans', body).then((r) => r.plan);
}

export function fetchDiscountRules() {
  return api.get('/admin/discount-rules').then((r) => r.rules);
}

export function createDiscountRule(body) {
  return api.post('/admin/discount-rules', body).then((r) => r.rule);
}

export function fetchAdminInvoices() {
  return api.get('/admin/invoices').then((r) => r.invoices);
}

export function createInvoice(body) {
  return api.post('/admin/invoices', body).then((r) => r.invoice);
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

export function payInvoice(id) {
  return api.post(`/client/invoices/${id}/pay`, {}).then((r) => r.invoice);
}
