import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SteamClient } from './steam.client.js';

describe('SteamClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a SteamID64 identity as-is', async () => {
    const client = createClient();

    await expect(
      client.resolveSteamid({ steamid: '76561198012345678' }),
    ).resolves.toBe('76561198012345678');
  });

  it('resolves a vanity name when the API key is set', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe('/ISteamUser/ResolveVanityURL/v1/');
      expect(url.searchParams.get('key')).toBe('steam-key');
      expect(url.searchParams.get('vanityurl')).toBe('gaben');

      return jsonResponse({
        response: { success: 1, steamid: '76561198012345678' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();

    await expect(client.resolveSteamid({ vanity: 'gaben' })).resolves.toBe(
      '76561198012345678',
    );
    await expect(client.resolveSteamid({ vanity: 'gaben' })).resolves.toBe(
      '76561198012345678',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when vanity lookup fails or the key is missing', async () => {
    const withoutKey = createClient({ apiKey: '' });
    await expect(
      withoutKey.resolveSteamid({ vanity: 'gaben' }),
    ).resolves.toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ response: { success: 42 } })),
    );
    const client = createClient();
    await expect(client.resolveSteamid({ vanity: 'missing' })).resolves.toBeNull();
  });

  it('loads wishlist app ids and titles', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.includes('GetWishlist')) {
        expect(url.searchParams.get('steamid')).toBe('76561198012345678');
        return jsonResponse({
          response: {
            items: [{ appid: 1245620 }, { appid: 570 }],
          },
        });
      }

      if (url.pathname.includes('GetItems')) {
        return jsonResponse({
          response: {
            store_items: [
              { appid: 1245620, name: 'ELDEN RING' },
              { appid: 570, name: 'Dota 2' },
            ],
          },
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();

    await expect(client.getWishlist('76561198012345678')).resolves.toEqual([
      { appid: 1245620, title: 'ELDEN RING' },
      { appid: 570, title: 'Dota 2' },
    ]);
  });

  it('reuses the cached wishlist for the same steamid', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.includes('GetWishlist')) {
        return jsonResponse({
          response: { items: [{ appid: 570 }] },
        });
      }

      return jsonResponse({
        response: { store_items: [{ appid: 570, name: 'Dota 2' }] },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    await client.getWishlist('76561198012345678');
    await client.getWishlist('76561198012345678');

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('GetWishlist'),
      ),
    ).toHaveLength(1);
  });

  it('reuses cached titles across wishlists', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.includes('GetWishlist')) {
        return jsonResponse({
          response: { items: [{ appid: 570 }] },
        });
      }

      if (url.pathname.includes('GetItems')) {
        return jsonResponse({
          response: { store_items: [{ appid: 570, name: 'Dota 2' }] },
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    await client.getWishlist('76561198012345678');
    await client.getWishlist('76561198000000000');

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('GetItems')),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('GetWishlist'),
      ),
    ).toHaveLength(2);
  });

  it('fetches title batches in parallel', async () => {
    const appids = Array.from({ length: 101 }, (_, index) => index + 1);
    let releaseFirst!: () => void;
    const firstBatch = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let itemsCalls = 0;

    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.includes('GetWishlist')) {
        return jsonResponse({
          response: { items: appids.map((appid) => ({ appid })) },
        });
      }

      if (url.pathname.includes('GetItems')) {
        itemsCalls += 1;
        if (itemsCalls === 1) {
          await firstBatch;
        }

        return jsonResponse({
          response: {
            store_items: appids.slice(0, 1).map((appid) => ({
              appid,
              name: `Game ${appid}`,
            })),
          },
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    const pending = client.getWishlist('76561198012345678');
    await vi.waitFor(() => expect(itemsCalls).toBe(2));
    releaseFirst();
    await pending;
  });
});

function createClient({ apiKey = 'steam-key' }: { apiKey?: string } = {}) {
  return new SteamClient({
    get: (name: string) => (name === 'STEAM_API_KEY' ? apiKey : undefined),
  } as ConfigService);
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
