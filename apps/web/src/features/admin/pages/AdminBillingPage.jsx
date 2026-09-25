import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router';

import { Alert } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import {
  fetchAdminInvoice,
  fetchAdminInvoices,
  fetchDiscountRules,
  fetchSubscriptionPlans,
  generateSubscriptionInvoices,
  remindInvoice,
  sendInvoice,
} from '@/features/billing/api.js';
import { CreateInvoiceForm } from '@/features/billing/components/CreateInvoiceForm.jsx';
import { DiscountRuleManager } from '@/features/billing/components/DiscountRuleManager.jsx';
import { InvoiceDetailDialog } from '@/features/billing/components/InvoiceDetailDialog.jsx';
import { PlanManager } from '@/features/billing/components/PlanManager.jsx';
import { formatDate } from '@/lib/dates.js';
import { formatEuroCents } from '@/lib/money.js';

const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

export function AdminBillingPage() {
  const qc = useQueryClient();
  const location = useLocation();
  // « Facturer » depuis l'annuaire : la famille arrive dans l'état de navigation
  const initialFamily = location.state?.family ?? null;
  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  const [feedback, setFeedback] = useState(
    /** @type {null | { type: 'success' | 'error', message: string }} */ (null)
  );
  const [pendingAction, setPendingAction] = useState(/** @type {string | null} */ (null));

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans,
  });
  const { data: rules = [] } = useQuery({
    queryKey: ['discount-rules'],
    queryFn: fetchDiscountRules,
  });
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

  const refreshInvoices = () => {
    qc.invalidateQueries({ queryKey: ['admin-invoices'] });
    qc.invalidateQueries({ queryKey: ['admin-invoice'] });
  };

  /** Action sur une ligne de facture : chargement limité à la ligne concernée. */
  const invoiceAction = useMutation({
    mutationFn: ({ action, invoice }) =>
      action === 'send' ? sendInvoice(invoice.id) : remindInvoice(invoice.id),
    onMutate: ({ action, invoice }) => setPendingAction(`${action}:${invoice.id}`),
    onSettled: () => setPendingAction(null),
    onSuccess: (_data, { action, invoice }) => {
      setFeedback({
        type: 'success',
        message:
          action === 'send'
            ? `Facture ${invoice.number} envoyée à la famille.`
            : `Relance envoyée pour la facture ${invoice.number}.`,
      });
      refreshInvoices();
    },
    onError: (err) => setFeedback({ type: 'error', message: err.message }),
  });

  const batchMutation = useMutation({
    mutationFn: generateSubscriptionInvoices,
    onSuccess: refreshInvoices,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Facturation & abonnements"
        description="Créez les factures, gérez les formules et les réductions, suivez les règlements."
      />

      <Card title="Nouvelle facture">
        <CreateInvoiceForm
          plans={plans}
          initialFamily={initialFamily}
          onCreated={(invoice) => {
            setFeedback({
              type: 'success',
              message: `Brouillon ${invoice.number} créé : vérifiez-le puis envoyez-le à la famille.`,
            });
            setOpenInvoiceId(invoice.id);
          }}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlanManager plans={plans} />
        <DiscountRuleManager rules={rules} />
      </div>

      <Card title="Factures">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-sm text-muted-on-card">
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
        {feedback ? (
          <Alert variant={feedback.type} className="mb-4">
            {feedback.message}
          </Alert>
        ) : null}
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
            <EmptyState title="Aucune facture. Créez un brouillon puis envoyez-le à la famille." />
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
                        className="font-sans text-sm font-semibold text-on-card underline-offset-4 hover:underline"
                        onClick={() => setOpenInvoiceId(invoice.id)}
                        aria-label={`Ouvrir la facture ${invoice.number}`}
                      >
                        {invoice.number}
                      </button>
                      <Badge variant={STATUS_VARIANT[invoice.status]}>
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                    </div>
                    <p className="font-sans text-sm text-muted-on-card">
                      {invoice.family.user.firstName} {invoice.family.user.lastName} ·{' '}
                      {formatEuroCents(invoice.totalCents)}
                      {invoice.dueAt ? ` · échéance ${formatDate(invoice.dueAt)}` : ''}
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
                        loading={pendingAction === `send:${invoice.id}`}
                        onClick={() => invoiceAction.mutate({ action: 'send', invoice })}
                      >
                        Envoyer
                      </Button>
                    ) : null}
                    {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        loading={pendingAction === `remind:${invoice.id}`}
                        onClick={() => invoiceAction.mutate({ action: 'remind', invoice })}
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
