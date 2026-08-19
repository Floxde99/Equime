import { expect, test } from '@playwright/test';

import { clickSidebarLink, loginAs } from './helpers.js';

test('un admin consulte le tableau de bord, une fiche cheval et les adhérents', async ({
  page,
}) => {
  await loginAs(page, {
    email: 'admin@equime.local',
    password: 'Equime!2026',
    landingHeading: "Vue d'ensemble",
  });

  await clickSidebarLink(page, 'Cavalerie');
  await expect(page.getByRole('heading', { name: 'Cavalerie & espaces' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Annuaire de la cavalerie' })).toBeVisible();

  const directory = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Annuaire de la cavalerie' }) });
  const firstHorse = directory.getByRole('link').first();
  await expect(firstHorse).toBeVisible({ timeout: 15_000 });
  const horseName = (await firstHorse.locator('span').first().textContent())?.trim();
  await firstHorse.click();

  await expect(page).toHaveURL(/\/admin\/cavalerie\/.+/);
  await expect(page.getByRole('link', { name: 'Retour à la cavalerie' })).toBeVisible();
  if (horseName) {
    await expect(page.getByRole('heading', { name: horseName, exact: true })).toBeVisible();
  }

  await clickSidebarLink(page, 'Clients');
  await expect(page.getByRole('heading', { name: 'Adhérents' })).toBeVisible();
});
