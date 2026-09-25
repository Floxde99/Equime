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
  remindInvoice,
  sendInvoice,
} from '@/features/billing/api.js';
import { CreateInvoiceForm } from '@/features/billing/components/CreateInvoiceForm.jsx';
import { DiscountRuleManager } from '@/features/billing/components/DiscountRuleManager.jsx';
import { InvoiceDetailDialog } from '@/features/billing/components/InvoiceDetailDialog.jsx';
import { PlanManager } from '@/features/billing/components/PlanManager.jsx';
import { RecordPaymentDialog } from '@/features/billing/components/RecordPaymentDialog.jsx';
import { formatDate } from '@/lib/dates.js';
import { formatEuroCents } from '@/lib/money.js';

const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

/** @param {{ status: string }} invoice */
function isPayable(invoice) {
  return invoice.status === 'sent' || invoice.status === 'overdue';
}

/**
 * Montant et avancement d'une facture dans la liste.
 * @param {{ totalCents: number, status: string, paidCents: number, remainingCents: number,
 *   installments: unknown[], nextInstallment: { dueAt: string } | null, dueAt: string | null }} invoice
 */
function amountSummary(invoice) {
  const parts = [formatEuroCents(invoice.totalCents)];
  if (invoice.installments.length > 1) parts.push(`${invoice.installments.length} échéances`);
  if (isPayable(invoice) && invoice.paidCents > 0) {
    parts.push(`reste dû ${formatEuroCents(invoice.remainingCents)}`);
  }
  const due = isPayable(invoice) ? invoice.nextInstallment?.dueAt : invoice.dueAt;
  if (due && invoice.status !== 'paid') parts.push(`échéance ${formatDate(due)}`);
  return parts.join(' · ');
}

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
  const [paymentInvoice, setPaymentInvoice] = useState(/** @type {object | null} */ (null));

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Facturation & forfaits"
        description="Forfaits de saison, factures, échéances et règlements reçus au club."
      />

      <Card title="Nouvelle facture">
        <CreateInvoiceForm
          key={initialFamily?.id ?? 'nouvelle'}
          plans={plans}
          initialFamily={initialFamily}
          onCreated={(invoice) => {
            setFeedback({
              type: 'success',
              message: `Brouillon ${invoice.number} créé : vérifiez-le puis envoyez-le à la famille.`,
            });
            setOpenInvoiceId(invoice.id);
          }}
          onSubscribed={({ invoice }) => {
            setFeedback({
              type: 'success',
              message: `Forfait enregistré : facture ${invoice.number} envoyée à la famille avec son échéancier.`,
            });
            refreshInvoices();
            setOpenInvoiceId(invoice.id);
          }}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlanManager plans={plans} />
        <DiscountRuleManager rules={rules} />
      </div>

      <Card title="Factures">
        {feedback ? (
          <Alert variant={feedback.type} className="mb-4">
            {feedback.message}
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
                      {amountSummary(invoice)}
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
                    {isPayable(invoice) ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setPaymentInvoice(invoice)}
                          aria-label={`Enregistrer un règlement pour la facture ${invoice.number}`}
                        >
                          Encaisser
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          loading={pendingAction === `remind:${invoice.id}`}
                          onClick={() => invoiceAction.mutate({ action: 'remind', invoice })}
                        >
                          Relancer
                        </Button>
                      </>
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
        onRecordPayment={
          openInvoice && isPayable(openInvoice) ? () => setPaymentInvoice(openInvoice) : null
        }
      />

      <RecordPaymentDialog
        invoice={paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        onRecorded={(updated) =>
          setFeedback({
            type: 'success',
            message:
              updated.status === 'paid'
                ? `Règlement enregistré : la facture ${updated.number} est soldée.`
                : `Règlement enregistré pour la facture ${updated.number} : reste dû ${formatEuroCents(updated.remainingCents)}.`,
          })
        }
      />
    </div>
  );
}
