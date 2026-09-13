import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItadClient } from './itad.client.js';

describe('ItadClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list when the API key is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createClient('');

    await expect(client.search('elden ring', { region: 'pl' })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches by title and maps shop deals', async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      if (url.pathname.endsWith('/games/search/v1')) {
        expect(url.searchParams.get('title')).toBe('elden ring');
        expect(url.searchParams.get('key')).toBe('test-key');

        return jsonResponse([
          {
            id: 'dlc-id',
            slug: 'elden-ring-dlc',
            title: 'ELDEN RING Shadow of the Erdtree',
            type: 'dlc',
          },
          {
            id: 'game-id',
            slug: 'elden-ring',
            title: 'ELDEN RING',
            type: 'game',
          },
        ]);
      }

      if (url.pathname.endsWith('/games/prices/v3')) {
        expect(url.searchParams.get('country')).toBe('PL');
        expect(url.searchParams.get('key')).toBe('test-key');
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify(['game-id']));

        return jsonResponse([
          {
            id: 'game-id',
            deals: [
              {
                shop: { name: 'Steam' },
                price: { amount: 249, currency: 'PLN' },
                url: 'https://isthereanydeal.com/link/steam',
              },
              {
                shop: { name: 'GOG' },
                price: { amount: 199.99, currency: 'PLN' },
                url: 'https://isthereanydeal.com/link/gog',
              },
            ],
          },
        ]);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = createClient();

    await expect(client.search('elden ring', { region: 'pl' })).resolves.toEqual([
      {
        source: 'GOG',
        title: 'ELDEN RING',
        url: 'https://isthereanydeal.com/link/gog',
        region: 'pl',
        price: { amount: 199.99, currency: 'PLN' },
      },
      {
        source: 'Steam',
        title: 'ELDEN RING',
        url: 'https://isthereanydeal.com/link/steam',
        region: 'pl',
        price: { amount: 249, currency: 'PLN' },
      },
    ]);
  });

  it('maps eu to an ISO country for ITAD', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith('/games/search/v1')) {
        return jsonResponse([
          { id: 'game-id', slug: 'elden-ring', title: 'ELDEN RING', type: 'game' },
        ]);
      }

      expect(url.searchParams.get('country')).toBe('DE');
      return jsonResponse([{ id: 'game-id', deals: [] }]);
    });

    vi.stubGlobal('fetch', fetchMock);

    await createClient().search('elden ring', { region: 'eu' });
  });
});

function createClient(apiKey = 'test-key'): ItadClient {
  return new ItadClient({
    get: (name: string) => {
      if (name === 'IS_THERE_ANY_DEAL_API_KEY') {
        return apiKey;
      }

      return undefined;
    },
  } as ConfigService);
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
