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

[
  {
    path: '/mentions-legales',
    link: 'Mentions légales',
    title: 'Mentions légales',
    section: 'Hébergeur',
  },
  {
    path: '/confidentialite',
    link: 'Confidentialité',
    title: 'Politique de confidentialité',
    section: 'Cookies',
  },
  {
    path: '/cgv',
    link: 'Conditions générales de vente',
    title: 'Conditions générales de vente',
    section: '4. Droit de rétractation',
  },
].forEach(({ path, link, title, section }) => {
  test(`la page légale ${path} est accessible depuis le pied de page`, async ({ page }) => {
    await page.goto('/');
    const legalNav = page.getByRole('navigation', { name: 'Informations légales' });
    await legalNav.getByRole('link', { name: link, exact: true }).click();

    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  });
});

test('les CGV annoncent l’exception de rétractation des stages à date fixe', async ({ page }) => {
  await page.goto('/cgv');
  await expect(page.getByText(/article L221-28, 12°/)).toBeVisible();
});

test('une adresse inconnue affiche la page introuvable', async ({ page }) => {
  await page.goto('/page-introuvable-e2e');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  await expect(page.getByRole('link', { name: "Retour à l'accueil" })).toBeVisible();
});
