import { INVOICE_STATUS_LABELS } from '@equime/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card } from '@/components/ui/card.jsx';
import { fetchClientInvoices, payInvoice } from '@/features/billing/api.js';

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUS_VARIANT = {
  draft: 'default',
  sent: 'info',
  paid: 'success',
  overdue: 'warning',
  cancelled: 'danger',
};

export function ClientInvoicesPage() {
  const qc = useQueryClient();
  const { data: invoices = [] } = useQuery({ queryKey: ['client-invoices'], queryFn: fetchClientInvoices });
  const payMutation = useMutation({
    mutationFn: payInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-invoices'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Mes factures</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          Consultez vos factures et simulez un paiement sécurisé.
        </p>
      </div>

      <Card title="Historique">
        {invoices.length === 0 ? (
          <p className="font-sans text-sm text-muted">Aucune facture pour le moment.</p>
        ) : (
          <ul className="space-y-3">
            {invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-sans text-sm font-semibold text-text">{invoice.number}</p>
                    <Badge variant={STATUS_VARIANT[invoice.status]}>
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </div>
                  <p className="font-sans text-sm text-muted">
                    {invoice.items.map((item) => item.label).join(' · ')}
                  </p>
                  <p className="font-sans text-sm text-text">{currency.format(invoice.totalCents / 100)}</p>
                </div>
                {invoice.status === 'sent' || invoice.status === 'overdue' ? (
                  <Button
                    type="button"
                    loading={payMutation.isPending}
                    onClick={() => payMutation.mutate(invoice.id)}
                  >
                    Payer
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
