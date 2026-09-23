import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import {
  confirmCheckoutSession,
  createCheckoutSession,
  fetchClientInvoices,
  fetchPaymentConfig,
  payInvoice,
} from '@/features/billing/api.js';
import { InvoiceDetailDialog } from '@/features/billing/components/InvoiceDetailDialog.jsx';
import { PaymentTestBanner } from '@/features/billing/components/PaymentTestBanner.jsx';
import { isStripeCheckout } from '@/features/billing/paymentMode.js';
import { STITCH_PHOTOS } from '@/lib/demoPhotos.js';
import { useAuthStore } from '@/stores/authStore.js';

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

export function ClientInvoicesPage() {
  const user = useAuthStore((s) => s.user);
  const quota = user?.sessionQuota ?? 0;
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openInvoice, setOpenInvoice] = useState(null);
  const confirmAttemptedRef = useRef(null);
  const awaitingConfirm = searchParams.get('paid') === '1';
  const waitingInvoiceId = searchParams.get('invoice');

  const { data: paymentConfig } = useQuery({
    queryKey: ['payment-config'],
    queryFn: fetchPaymentConfig,
    staleTime: 60_000,
  });

  const {
    data: invoices = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: fetchClientInvoices,
    refetchInterval: (query) => {
      if (!awaitingConfirm) return false;
      const list = query.state.data ?? [];
      if (waitingInvoiceId) {
        const target = list.find((inv) => inv.id === waitingInvoiceId);
        if (target?.status === 'paid') return false;
      }
      return 2000;
    },
  });

  useEffect(() => {
    if (!awaitingConfirm) return;
    qc.invalidateQueries({ queryKey: ['client-invoices'] });
  }, [awaitingConfirm, qc]);

  useEffect(() => {
    if (!awaitingConfirm || !waitingInvoiceId) return;
    const target = invoices.find((inv) => inv.id === waitingInvoiceId);
    if (target?.status === 'paid') {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('paid');
          next.delete('invoice');
          return next;
        },
        { replace: true }
      );
    }
  }, [awaitingConfirm, waitingInvoiceId, invoices, setSearchParams]);

  const visibleInvoices = invoices.filter(
    (invoice) =>
      invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue'
  );

  const useStripe = isStripeCheckout(paymentConfig);

  const confirmCheckoutMutation = useMutation({
    mutationFn: confirmCheckoutSession,
    onSuccess: (data) => {
      const updated = data?.invoice;
      if (updated?.id) {
        qc.setQueryData(['client-invoices'], (prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv));
        });
        setOpenInvoice((current) =>
          current?.id === updated.id ? { ...current, ...updated } : current
        );
      }
      void qc.invalidateQueries({ queryKey: ['client-invoices'] });
    },
    onError: () => {
      // Autoriser un nouvel essai (ex. API pas encore rechargée / 404 transitoire).
      confirmAttemptedRef.current = null;
    },
  });

  useEffect(() => {
    if (!awaitingConfirm || !waitingInvoiceId || !useStripe) return;
    if (isPending) return;
    const target = invoices.find((inv) => inv.id === waitingInvoiceId);
    if (!target || target.status === 'paid') return;
    if (confirmAttemptedRef.current === waitingInvoiceId) return;
    confirmAttemptedRef.current = waitingInvoiceId;
    confirmCheckoutMutation.mutate(waitingInvoiceId);
    // Intentionally omit mutation object — fire once per invoice id when unpaid after ?paid=1.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [awaitingConfirm, waitingInvoiceId, useStripe, isPending, invoices]);

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (result) => {
      if (result?.url) window.location.assign(result.url);
    },
  });

  const payMutation = useMutation({
    mutationFn: payInvoice,
    onSuccess: (paid) => {
      qc.invalidateQueries({ queryKey: ['client-invoices'] });
      setOpenInvoice((current) => (current?.id === paid.id ? paid : current));
    },
  });

  const payPending =
    checkoutMutation.isPending || payMutation.isPending;
  const payVariables = checkoutMutation.isPending
    ? checkoutMutation.variables
    : payMutation.variables;

  function handlePay(invoiceId) {
    if (useStripe) {
      checkoutMutation.mutate(invoiceId);
    } else {
      payMutation.mutate(invoiceId);
    }
  }

  const waitingInvoice = waitingInvoiceId
    ? invoices.find((inv) => inv.id === waitingInvoiceId)
    : null;
  const showConfirmPending =
    awaitingConfirm && waitingInvoice && waitingInvoice.status !== 'paid';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace famille"
        title="Historique & facturation"
        description="Gérez vos abonnements, consultez vos transactions et téléchargez vos justificatifs."
      />

      <PaymentTestBanner provider={paymentConfig?.provider} mode={paymentConfig?.mode} />

      {showConfirmPending ? (
        <p role="status" className="font-sans text-sm text-muted">
          Paiement en cours de confirmation… le statut se mettra à jour sous peu.
        </p>
      ) : null}

      {awaitingConfirm && waitingInvoice?.status === 'paid' ? (
        <p role="status" className="font-sans text-sm text-primary">
          Paiement confirmé. Merci !
        </p>
      ) : null}

      <QueryState isPending={isPending} isError={isError} error={error} onRetry={refetch}>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <p className="font-sans text-xs uppercase tracking-wide text-muted-on-card">
                Abonnement actuel
              </p>
              <h2 className="mt-2 font-display text-2xl text-on-card">Forfait famille</h2>
              <p className="mt-4 font-display text-5xl text-primary">{quota}</p>
              <p className="mt-1 font-sans text-sm text-muted-on-card">séances restantes</p>
            </Card>
            <div className="overflow-hidden rounded-xl">
              <img src={STITCH_PHOTOS.billingStables} alt="" className="h-56 w-full object-cover" />
            </div>
          </div>
          <Card title="Historique">
            {visibleInvoices.length === 0 ? (
              <EmptyState title="Aucune facture pour le moment." />
            ) : (
              <ul className="space-y-3">
                {visibleInvoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-on-card bg-paper p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="font-sans text-sm font-semibold text-text underline-offset-4 hover:underline"
                          onClick={() => setOpenInvoice(invoice)}
                          aria-label={`Ouvrir la facture ${invoice.number}`}
                        >
                          {invoice.number}
                        </button>
                        <Badge variant={STATUS_VARIANT[invoice.status]}>
                          {INVOICE_STATUS_LABELS[invoice.status]}
                        </Badge>
                      </div>
                      <p className="font-sans text-sm text-muted">
                        {invoice.items.map((item) => item.label).join(' · ')}
                      </p>
                      <p className="font-sans text-sm text-text">
                        {currency.format(invoice.totalCents / 100)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setOpenInvoice(invoice)}
                        aria-label={`Voir la facture ${invoice.number}`}
                      >
                        Voir
                      </Button>
                      {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={payPending && payVariables === invoice.id}
                          onClick={() => handlePay(invoice.id)}
                        >
                          Payer
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </QueryState>

      <InvoiceDetailDialog
        open={Boolean(openInvoice)}
        onClose={() => setOpenInvoice(null)}
        invoice={openInvoice}
        pdfPath={openInvoice ? `/client/invoices/${openInvoice.id}/pdf` : null}
        onPay={
          openInvoice && (openInvoice.status === 'sent' || openInvoice.status === 'overdue')
            ? () => handlePay(openInvoice.id)
            : undefined
        }
        payLoading={payPending && payVariables === openInvoice?.id}
      />
    </div>
  );
}
