import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiFetch,
  apiFetchBlob,
  getAccessToken,
  refreshSession,
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

  it('clear la session sur un 401 générique (ban, blacklist…)', async () => {
    setAccessToken('still-there');
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'banni' } }), {
            status: 401,
          })
      )
    );

    await expect(apiFetch('/secure')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('clear la session si le refresh échoue après TOKEN_EXPIRED', async () => {
    setAccessToken('expired');
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'expiré' } }), {
          status: 401,
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
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

describe('refreshSession', () => {
  it('ne lance qu’un seul POST /auth/refresh pour des appels concurrents', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ accessToken: 'fresh', user: { id: '1' } }), {
                status: 200,
              })
            );
          }, 20);
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(getAccessToken()).toBe('fresh');
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

  it('clear la session sur un 401 générique', async () => {
    setAccessToken('still-there');
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'banni' } }), {
            status: 401,
          })
      )
    );

    await expect(apiFetchBlob('/auth/me/export')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
    expect(getAccessToken()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('rafraîchit puis rejoue sur TOKEN_EXPIRED', async () => {
    setAccessToken('expired');
    const blobBody = new Blob(['export'], { type: 'application/zip' });
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
      .mockResolvedValueOnce(new Response(blobBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const blob = await apiFetchBlob('/auth/me/export');
    expect(blob).toBeInstanceOf(Blob);
    expect(getAccessToken()).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
