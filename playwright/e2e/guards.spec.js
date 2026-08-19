import { expect, test } from '@playwright/test';

import { loginAs } from './helpers.js';

test('un visiteur est redirigé vers la connexion depuis l’espace client', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

test('un client connecté ne peut pas rester sur l’espace administration', async ({ page }) => {
  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: /Bonjour, Lina/,
  });

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app\/?$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Bonjour, Lina/ })).toBeVisible();
});
