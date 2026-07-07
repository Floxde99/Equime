import { expect, test } from '@playwright/test';

import { loginAs } from './helpers.js';

test('un moniteur accède au planning et à l’appel de séance', async ({ page }) => {
  await loginAs(page, {
    email: 'coach@equime.local',
    password: 'Equime!2026',
    landingHeading: 'Mon planning',
  });

  await page.goto('/moniteur/planning');
  await expect(page.getByRole('heading', { name: 'Mon planning' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Filtre du planning' })).toBeVisible();
  await expect(page.getByText('Attribution des chevaux')).toBeVisible();

  await page.goto('/moniteur/appel');
  await expect(page.getByRole('heading', { name: 'Appel' })).toBeVisible();
  await expect(page.getByText('Choisir une séance')).toBeVisible();
});
