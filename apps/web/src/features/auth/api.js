// @ts-check
/**
 * Appels API du module auth. Chaque fonction synchronise le token mémoire
 * et laisse l'appelant mettre à jour le store.
 */
import { api, setAccessToken } from '@/lib/apiClient.js';

/** @param {{ email: string, password: string, firstName: string, lastName: string, phone?: string }} input */
export async function register(input) {
  const data = await api.post('/auth/register', input);
  setAccessToken(data.accessToken);
  return data.user;
}

/** @param {{ email: string, password: string }} input */
export async function login(input) {
  const data = await api.post('/auth/login', input);
  setAccessToken(data.accessToken);
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

/** @param {string} email */
export function forgotPassword(email) {
  return api.post('/auth/forgot-password', { email });
}

/** @param {{ token: string, password: string }} input */
export function resetPassword(input) {
  return api.post('/auth/reset-password', input);
}

/** @param {{ confirmation: string }} input */
export async function deleteAccount(input) {
  await api.delete('/auth/me', input);
  setAccessToken(null);
}
