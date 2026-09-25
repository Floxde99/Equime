import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@equime/shared';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { downloadInvoicePdf } from '@/features/billing/api.js';
import { formatDate } from '@/lib/dates.js';
import { formatEuroCents } from '@/lib/money.js';

const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

/** @param {string | Date | null | undefined} value */
function formatDateOrDash(value) {
  return value ? formatDate(value) : '—';
}

/**
 * Échéancier et règlements reçus (ADR 011).
 * @param {{ invoice: { installments?: Array<{ id: string, sequence: number, dueAt: string,
 *   amountCents: number, paidAt: string | null }>, payments?: Array<{ id: string, method: string,
 *   amountCents: number, paidAt: string, reference: string | null }>, remainingCents?: number,
 *   status: string } }} props
 */
function PaymentSchedule({ invoice }) {
  const installments = invoice.installments ?? [];
  const payments = invoice.payments ?? [];
  if (installments.length <= 1 && payments.length === 0) return null;

  return (
    <div className="space-y-3">
      {installments.length > 1 ? (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-on-card">Échéancier</h4>
          <ol className="mt-1 grid gap-x-6 gap-y-0.5 font-sans text-sm sm:grid-cols-2">
            {installments.map((installment) => (
              <li key={installment.id} className="flex justify-between gap-3 tabular-nums">
                <span>
                  {formatDate(installment.dueAt)}
                  {installment.paidAt ? (
                    <span className="ml-1 text-xs text-success">réglée</span>
                  ) : null}
                </span>
                <span>{formatEuroCents(installment.amountCents)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {payments.length > 0 ? (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-muted-on-card">Règlements reçus</h4>
          <ul className="mt-1 space-y-0.5 font-sans text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-3 tabular-nums">
                <span>
                  {formatDate(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method]}
                  {payment.reference ? ` (${payment.reference})` : ''}
                </span>
                <span>{formatEuroCents(payment.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {invoice.status !== 'paid' && typeof invoice.remainingCents === 'number' ? (
        <p className="font-sans text-sm font-semibold">
          Reste dû : {formatEuroCents(invoice.remainingCents)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Détail lisible d'une facture (lignes, échéancier, règlements, statut).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   invoice?: object | null,
 *   isPending?: boolean,
 *   isError?: boolean,
 *   error?: { message?: string } | null,
 *   onRetry?: () => void,
 *   showFamily?: boolean,
 *   pdfPath?: string | null,
 *   onPay?: (() => void) | null,
 *   payLabel?: string,
 *   payLoading?: boolean,
 *   onRecordPayment?: (() => void) | null,
 * }} props
 */
export function InvoiceDetailDialog({
  open,
  onClose,
  invoice,
  isPending = false,
  isError = false,
  error = null,
  onRetry,
  showFamily = false,
  pdfPath = null,
  onPay = null,
  payLabel = 'Payer',
  payLoading = false,
  onRecordPayment = null,
}) {
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const familyName = invoice?.family?.user
    ? `${invoice.family.user.firstName} ${invoice.family.user.lastName}`
    : '—';

  async function handleDownload() {
    if (!invoice?.number || !pdfPath) return;
    setPdfError('');
    setDownloading(true);
    try {
      const safe = String(invoice.number).replace(/[^\w.-]+/g, '_');
      await downloadInvoicePdf(pdfPath, `facture-${safe}.pdf`);
    } catch (err) {
      setPdfError(err?.message ?? 'Téléchargement du PDF impossible');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={invoice?.number ?? 'Facture'}
      className="max-w-xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {onRecordPayment ? (
            <Button type="button" variant="secondary" onClick={onRecordPayment}>
              Enregistrer un règlement
            </Button>
          ) : null}
          {onPay ? (
            <Button type="button" variant="secondary" loading={payLoading} onClick={onPay}>
              {payLabel}
            </Button>
          ) : null}
          {invoice && pdfPath ? (
            <Button type="button" loading={downloading} onClick={handleDownload}>
              Télécharger le PDF
            </Button>
          ) : null}
        </>
      }
    >
      <QueryState isPending={isPending} isError={isError} error={error} onRetry={onRetry}>
        {invoice ? (
          <div className="space-y-4 text-on-card">
            {pdfError ? (
              <p role="alert" className="font-sans text-sm text-danger">
                {pdfError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[invoice.status] ?? 'default'}>
                {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
              </Badge>
              <p className="font-sans text-sm font-semibold">
                {formatEuroCents(invoice.totalCents ?? 0)}
              </p>
            </div>

            <dl className="grid gap-2 sm:grid-cols-2">
              {showFamily ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-on-card">Famille</dt>
                  <dd>{familyName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-on-card">Émise le</dt>
                <dd>{formatDateOrDash(invoice.issuedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-on-card">
                  {(invoice.installments?.length ?? 0) > 1 ? 'Première échéance' : 'Échéance'}
                </dt>
                <dd>{formatDateOrDash(invoice.dueAt)}</dd>
              </div>
              {invoice.paidAt ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-on-card">Payée le</dt>
                  <dd>{formatDateOrDash(invoice.paidAt)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Lignes de la facture {invoice.number}</caption>
                <thead>
                  <tr className="border-b border-border-on-card text-xs uppercase tracking-wide text-muted-on-card">
                    <th scope="col" className="py-2 pr-3 font-sans font-semibold">
                      Libellé
                    </th>
                    <th scope="col" className="py-2 px-2 text-right font-sans font-semibold">
                      Qté
                    </th>
                    <th scope="col" className="py-2 px-2 text-right font-sans font-semibold">
                      Prix unit.
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right font-sans font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-border-on-card">
                      <td className="py-2 pr-3">{item.label}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatEuroCents(item.unitCents)}
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {formatEuroCents(item.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3} className="pt-3 text-right font-sans font-semibold">
                      Total TTC
                    </th>
                    <td className="pt-3 pl-2 text-right font-sans font-semibold tabular-nums">
                      {formatEuroCents(invoice.totalCents ?? 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <PaymentSchedule invoice={invoice} />
          </div>
        ) : null}
      </QueryState>
    </Dialog>
  );
}
