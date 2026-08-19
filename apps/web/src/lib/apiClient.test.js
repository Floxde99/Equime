import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiFetch,
  apiFetchBlob,
  getAccessToken,
  setAccessToken,
  setOnSessionExpired,
} from './apiClient.js';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
  setOnSessionExpired(null);
});

describe('apiFetch', () => {
  it('renvoie le JSON en cas de succès', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
    await expect(apiFetch('/ping')).resolves.toEqual({ ok: true });
  });

  it('rafraîchit puis rejoue sur TOKEN_EXPIRED', async () => {
    setAccessToken('expired');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'expiré' } }), {
          status: 401,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh', user: { id: '1' } }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/secure')).resolves.toEqual({ ok: true });
    expect(getAccessToken()).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('lève ApiError sur un 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'invalide' } }), {
            status: 400,
          })
      )
    );
    await expect(apiFetch('/bad')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiFetchBlob', () => {
  it('retourne un Blob sans parser le JSON', async () => {
    const payload = new Blob(['{"hello":true}'], { type: 'application/json' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(payload, { status: 200 }))
    );
    const blob = await apiFetchBlob('/auth/me/export');
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe('{"hello":true}');
  });
});
