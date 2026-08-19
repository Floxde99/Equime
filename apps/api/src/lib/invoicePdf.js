// @ts-check
/**
 * Génération du PDF de facture (PDFKit, A4).
 * Le helper est pur : pas d’accès Prisma ni `req`/`res`.
 */
import { INVOICE_STATUS_LABELS } from '@equime/shared';
import PDFDocument from 'pdfkit';

const PAGE_WIDTH = 595.28;
const MARGIN = 48;
const FOREST = '#1b4332';
const INK = '#1a1a1a';
const MUTED = '#5c6b63';
const BORDER = '#e4e0d6';
const PAPER = '#f6f4ef';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

/**
 * @param {unknown} cents
 */
function formatCents(cents) {
  return euro.format((Number(cents) || 0) / 100);
}

/**
 * @param {string | Date | null | undefined} value
 */
function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return longDate.format(date);
}

/**
 * Nom de fichier ASCII sûr pour Content-Disposition.
 * @param {string} [number]
 */
export function invoicePdfFilename(number) {
  const safe = String(number ?? 'facture')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  return `facture-${safe || 'document'}.pdf`;
}

/**
 * @typedef {{ name?: string, address?: string, phone?: string, email?: string }} ClubIssuer
 * @typedef {{
 *   number: string,
 *   status: string,
 *   issuedAt?: Date | string | null,
 *   dueAt?: Date | string | null,
 *   paidAt?: Date | string | null,
 *   totalCents: number,
 *   family?: { user?: { firstName?: string, lastName?: string, email?: string } },
 *   items?: Array<{ label: string, quantity: number, unitCents: number, totalCents: number }>,
 * }} InvoicePdfInput
 */

/**
 * Construit un PDF A4 pour une facture Equime.
 *
 * @param {InvoicePdfInput} invoice
 * @param {ClubIssuer} [issuer]
 * @returns {Promise<Buffer>}
 */
export function buildInvoicePdf(invoice, issuer = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, compress: true });
    /** @type {Buffer[]} */
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const clubName = issuer.name?.trim() || 'Equime';
    const statusLabel = INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status;
    const user = invoice.family?.user;
    const clientName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Client';
    const items = invoice.items ?? [];

    doc.rect(0, 0, PAGE_WIDTH, 72).fill(FOREST);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(clubName.toUpperCase(), MARGIN, 22, {
        width: 280,
      });
    doc
      .font('Helvetica')
      .fontSize(10)
      .text('Facture', PAGE_WIDTH - MARGIN - 180, 26, {
        width: 180,
        align: 'right',
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(invoice.number, PAGE_WIDTH - MARGIN - 180, 42, {
        width: 180,
        align: 'right',
      });

    let y = 96;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('ÉMETTEUR', MARGIN, y);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(clubName, MARGIN, y + 12);
    const issuerLines = [issuer.address, issuer.phone, issuer.email].filter(Boolean);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(INK)
      .text(issuerLines.join('\n') || 'Centre équestre', MARGIN, y + 28, {
        width: 240,
        lineGap: 2,
      });

    doc.fillColor(MUTED).fontSize(8).text('DESTINATAIRE', 320, y);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(clientName, 320, y + 12, { width: 227 });
    if (user?.email) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(user.email, 320, y + 28, { width: 227 });
    }

    y = 186;
    doc.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 52).fill(PAPER);
    const meta = [
      ['Statut', statusLabel],
      ['Émise le', formatDate(invoice.issuedAt)],
      ['Échéance', formatDate(invoice.dueAt)],
      ['Payée le', invoice.paidAt ? formatDate(invoice.paidAt) : '—'],
    ];
    meta.forEach(([label, value], index) => {
      const x = MARGIN + 12 + index * 120;
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(8)
        .text(label, x, y + 10, { width: 110 });
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(value, x, y + 24, { width: 110 });
    });

    y = 258;
    const colLabel = MARGIN;
    const colQty = 330;
    const colUnit = 400;
    const colTotal = 478;
    const tableWidth = PAGE_WIDTH - MARGIN * 2;

    doc.rect(MARGIN, y, tableWidth, 22).fill(FOREST);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    doc.text('LIBELLÉ', colLabel + 8, y + 7, { width: 260 });
    doc.text('QTÉ', colQty, y + 7, { width: 50, align: 'right' });
    doc.text('PRIX UNIT.', colUnit, y + 7, { width: 70, align: 'right' });
    doc.text('TOTAL', colTotal, y + 7, { width: 70, align: 'right' });

    y += 28;
    doc.font('Helvetica').fontSize(9).fillColor(INK);

    for (const item of items) {
      if (y > 720) {
        doc.addPage();
        y = MARGIN;
      }
      const labelHeight = doc.heightOfString(item.label, { width: 260 });
      const rowHeight = Math.max(18, labelHeight);
      doc.text(item.label, colLabel + 8, y, { width: 260 });
      doc.text(String(item.quantity), colQty, y, { width: 50, align: 'right' });
      doc.text(formatCents(item.unitCents), colUnit, y, { width: 70, align: 'right' });
      doc.text(formatCents(item.totalCents), colTotal, y, { width: 70, align: 'right' });
      y += rowHeight + 8;
      doc
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .moveTo(MARGIN, y - 4)
        .lineTo(PAGE_WIDTH - MARGIN, y - 4)
        .stroke();
    }

    if (y > 700) {
      doc.addPage();
      y = MARGIN;
    }

    y += 12;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(FOREST);
    doc.text('Total TTC', colUnit, y, { width: 70, align: 'right' });
    doc.text(formatCents(invoice.totalCents), colTotal, y, { width: 70, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'Document généré par Equime. Paiement simulé en recette (aucun prélèvement bancaire).',
        MARGIN,
        780,
        { width: tableWidth, align: 'center' }
      );

    doc.end();
  });
}
