import { expect, test } from '@playwright/test';

import { clickSidebarLink, loginAs, selectOptionByLabel } from './helpers.js';

test('un client peut consulter les stages et inscrire Emma au stage vacances', async ({ page }) => {
  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: /Bonjour, Lina/,
  });

  await clickSidebarLink(page, 'Événements');
  await expect(page.getByRole('heading', { name: 'Inscriptions aux stages' })).toBeVisible();

  const stageHeading = page.getByRole('heading', { name: /Stage vacances/ });
  await expect(stageHeading).toBeVisible();

  const stageCard = page
    .locator('div')
    .filter({ has: stageHeading })
    .filter({ has: page.getByRole('button', { name: 'Inscrire' }) })
    .last();

  await selectOptionByLabel(stageCard, 'Cavalier', /Emma Moreau/);
  await stageCard.getByRole('button', { name: 'Inscrire' }).click();
  await expect(page.getByText(/Inscription confirmée|déjà inscrit/i)).toBeVisible({
    timeout: 15_000,
  });
});

test('un client parcourt messages, bénévolat, compte et notifications', async ({ page }) => {
  await loginAs(page, {
    email: 'lina@equime.local',
    password: 'Equime!2026',
    landingHeading: /Bonjour, Lina/,
  });

  await clickSidebarLink(page, 'Messages');
  await expect(page.getByRole('heading', { name: 'Messagerie' })).toBeVisible();

  await clickSidebarLink(page, 'Bénévolat');
  await expect(page.getByRole('heading', { name: 'Espace bénévole' })).toBeVisible();

  await clickSidebarLink(page, 'Mon compte');
  await expect(page.getByRole('heading', { name: 'Mon compte', exact: true })).toBeVisible();

  await clickSidebarLink(page, 'Notifications');
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
});
