import { expect, test } from '@playwright/test';

test('un visiteur peut créer un compte client puis se déconnecter', async ({ page }) => {
  const nonce = Date.now();

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();

  await page.getByLabel('Prénom').fill('E2E');
  await page.getByLabel('Nom', { exact: true }).fill(`Auth${nonce}`);
  await page.getByLabel('Email').fill(`e2e-auth-${nonce}@equime.local`);
  await page.getByLabel('Téléphone (facultatif)').fill('0601020304');
  await page.getByLabel('Mot de passe').fill('Equime!2026Dev');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByRole('heading', { name: /Bonjour, E2E/i })).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});
