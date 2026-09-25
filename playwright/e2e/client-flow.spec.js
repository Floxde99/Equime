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

  // Emma (forfait Classique, 2 séances par semaine) : la 2e séance de la semaine est
  // proposée sur le forfait, avec confirmation avant réservation (ADR 011).
  await selectOptionByLabel(page, 'Cavalier', /Emma Moreau/);
  const bookingCard = page
    .locator('li')
    .filter({ hasText: 'Séance du forfait' })
    .filter({ has: page.getByRole('button', { name: /^Réserver/ }) })
    .first();
  await expect(bookingCard).toBeVisible();
  const courseTitle = (await bookingCard.locator('p').first().textContent())?.trim();
  await bookingCard.getByRole('button', { name: /^Réserver/ }).click();

  const confirm = page.getByRole('dialog', { name: 'Confirmer la réservation' });
  await expect(confirm.getByText(/séance du forfait de la semaine/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Confirmer la réservation' }).click();

  await expect(page.getByText(/Emma est inscrit\(e\) au cours/)).toBeVisible();
  if (courseTitle) {
    await expect(page.getByText(courseTitle).first()).toBeVisible();
  }
});
