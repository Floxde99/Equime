import { expect } from '@playwright/test';

/**
 * Ouvre la page de login puis authentifie un utilisateur seedé.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, landingHeading: string }} user
 */
export async function loginAs(page, user) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mot de passe').fill(user.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: user.landingHeading })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Sélectionne la première option dont le label matche.
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} scope
 * @param {string} label
 * @param {RegExp | string} optionName
 */
export async function selectOptionByLabel(scope, label, optionName) {
  const select = scope.getByLabel(label);
  const options = await select.locator('option').allTextContents();
  const match = options.find((text) =>
    typeof optionName === 'string' ? text === optionName : optionName.test(text)
  );
  if (!match) {
    throw new Error(`Option introuvable pour ${label}`);
  }
  await select.selectOption({ label: match });
}

/**
 * Sélectionne la dernière option non vide d'une liste.
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} scope
 * @param {string} label
 */
export async function selectLastNonEmptyOption(scope, label) {
  const select = scope.getByLabel(label);
  const options = await select.locator('option').evaluateAll((nodes) =>
    nodes
      .map((node) => ({ value: node.value, label: node.textContent?.trim() ?? '' }))
      .filter((option) => option.value)
  );
  const last = options.at(-1);
  if (!last) {
    throw new Error(`Aucune option disponible pour ${label}`);
  }
  await select.selectOption(last.value);
}
