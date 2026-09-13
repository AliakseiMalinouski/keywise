import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheapSharkClient } from './cheapshark.client.js';

describe('CheapSharkClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('picks the closest title and maps store deals', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('games?title=')) {
        return jsonResponse([
          {
            gameID: '2',
            cheapest: '10',
            cheapestDealID: 'night',
            external: 'ELDEN RING NIGHTREIGN',
          },
          {
            gameID: '1',
            cheapest: '50',
            cheapestDealID: 'base',
            external: 'ELDEN RING',
          },
        ]);
      }

      if (url.includes('games?id=1')) {
        return jsonResponse({
          info: { title: 'ELDEN RING' },
          deals: [
            {
              storeID: '1',
              dealID: 'steam-deal',
              price: '59.99',
              retailPrice: '59.99',
            },
            {
              storeID: '15',
              dealID: 'fanatical-deal',
              price: '44.99',
              retailPrice: '59.99',
            },
          ],
        });
      }

      if (url.includes('/stores')) {
        return jsonResponse([
          { storeID: '1', storeName: 'Steam', isActive: 1 },
          { storeID: '15', storeName: 'Fanatical', isActive: 1 },
        ]);
      }

      throw new Error(`Unexpected URL ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = new CheapSharkClient();
    const offers = await client.search('elden ring');

    expect(offers.map((offer) => offer.source)).toEqual(['Fanatical', 'Steam']);
    expect(offers[0]).toEqual({
      source: 'Fanatical',
      title: 'ELDEN RING',
      url: 'https://www.cheapshark.com/redirect?dealID=fanatical-deal',
      price: { amount: 44.99, currency: 'USD' },
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
