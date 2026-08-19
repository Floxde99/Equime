import { expect, test } from '@playwright/test';

import { clickSidebarLink, loginAs, selectOptionByLabel } from './helpers.js';

test('un client peut ajouter un cavalier, réserver un cours et consulter le planning', async ({
  page,
}) => {
  const nonce = Date.now();

  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: /Bonjour, Lina/,
  });

  await clickSidebarLink(page, 'Famille');
  await expect(page.getByRole('heading', { name: 'Profils & affinités' })).toBeVisible();

  await page.getByLabel('Prénom').fill('Nina');
  await page.getByLabel('Nom', { exact: true }).fill(`E2E${nonce}`);
  await page.getByLabel('Date de naissance').fill('2016-05-14');
  await selectOptionByLabel(page, 'Niveau', 'Galop 1');
  await page.getByRole('button', { name: 'Ajouter' }).click();

  await expect(page.getByText(`Nina E2E${nonce}`)).toBeVisible();

  await clickSidebarLink(page, 'Réservations');
  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();

  await selectOptionByLabel(page, 'Cavalier', /Emma Moreau/);
  const bookingCard = page.locator('li').filter({ has: page.getByRole('button', { name: 'Réserver' }) }).first();
  await expect(bookingCard).toBeVisible();
  const courseTitle = (await bookingCard.locator('p').first().textContent())?.trim();
  await bookingCard.getByRole('button', { name: 'Réserver' }).click();

  await expect(page.getByRole('heading', { name: 'Planning' })).toBeVisible();
  if (courseTitle) {
    await expect(page.getByText(courseTitle).first()).toBeVisible();
  }
});
