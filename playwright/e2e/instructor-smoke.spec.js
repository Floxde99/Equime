import { expect, test } from '@playwright/test';

import { clickSidebarLink, loginAs } from './helpers.js';

test('un moniteur consulte le carnet de santé et les incidents', async ({ page }) => {
  await loginAs(page, {
    email: 'coach@equime.local',
    password: 'Equime!2026',
    landingHeading: /Bonjour, Julien/,
  });

  await clickSidebarLink(page, 'Santé');
  await expect(page.getByRole('heading', { name: 'Carnet de santé' })).toBeVisible();
  await expect(page.getByLabel('Rechercher un cheval')).toBeVisible({ timeout: 15_000 });

  await clickSidebarLink(page, 'Incidents');
  await expect(page.getByRole('heading', { name: 'Déclarer un incident' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nouvelle déclaration' })).toBeVisible();
});
