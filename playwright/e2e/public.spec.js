import { expect, test } from '@playwright/test';

test('un visiteur voit la vitrine, la navigation et peut s’inscrire à la newsletter', async ({
  page,
}) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('link', { name: 'Accueil', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Formules', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Cours', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Connexion', exact: true })).toHaveAttribute(
    'href',
    '/login'
  );

  const email = `e2e-nl-${Date.now()}@equime.local`;
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: "S'inscrire à la newsletter" }).click();
  await expect(page.getByText('Inscription enregistrée. Vérifiez votre boîte mail.')).toBeVisible({
    timeout: 15_000,
  });
});

test('une adresse inconnue affiche la page introuvable', async ({ page }) => {
  await page.goto('/page-introuvable-e2e');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('link', { name: "Retour à l'accueil" })).toBeVisible();
});
