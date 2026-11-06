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

  it('falls back to the profile page when the API key is missing', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).toContain('steamcommunity.com/id/gaben');
      return textResponse('<steamID64>76561198012345678</steamID64>');
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient({ apiKey: '' });
    await expect(client.resolveSteamid({ vanity: 'gaben' })).resolves.toBe(
      '76561198012345678',
    );
  });

  it('falls back to the profile page when vanity API fails', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (String(url).includes('ResolveVanityURL')) {
        return jsonResponse({ response: { success: 42 } });
      }

      return textResponse('g_rgProfileData = {"steamid":"76561198012345678"}');
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    await expect(client.resolveSteamid({ vanity: 'gaben' })).resolves.toBe(
      '76561198012345678',
    );
  });

  it('returns null when vanity cannot be resolved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        if (String(url).includes('ResolveVanityURL')) {
          return jsonResponse({ response: { success: 42 } });
        }

        return textResponse('no steamid here');
      }),
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

  it('loads Steam rating by searching the store and fetching reviews', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (String(url).includes('/api/storesearch/')) {
        expect(url.searchParams.get('term')).toBe('elden ring');
        return jsonResponse({
          items: [
            { type: 'app', name: 'ELDEN RING NIGHTREIGN', id: 2622380 },
            { type: 'app', name: 'ELDEN RING', id: 1245620 },
          ],
        });
      }

      if (url.pathname.includes('GetAppReviews')) {
        const input = JSON.parse(url.searchParams.get('input_json') ?? '{}');
        expect(input).toEqual({
          appid: 1245620,
          cursor: '*',
          filter: 'Recent',
          languages: ['all'],
          num_per_page: 10,
        });
        expect(url.searchParams.get('key')).toBe('steam-key');

        return jsonResponse({
          response: {
            query_summary: {
              review_score: 8,
              review_score_desc: 'Very Positive',
              total_positive: 100,
              total_negative: 10,
              total_reviews: 110,
            },
            reviews: [
              {
                recommendationid: '42',
                language: 'english',
                review: 'Amazing',
                voted_up: true,
                timestamp_created: 1_700_000_000,
                votes_up: 5,
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();

    await expect(client.getGameRating('elden ring')).resolves.toEqual({
      appid: 1245620,
      title: 'ELDEN RING',
      score: 8,
      scoreDescription: 'Very Positive',
      totalPositive: 100,
      totalNegative: 10,
      totalReviews: 110,
      reviews: [
        {
          recommendationId: '42',
          language: 'english',
          text: 'Amazing',
          votedUp: true,
          timestamp: 1_700_000_000,
          votesUp: 5,
        },
      ],
    });
  });

  it('returns a store tiny_image or the CDN header for getGameImage', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (String(url).includes('/api/storesearch/')) {
        return jsonResponse({
          items: [
            {
              type: 'app',
              name: 'ELDEN RING',
              id: 1245620,
              tiny_image: 'https://cdn.example/231x87.jpg',
            },
          ],
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();

    await expect(client.getGameImage('elden ring')).resolves.toBe(
      'https://cdn.example/231x87.jpg',
    );
  });

  it('falls back to the CDN header when store search has no tiny_image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        if (String(url).includes('/api/storesearch/')) {
          return jsonResponse({
            items: [{ type: 'app', name: 'ELDEN RING', id: 1245620 }],
          });
        }

        throw new Error(`Unexpected URL ${url}`);
      }),
    );

    const client = createClient();

    await expect(client.getGameImage('elden ring')).resolves.toBe(
      'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
    );
  });

  it('returns undefined for getGameImage when the game is not found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ items: [] })),
    );

    const client = createClient();

    await expect(client.getGameImage('missing game')).resolves.toBeUndefined();
  });

  it('passes reviewLang filters to GetAppReviews', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (String(url).includes('/api/storesearch/')) {
        return jsonResponse({
          items: [{ type: 'app', name: 'ELDEN RING', id: 1245620 }],
        });
      }

      if (url.pathname.includes('GetAppReviews')) {
        const input = JSON.parse(url.searchParams.get('input_json') ?? '{}');
        expect(input.languages).toEqual(['russian', 'polish']);

        return jsonResponse({
          response: {
            query_summary: {
              review_score: 8,
              review_score_desc: 'Very Positive',
              total_positive: 1,
              total_negative: 0,
              total_reviews: 1,
            },
            reviews: [],
          },
        });
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    await client.getGameRating('elden ring', ['russian', 'polish']);

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('GetAppReviews'),
      ),
    ).toHaveLength(1);
  });

  it('reuses the cached Steam rating for the same query', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (String(url).includes('/api/storesearch/')) {
        return jsonResponse({
          items: [{ type: 'app', name: 'ELDEN RING', id: 1245620 }],
        });
      }

      return jsonResponse({
        response: {
          query_summary: {
            review_score: 8,
            review_score_desc: 'Very Positive',
            total_positive: 1,
            total_negative: 0,
            total_reviews: 1,
          },
          reviews: [],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();
    await client.getGameRating('elden ring');
    await client.getGameRating('Elden Ring');

    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/storesearch/'),
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('GetAppReviews'),
      ),
    ).toHaveLength(1);
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

function textResponse(body: string): Response {
  return {
    ok: true,
    text: async () => body,
  } as Response;
}
