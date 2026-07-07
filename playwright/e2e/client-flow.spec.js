import { expect, test } from '@playwright/test';

import { loginAs, selectOptionByLabel } from './helpers.js';

test('un client peut ajouter un cavalier, réserver un cours et consulter le planning', async ({
  page,
}) => {
  const nonce = Date.now();

  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: 'Bonjour, Lina',
  });

  await page.goto('/app/cavaliers');
  await expect(page.getByRole('heading', { name: 'Cavaliers' })).toBeVisible();

  await page.getByLabel('Prénom').fill('Nina');
  await page.getByLabel('Nom', { exact: true }).fill(`E2E${nonce}`);
  await page.getByLabel('Date de naissance').fill('2016-05-14');
  await selectOptionByLabel(page, 'Niveau', 'Galop 1');
  await page.getByRole('button', { name: 'Ajouter' }).click();

  await expect(page.getByText(`Nina E2E${nonce}`)).toBeVisible();

  await page.goto('/app');
  const riderSelect = page.getByLabel('Cavalier');
  await expect(riderSelect.locator('option', { hasText: /Nina E2E/ })).toHaveCount(1);
  const riderOption = riderSelect.locator('option', { hasText: /Nina E2E/ }).first();
  await riderSelect.selectOption({ value: await riderOption.getAttribute('value') });
  const bookingCard = page.locator('li').filter({ hasText: 'Baby poney' }).first();
  await expect(bookingCard).toBeVisible();
  await bookingCard.getByRole('button', { name: 'Réserver' }).click();

  await page.goto('/app/planning');
  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();
  await expect(page.getByText('Baby poney')).toBeVisible();
});
