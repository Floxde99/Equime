import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { Field } from '@/components/ui/field.jsx';
import { Input } from '@/components/ui/input.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import {
  createDiscountRule,
  createInvoice,
  createSubscriptionPlan,
  fetchAdminInvoice,
  fetchAdminInvoices,
  fetchDiscountRules,
  fetchSubscriptionPlans,
  generateSubscriptionInvoices,
  remindInvoice,
  sendInvoice,
} from '@/features/billing/api.js';
import { InvoiceDetailDialog } from '@/features/billing/components/InvoiceDetailDialog.jsx';

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

export function AdminBillingPage() {
  const qc = useQueryClient();
  const [planForm, setPlanForm] = useState({
    name: '',
    priceCents: 4900,
    sessionsPerWeek: 1,
    description: '',
  });
  const [ruleForm, setRuleForm] = useState({ label: '', percentage: 10, minRiders: 2, description: '' });
  const [invoiceForm, setInvoiceForm] = useState({ familyId: '', dueAt: '' });
  const [openInvoiceId, setOpenInvoiceId] = useState(null);

  const { data: plans = [] } = useQuery({ queryKey: ['subscription-plans'], queryFn: fetchSubscriptionPlans });
  const { data: rules = [] } = useQuery({ queryKey: ['discount-rules'], queryFn: fetchDiscountRules });
  const {
    data: invoices = [],
    isPending: invoicesPending,
    isError: invoicesError,
    error: invoicesQueryError,
    refetch: refetchInvoices,
  } = useQuery({ queryKey: ['admin-invoices'], queryFn: fetchAdminInvoices });
  const listInvoice = invoices.find((invoice) => invoice.id === openInvoiceId);
  const {
    data: invoiceDetail,
    isPending: detailPending,
    isError: detailError,
    error: detailQueryError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['admin-invoice', openInvoiceId],
    queryFn: () => fetchAdminInvoice(openInvoiceId),
    enabled: Boolean(openInvoiceId),
    placeholderData: listInvoice,
  });
  const openInvoice = invoiceDetail ?? listInvoice;

  const refreshBilling = () => {
    qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    qc.invalidateQueries({ queryKey: ['discount-rules'] });
    qc.invalidateQueries({ queryKey: ['admin-invoices'] });
    qc.invalidateQueries({ queryKey: ['admin-invoice'] });
  };

  const planMutation = useMutation({
    mutationFn: createSubscriptionPlan,
    onSuccess: () => {
      setPlanForm({ name: '', priceCents: 4900, sessionsPerWeek: 1, description: '' });
      refreshBilling();
    },
  });
  const ruleMutation = useMutation({
    mutationFn: createDiscountRule,
    onSuccess: () => {
      setRuleForm({ label: '', percentage: 10, minRiders: 2, description: '' });
      refreshBilling();
    },
  });
  const invoiceMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      setInvoiceForm({ familyId: '', dueAt: '' });
      refreshBilling();
    },
  });
  const sendMutation = useMutation({ mutationFn: sendInvoice, onSuccess: refreshBilling });
  const remindMutation = useMutation({ mutationFn: remindInvoice, onSuccess: refreshBilling });
  const batchMutation = useMutation({
    mutationFn: generateSubscriptionInvoices,
    onSuccess: refreshBilling,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Facturation & abonnements"
        description="Gérez les formules, les réductions et le suivi des factures."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Nouvelle formule">
          <div className="space-y-3">
            <Field label="Nom" htmlFor="plan-name">
              <Input
                id="plan-name"
                value={planForm.name}
                onChange={(e) => setPlanForm((v) => ({ ...v, name: e.target.value }))}
              />
            </Field>
            <Field label="Prix (centimes)" htmlFor="plan-price">
              <Input
                id="plan-price"
                type="number"
                value={planForm.priceCents}
                onChange={(e) => setPlanForm((v) => ({ ...v, priceCents: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Séances / semaine" htmlFor="plan-sessions">
              <Input
                id="plan-sessions"
                type="number"
                value={planForm.sessionsPerWeek}
                onChange={(e) =>
                  setPlanForm((v) => ({ ...v, sessionsPerWeek: Number(e.target.value) }))
                }
              />
            </Field>
            <Button type="button" loading={planMutation.isPending} onClick={() => planMutation.mutate(planForm)}>
              Enregistrer
            </Button>
          </div>
        </Card>

        <Card title="Nouvelle réduction">
          <div className="space-y-3">
            <Field label="Libellé" htmlFor="rule-label">
              <Input
                id="rule-label"
                value={ruleForm.label}
                onChange={(e) => setRuleForm((v) => ({ ...v, label: e.target.value }))}
              />
            </Field>
            <Field label="Pourcentage" htmlFor="rule-percentage">
              <Input
                id="rule-percentage"
                type="number"
                value={ruleForm.percentage}
                onChange={(e) => setRuleForm((v) => ({ ...v, percentage: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Min. cavaliers" htmlFor="rule-min-riders">
              <Input
                id="rule-min-riders"
                type="number"
                value={ruleForm.minRiders}
                onChange={(e) => setRuleForm((v) => ({ ...v, minRiders: Number(e.target.value) }))}
              />
            </Field>
            <Button type="button" loading={ruleMutation.isPending} onClick={() => ruleMutation.mutate(ruleForm)}>
              Enregistrer
            </Button>
          </div>
        </Card>

        <Card title="Générer une facture">
          <div className="space-y-3">
            <Field label="Family ID" htmlFor="invoice-family-id" hint="ID de la famille cible.">
              <Input
                id="invoice-family-id"
                value={invoiceForm.familyId}
                onChange={(e) => setInvoiceForm((v) => ({ ...v, familyId: e.target.value }))}
              />
            </Field>
            <Field label="Échéance" htmlFor="invoice-due-at">
              <Input
                id="invoice-due-at"
                type="date"
                value={invoiceForm.dueAt}
                onChange={(e) => setInvoiceForm((v) => ({ ...v, dueAt: e.target.value }))}
              />
            </Field>
            <Button
              type="button"
              loading={invoiceMutation.isPending}
              onClick={() =>
                invoiceMutation.mutate({
                  familyId: invoiceForm.familyId,
                  dueAt: invoiceForm.dueAt || undefined,
                })
              }
            >
              Générer
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Formules actives">
          <ul className="space-y-3">
            {plans.map((plan) => (
              <li key={plan.id} className="rounded-xl border border-border-on-card bg-paper p-3">
                <p className="font-sans text-sm font-semibold text-text">{plan.name}</p>
                <p className="font-sans text-sm text-muted">
                  {currency.format(plan.priceCents / 100)} · {plan.sessionsPerWeek} séance(s)/semaine
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Règles de réduction">
          <ul className="space-y-3">
            {rules.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-border-on-card bg-paper p-3">
                <p className="font-sans text-sm font-semibold text-text">{rule.label}</p>
                <p className="font-sans text-sm text-muted">
                  -{rule.percentage}% dès {rule.minRiders ?? 0} cavalier(s)
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Factures">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-sm text-muted">
            Brouillon pour chaque famille abonnée sans facture sur le mois en cours.
          </p>
          <Button
            type="button"
            variant="secondary"
            loading={batchMutation.isPending}
            onClick={() => batchMutation.mutate()}
          >
            Générer les factures d&apos;abonnement du mois
          </Button>
        </div>
        {batchMutation.isError ? (
          <Alert className="mb-4">{batchMutation.error.message}</Alert>
        ) : null}
        {batchMutation.isSuccess ? (
          <Alert variant="success" className="mb-4">
            {batchMutation.data.createdCount} facture(s) générée(s)
            {batchMutation.data.skippedCount > 0
              ? ` · ${batchMutation.data.skippedCount} déjà facturée(s) ce mois`
              : ''}
            .
          </Alert>
        ) : null}
        <QueryState
          isPending={invoicesPending}
          isError={invoicesError}
          error={invoicesQueryError}
          onRetry={refetchInvoices}
        >
          {invoices.length === 0 ? (
            <EmptyState title="Aucune facture. Générez un brouillon puis envoyez-le à la famille." />
          ) : (
            <ul className="space-y-3">
              {invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-on-card bg-paper p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="font-sans text-sm font-semibold text-text underline-offset-4 hover:underline"
                        onClick={() => setOpenInvoiceId(invoice.id)}
                        aria-label={`Ouvrir la facture ${invoice.number}`}
                      >
                        {invoice.number}
                      </button>
                      <Badge variant={STATUS_VARIANT[invoice.status]}>
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                    </div>
                    <p className="font-sans text-sm text-muted">
                      {invoice.family.user.firstName} {invoice.family.user.lastName} ·{' '}
                      {currency.format(invoice.totalCents / 100)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOpenInvoiceId(invoice.id)}
                      aria-label={`Voir la facture ${invoice.number}`}
                    >
                      Voir
                    </Button>
                    {invoice.status === 'draft' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        loading={sendMutation.isPending}
                        onClick={() => sendMutation.mutate(invoice.id)}
                      >
                        Envoyer
                      </Button>
                    ) : null}
                    {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        loading={remindMutation.isPending}
                        onClick={() => remindMutation.mutate(invoice.id)}
                      >
                        Relancer
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </Card>

      <InvoiceDetailDialog
        open={Boolean(openInvoiceId)}
        onClose={() => setOpenInvoiceId(null)}
        invoice={openInvoice}
        isPending={Boolean(openInvoiceId) && !openInvoice && detailPending}
        isError={Boolean(openInvoiceId) && !openInvoice && detailError}
        error={detailQueryError}
        onRetry={refetchDetail}
        showFamily
        pdfPath={openInvoice ? `/admin/invoices/${openInvoice.id}/pdf` : null}
      />
    </div>
  );
}
