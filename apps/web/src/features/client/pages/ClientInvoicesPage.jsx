import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { EmptyState } from '@/components/ui/empty-state.jsx';
import { PageHeader } from '@/components/ui/page-header.jsx';
import { QueryState } from '@/components/ui/query-state.jsx';
import { fetchClientInvoices, payInvoice } from '@/features/billing/api.js';
import { InvoiceDetailDialog } from '@/features/billing/components/InvoiceDetailDialog.jsx';
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
  const [openInvoice, setOpenInvoice] = useState(null);
  const {
    data: invoices = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: fetchClientInvoices,
  });
  const visibleInvoices = invoices.filter(
    (invoice) =>
      invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue'
  );
  const payMutation = useMutation({
    mutationFn: payInvoice,
    onSuccess: (paid) => {
      qc.invalidateQueries({ queryKey: ['client-invoices'] });
      setOpenInvoice((current) => (current?.id === paid.id ? paid : current));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace famille"
        title="Historique & facturation"
        description="Gérez vos abonnements, consultez vos transactions et téléchargez vos justificatifs."
      />

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
                          loading={payMutation.isPending && payMutation.variables === invoice.id}
                          onClick={() => payMutation.mutate(invoice.id)}
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
      />
    </div>
  );
}
