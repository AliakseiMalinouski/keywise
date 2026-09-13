import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheapSharkClient } from './cheapshark.client.js';
import { GgDealsClient } from './ggdeals.client.js';

describe('GgDealsClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list when the API key is missing', async () => {
    const findSteamAppId = vi.fn();
    const client = createClient({ apiKey: '', findSteamAppId });

    await expect(client.search('elden ring', { region: 'pl' })).resolves.toEqual([]);
    expect(findSteamAppId).not.toHaveBeenCalled();
  });

  it('returns an empty list when CheapShark has no Steam app id', async () => {
    const client = createClient({
      findSteamAppId: vi.fn(async () => null),
    });

    await expect(client.search('unknown game', { region: 'pl' })).resolves.toEqual(
      [],
    );
  });

  it('maps retail and keyshop lows for the resolved Steam app', async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get('ids')).toBe('1245620');
      expect(url.searchParams.get('key')).toBe('test-key');
      expect(url.searchParams.get('region')).toBe('pl');

      return jsonResponse({
        success: true,
        data: {
          '1245620': {
            title: 'ELDEN RING',
            url: 'https://gg.deals/game/elden-ring/',
            prices: {
              currentRetail: '249.00',
              currentKeyshops: '129.99',
              historicalRetail: '99.00',
              historicalKeyshops: '80.00',
              currency: 'PLN',
            },
          },
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = createClient({
      findSteamAppId: vi.fn(async () => '1245620'),
    });

    await expect(client.search('elden ring', { region: 'pl' })).resolves.toEqual([
      {
        source: 'GG.deals retail',
        title: 'ELDEN RING',
        url: 'https://gg.deals/game/elden-ring/',
        region: 'pl',
        price: { amount: 249, currency: 'PLN' },
      },
      {
        source: 'GG.deals keyshops',
        title: 'ELDEN RING',
        url: 'https://gg.deals/game/elden-ring/',
        region: 'pl',
        price: { amount: 129.99, currency: 'PLN' },
      },
    ]);
  });

  it('omits a side when GG.deals has no current price', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          success: true,
          data: {
            '1245620': {
              title: 'ELDEN RING',
              url: 'https://gg.deals/game/elden-ring/',
              prices: {
                currentRetail: '249.00',
                currentKeyshops: null,
                currency: 'PLN',
              },
            },
          },
        }),
      ),
    );

    const client = createClient({
      findSteamAppId: vi.fn(async () => '1245620'),
    });

    const offers = await client.search('elden ring', { region: 'us' });

    expect(offers).toEqual([
      {
        source: 'GG.deals retail',
        title: 'ELDEN RING',
        url: 'https://gg.deals/game/elden-ring/',
        region: 'us',
        price: { amount: 249, currency: 'PLN' },
      },
    ]);
  });
});

function createClient({
  apiKey = 'test-key',
  region = 'pl',
  findSteamAppId = async () => '1245620',
}: {
  apiKey?: string;
  region?: string;
  findSteamAppId?: () => Promise<string | null>;
} = {}): GgDealsClient {
  return new GgDealsClient(
    {
      get: (name: string) => {
        if (name === 'GGDEALS_API_KEY') {
          return apiKey;
        }

        if (name === 'GGDEALS_REGION') {
          return region;
        }

        return undefined;
      },
    } as ConfigService,
    { findSteamAppId } as unknown as CheapSharkClient,
  );
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
