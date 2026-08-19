// @ts-check
/**
 * Client HTTP de l'application.
 *
 * Sécurité (voir docs/securite.md) :
 * - l'access token vit UNIQUEMENT en mémoire (jamais localStorage → un XSS
 *   ne peut pas l'exfiltrer d'un stockage persistant) ;
 * - le refresh token est un cookie httpOnly envoyé automatiquement,
 *   invisible depuis le JavaScript ;
 * - sur un 401 TOKEN_EXPIRED, un refresh silencieux « single-flight » est
 *   déclenché (une seule requête de refresh même si dix appels échouent en
 *   même temps), puis la requête initiale est rejouée une fois.
 */

const API_BASE = '/api/v1';

/** @type {string | null} Access token courant (mémoire uniquement) */
let accessToken = null;

/** @type {Promise<{ user: object, accessToken: string } | null> | null} */
let refreshInFlight = null;

/** @type {(() => void) | null} Callback branché par AuthProvider (session expirée) */
let onSessionExpired = null;

/** @param {string | null} token */
export function setAccessToken(token) {
  accessToken = token;
}

/** @returns {string | null} */
export function getAccessToken() {
  return accessToken;
}

/** @param {() => void} handler */
export function setOnSessionExpired(handler) {
  onSessionExpired = handler;
}

/** Erreur API structurée (miroir du format d'erreur de l'API Express). */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {{ code?: string, message?: string, details?: unknown }} body
   */
  constructor(status, body) {
    super(body.message ?? 'Erreur inattendue');
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code ?? 'UNKNOWN';
    this.details = body.details;
  }
}

/**
 * Appelle POST /auth/refresh et met à jour le token en mémoire.
 * Single-flight : React StrictMode (dev) monte AuthProvider deux fois ; deux
 * POST concurrents présenteraient le même refresh, et la rotation côté API
 * révoquerait toute la famille (détection de réutilisation).
 * @returns {Promise<{ user: object, accessToken: string } | null>} null si la session est morte
 */
export function refreshSession() {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** @returns {Promise<{ user: object, accessToken: string } | null>} */
async function performRefresh() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    setAccessToken(null);
    return null;
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data;
}

/** Refresh silencieux partagé entre appels concurrents (boolean pour le rejeu). */
function refreshOnce() {
  return refreshSession()
    .then((data) => data !== null)
    .catch(() => false);
}

/**
 * Requête API générique.
 * @param {string} path Chemin relatif à /api/v1 (ex. `/auth/login`)
 * @param {{ method?: string, body?: unknown, retry?: boolean }} [options]
 * @returns {Promise<any>} Corps JSON de la réponse (ou undefined si 204)
 * @throws {ApiError}
 */
export async function apiFetch(path, { method = 'GET', body, retry = true } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined;

  const data = await res.json().catch(() => ({}));

  if (res.ok) return data;

  // Access token expiré : refresh silencieux puis un unique rejeu
  if (res.status === 401 && data.error?.code === 'TOKEN_EXPIRED' && retry) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch(path, { method, body, retry: false });
    }
    onSessionExpired?.();
  }

  throw new ApiError(res.status, data.error ?? {});
}

/**
 * Télécharge une réponse binaire (export RGPD). Ne parse pas le JSON.
 * @param {string} path
 * @param {{ retry?: boolean }} [options]
 * @returns {Promise<Blob>}
 */
export async function apiFetchBlob(path, { retry = true } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  });

  if (res.status === 401) {
    const data = await res
      .clone()
      .json()
      .catch(() => ({}));
    if (data.error?.code === 'TOKEN_EXPIRED' && retry) {
      const refreshed = await refreshOnce();
      if (refreshed) return apiFetchBlob(path, { retry: false });
      onSessionExpired?.();
    }
    throw new ApiError(res.status, data.error ?? {});
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? {});
  }

  return res.blob();
}

export const api = {
  /** @param {string} path */
  get: (path) => apiFetch(path),
  /** @param {string} path @param {unknown} [body] */
  post: (path, body) => apiFetch(path, { method: 'POST', body }),
  /** @param {string} path @param {unknown} [body] */
  put: (path, body) => apiFetch(path, { method: 'PUT', body }),
  /** @param {string} path @param {unknown} [body] */
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
  /** @param {string} path @param {unknown} [body] */
  delete: (path, body) => apiFetch(path, { method: 'DELETE', body }),
  /**
   * @param {string} path
   * @param {FormData} formData
   */
  upload: (path, formData) => apiUpload(path, formData),
};

/**
 * @param {string} path
 * @param {FormData} formData
 * @param {boolean} [retry]
 */
async function apiUpload(path, formData, retry = true) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) return data;

  if (res.status === 401 && data.error?.code === 'TOKEN_EXPIRED' && retry) {
    const refreshed = await refreshOnce();
    if (refreshed) return apiUpload(path, formData, false);
    onSessionExpired?.();
  }

  throw new ApiError(res.status, data.error ?? {});
}
