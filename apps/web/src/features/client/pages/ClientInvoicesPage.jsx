import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

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
import { formatDate } from '@/lib/dates.js';
import { STITCH_PHOTOS } from '@/lib/demoPhotos.js';
import { formatEuroCents } from '@/lib/money.js';

const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

/** Durée maximale du polling de confirmation après retour de Stripe. */
const CONFIRM_POLL_MAX_MS = 2 * 60 * 1000;

/** @param {{ status: string }} invoice */
function isPayable(invoice) {
  return invoice.status === 'sent' || invoice.status === 'overdue';
}

/**
 * Libellé du bouton de paiement : l'échéance suivante pour un échéancier.
 * @param {{ installments?: unknown[], nextInstallment?: { amountCents: number } | null }} invoice
 */
function payLabel(invoice) {
  if ((invoice.installments?.length ?? 0) > 1 && invoice.nextInstallment) {
    return `Payer l’échéance (${formatEuroCents(invoice.nextInstallment.amountCents)})`;
  }
  return 'Payer';
}

/**
 * Paiement en ligne enregistré depuis l'ouverture de la page (retour de Stripe) :
 * une facture en plusieurs fois reste « envoyée » après une échéance réglée.
 * @param {{ status: string, payments?: Array<{ method: string, paidAt: string }> } | undefined} invoice
 * @param {number} since
 */
function isPaymentRecorded(invoice, since) {
  if (!invoice) return false;
  if (invoice.status === 'paid') return true;
  return (invoice.payments ?? []).some(
    (payment) => payment.method === 'card_online' && Date.parse(payment.paidAt) >= since
  );
}

/**
 * Prochaines échéances de la famille, toutes factures confondues.
 * @param {Array<{ number: string, status: string,
 *   nextInstallment?: { id: string, dueAt: string, amountCents: number } | null }>} invoices
 */
