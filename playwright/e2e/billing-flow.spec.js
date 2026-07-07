import { expect, test } from '@playwright/test';

import { loginAs } from './helpers.js';

test('un client peut payer une facture et l’admin voit le statut mis à jour', async ({
  browser,
  page,
}) => {
  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: 'Bonjour, Lina',
  });

  await page.getByRole('main').getByRole('link', { name: 'Factures' }).click();
  await expect(page.getByRole('heading', { name: 'Mes factures' })).toBeVisible();

  const invoiceRow = page.locator('li').filter({ hasText: 'FAC-2026-0002' }).first();
  await expect(invoiceRow).toBeVisible();

  const payButton = invoiceRow.getByRole('button', { name: 'Payer' });
  if (await payButton.isVisible()) {
    await payButton.click();
  }
  await expect(invoiceRow.getByText('Payée')).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await loginAs(adminPage, {
    email: 'admin@equime.local',
    password: 'Equime!2026',
    landingHeading: 'Tableau de bord',
  });

  await adminPage.getByRole('link', { name: 'Facturation' }).click();
  await expect(adminPage.getByRole('heading', { name: 'Facturation & abonnements' })).toBeVisible();

  const adminInvoiceRow = adminPage.locator('li').filter({ hasText: 'FAC-2026-0002' }).first();
  await expect(adminInvoiceRow).toBeVisible();
  await expect(adminInvoiceRow.getByText('Payée')).toBeVisible();

  await adminContext.close();
});
