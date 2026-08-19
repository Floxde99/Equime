import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Dialog } from '@/components/ui/dialog.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { downloadInvoicePdf } from '@/features/billing/api.js';

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'danger',
};

/** @param {string | Date | null | undefined} value */
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

/**
 * Détail lisible d'une facture (lignes, totaux, dates, statut).
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
                {currency.format((invoice.totalCents ?? 0) / 100)}
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
                <dd>{formatDate(invoice.issuedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-on-card">Échéance</dt>
                <dd>{formatDate(invoice.dueAt)}</dd>
              </div>
              {invoice.paidAt ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-on-card">Payée le</dt>
                  <dd>{formatDate(invoice.paidAt)}</dd>
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
                        {currency.format(item.unitCents / 100)}
                      </td>
                      <td className="py-2 pl-2 text-right tabular-nums">
                        {currency.format(item.totalCents / 100)}
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
                      {currency.format((invoice.totalCents ?? 0) / 100)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </QueryState>
    </Dialog>
  );
}