function upcomingInstallments(invoices) {
  return invoices
    .filter((invoice) => isPayable(invoice) && invoice.nextInstallment)
    .map((invoice) => ({ ...invoice.nextInstallment, number: invoice.number }))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function ClientInvoicesPage() {
  const qc = useQueryClient();
  // Retour de Stripe : seuls les règlements récents confirment le paiement attendu
  const [openedAt] = useState(() => Date.now() - 15 * 60 * 1000);
  const [searchParams, setSearchParams] = useSearchParams();
  const [openInvoice, setOpenInvoice] = useState(null);
  const confirmAttemptedRef = useRef(null);
  const awaitingConfirm = searchParams.get('paid') === '1';
  const waitingInvoiceId = searchParams.get('invoice');
  const justConfirmed = searchParams.get('confirmed') === '1';
  const [pollTimedOut, setPollTimedOut] = useState(false);

  // Le polling de confirmation est borné : paiement différé, webhook absent ou
  // URL `?paid=1` rouverte depuis l'historique ne doivent pas interroger l'API
  // indéfiniment.
  useEffect(() => {
    if (!awaitingConfirm) return undefined;
    const timer = setTimeout(() => setPollTimedOut(true), CONFIRM_POLL_MAX_MS);
    return () => clearTimeout(timer);
  }, [awaitingConfirm]);

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
      if (!awaitingConfirm || pollTimedOut) return false;
      const list = query.state.data ?? [];
      if (waitingInvoiceId) {
        const target = list.find((inv) => inv.id === waitingInvoiceId);
        if (isPaymentRecorded(target, openedAt)) return false;
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
    if (isPaymentRecorded(target, openedAt)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('paid');
          next.delete('invoice');
          // Porte le message de succès au-delà du nettoyage de `paid`.
          next.set('confirmed', '1');
          return next;
        },
        { replace: true }
      );
    }
  }, [awaitingConfirm, waitingInvoiceId, invoices, setSearchParams, openedAt]);

  const visibleInvoices = invoices.filter(
    (invoice) =>
      invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue'
  );

  const useStripe = isStripeCheckout(paymentConfig);
  const hasPayableInvoice = visibleInvoices.some(isPayable);
  const nextInstallments = upcomingInstallments(visibleInvoices);

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
    if (!target || isPaymentRecorded(target, openedAt)) return;
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

  const payPending = checkoutMutation.isPending || payMutation.isPending;
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
  const confirmStillPending =
    awaitingConfirm && waitingInvoice && !isPaymentRecorded(waitingInvoice, openedAt);
  const showConfirmPending = confirmStillPending && !pollTimedOut;
  const showConfirmTimedOut = confirmStillPending && pollTimedOut;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace famille"
        title="Historique & facturation"
        description="Suivez vos factures, vos échéances et vos règlements, et téléchargez vos justificatifs."
      />

      <PaymentTestBanner provider={paymentConfig?.provider} mode={paymentConfig?.mode} />

      {showConfirmPending ? (
        <p role="status" className="font-sans text-sm text-muted">
          Paiement en cours de confirmation… le statut se mettra à jour sous peu.
        </p>
      ) : null}

      {showConfirmTimedOut ? (
        <p role="status" className="font-sans text-sm text-muted">
          Confirmation en attente : l’enregistrement du paiement peut prendre quelques minutes.
          Revenez sur cette page plus tard.
        </p>
      ) : null}

      {justConfirmed ? (
        <p role="status" className="font-sans text-sm text-primary">
          Paiement confirmé. Merci !
        </p>
      ) : null}

      <QueryState isPending={isPending} isError={isError} error={error} onRetry={refetch}>
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card>
              <p className="font-sans text-xs uppercase tracking-wide text-muted-on-card">
                Prochaines échéances
              </p>
              {nextInstallments.length === 0 ? (
                <p className="mt-3 font-sans text-sm text-on-card">Rien à régler pour le moment.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {nextInstallments.map((installment) => (
                    <li
                      key={installment.id}
                      className="flex justify-between gap-3 font-sans text-sm text-on-card"
                    >
                      <span>
                        {formatDate(installment.dueAt)}
                        <span className="block text-xs text-muted-on-card">
                          {installment.number}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {formatEuroCents(installment.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 font-sans text-xs text-muted-on-card">
                Réglez en ligne par carte, ou au club : espèces, chèque, chèques-vacances ANCV,
                Pass’Sport.
              </p>
            </Card>
            <div className="overflow-hidden rounded-xl">
              {/* Variantes générées par scripts/optimize-images.mjs (docs/eco-conception.md) */}
              <img
                src="/images/ecuries-or-640.webp"
                srcSet={`/images/ecuries-or-640.webp 640w, /images/ecuries-or-960.webp 960w, ${STITCH_PHOTOS.billingStables} 1536w`}
                sizes="(min-width: 1024px) 20rem, 100vw"
                width={640}
                height={427}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-56 w-full object-cover"
              />
            </div>
          </div>
          <Card title="Historique">
            {visibleInvoices.length === 0 ? (
              <EmptyState title="Aucune facture pour le moment." />
            ) : (
              <>
                {/* Information précontractuelle, AVANT le paiement (C. consom. L221-5) */}
                {hasPayableInvoice ? (
                  <p className="mb-4 font-sans text-xs text-muted-on-card">
                    Le paiement vaut acceptation des{' '}
                    <Link to="/cgv" className="underline hover:text-primary">
                      conditions générales de vente
                    </Link>
                    . Les stages et événements à date fixe ne bénéficient pas du droit de
                    rétractation (article L221-28, 12° du Code de la consommation).
                  </p>
                ) : null}
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
                          {formatEuroCents(invoice.totalCents)}
                          {isPayable(invoice) && invoice.paidCents > 0
                            ? ` · reste dû ${formatEuroCents(invoice.remainingCents)}`
                            : ''}
                        </p>
                        {isPayable(invoice) && invoice.nextInstallment ? (
                          <p className="font-sans text-xs text-muted">
                            Prochaine échéance le {formatDate(invoice.nextInstallment.dueAt)}
                            {invoice.installments.length > 1
                              ? ` (${invoice.nextInstallment.sequence}/${invoice.installments.length})`
                              : ''}
                          </p>
                        ) : null}
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
                        {isPayable(invoice) ? (
                          <Button
                            type="button"
                            variant="secondary"
                            loading={payPending && payVariables === invoice.id}
                            onClick={() => handlePay(invoice.id)}
                          >
                            {payLabel(invoice)}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </QueryState>

      <InvoiceDetailDialog
        open={Boolean(openInvoice)}
        onClose={() => setOpenInvoice(null)}
        invoice={openInvoice}
        pdfPath={openInvoice ? `/client/invoices/${openInvoice.id}/pdf` : null}
        onPay={openInvoice && isPayable(openInvoice) ? () => handlePay(openInvoice.id) : undefined}
        payLabel={openInvoice ? payLabel(openInvoice) : undefined}
        payLoading={payPending && payVariables === openInvoice?.id}
      />
    </div>
  );
}
