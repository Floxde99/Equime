import { describe, expect, it } from 'vitest';

import { buildInvoicePdf, invoicePdfFilename } from './invoicePdf.js';

const sampleInvoice = {
  number: 'FAC-2026-PDF',
  status: 'sent',
  issuedAt: new Date('2026-08-01T00:00:00.000Z'),
  dueAt: new Date('2026-08-15T00:00:00.000Z'),
  paidAt: null,
  totalCents: 8900,
  family: { user: { firstName: 'Lina', lastName: 'Martin', email: 'lina@test.fr' } },
  items: [
    { label: 'Formule Classique', quantity: 1, unitCents: 8900, totalCents: 8900 },
  ],
};

describe('invoicePdfFilename', () => {
  it('conserve un numéro ASCII et refuse les caractères spéciaux', () => {
    expect(invoicePdfFilename('FAC-2026-0001')).toBe('facture-FAC-2026-0001.pdf');
    expect(invoicePdfFilename('FAC 2026/../x')).toBe('facture-FAC_2026_.._x.pdf');
  });
});

describe('buildInvoicePdf', () => {
  it('produit un buffer PDF valide', async () => {
    const buffer = await buildInvoicePdf(sampleInvoice, {
      name: 'Equime',
      address: '12 chemin des Écuries, 31000 Toulouse',
      phone: '05 61 00 00 00',
      email: 'contact@equime.local',
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
