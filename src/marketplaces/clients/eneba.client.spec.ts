import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BrowserService } from '../browser.service.js';
import type { Offer } from '../types.js';
import { extractOffersFromDom } from '../utils/dom-offers.js';
import { waitForJson } from '../utils/wait-for-json.js';
import { EnebaClient } from './eneba.client.js';

vi.mock('../utils/wait-for-json.js', () => ({
  waitForJson: vi.fn(),
}));

vi.mock('../utils/dom-offers.js', () => ({
  extractOffersFromDom: vi.fn(),
}));

const waitForJsonMock = vi.mocked(waitForJson);
const extractOffersFromDomMock = vi.mocked(extractOffersFromDom);

describe('EnebaClient', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('maps Algolia hits to offers and keeps the cheapest matching titles', async () => {
    waitForJsonMock.mockResolvedValue([
      {
        slug: 'steam-elden-ring-pc-steam-key-europe',
        productRegions: ['europe'],
        translations: { en_US: { name: 'Elden Ring (PC) Steam Key EUROPE' } },
        lowestPrice: { EUR: 4467, PLN: 19315 },
      },
      {
        slug: 'xbox-cyberpunk-2077',
        translations: { en_US: { name: 'Cyberpunk 2077 Xbox Key' } },
        lowestPrice: { EUR: 100 },
      },
      {
        slug: 'steam-elden-ring-steam-key-global',
        productRegions: ['global'],
        translations: { en_US: { name: 'Elden Ring Steam Key GLOBAL' } },
        lowestPrice: { EUR: 3999 },
      },
    ]);

    const { client, page } = createClient();
    const offers = await client.search('elden ring');

    expect(page.goto).toHaveBeenCalledWith(
      'https://www.eneba.com/store/all?text=elden%20ring',
      { waitUntil: 'domcontentloaded', timeout: 30000 },
    );
    expect(extractOffersFromDomMock).not.toHaveBeenCalled();
    expect(offers).toEqual([
      {
        source: 'eneba',
        title: 'Elden Ring Steam Key GLOBAL',
        url: 'https://www.eneba.com/steam-elden-ring-steam-key-global',
        region: 'global',
        price: { amount: 39.99, currency: 'EUR' },
      },
      {
        source: 'eneba',
        title: 'Elden Ring (PC) Steam Key EUROPE',
        url: 'https://www.eneba.com/steam-elden-ring-pc-steam-key-europe',
        region: 'europe',
        price: { amount: 44.67, currency: 'EUR' },
      },
    ]);
  });

  it('uses PLN when EUR is missing and skips incomplete hits', async () => {
    waitForJsonMock.mockResolvedValue([
      {
        slug: 'steam-elden-ring-pln',
        productRegions: ['europe'],
        translations: { en_US: { name: 'Elden Ring PLN' } },
        lowestPrice: { PLN: 19315 },
      },
      {
        translations: { en_US: { name: 'Elden Ring no slug' } },
        lowestPrice: { EUR: 1000 },
      },
      {
        slug: 'steam-elden-ring-no-price',
        translations: { en_US: { name: 'Elden Ring no price' } },
        lowestPrice: {},
      },
    ]);

    const { client } = createClient();
    const offers = await client.search('elden ring');

    expect(offers).toEqual([
      {
        source: 'eneba',
        title: 'Elden Ring PLN',
        url: 'https://www.eneba.com/steam-elden-ring-pln',
        region: 'europe',
        price: { amount: 193.15, currency: 'PLN' },
      },
    ]);
  });

  it('falls back to the DOM when Algolia returns no hits', async () => {
    const domOffers: Offer[] = [
      {
        source: 'eneba',
        title: 'Elden Ring Steam Key',
        url: 'https://www.eneba.com/steam-elden-ring',
        price: { amount: 40, currency: 'EUR' },
      },
    ];
    waitForJsonMock.mockResolvedValue(null);
    extractOffersFromDomMock.mockResolvedValue(domOffers);

    const { client, page } = createClient();
    const offers = await client.search('elden ring');

    expect(extractOffersFromDomMock).toHaveBeenCalledWith(
      page,
      'eneba',
      'elden ring',
    );
    expect(offers).toEqual(domOffers);
  });

  it('returns an empty list when the browser fails', async () => {
    const { client } = createClient({
      withPage: async () => {
        throw new Error('browser down');
      },
    });

    await expect(client.search('elden ring')).resolves.toEqual([]);
    expect(waitForJsonMock).not.toHaveBeenCalled();
  });
});

function createClient(
  browser: Partial<BrowserService> = {},
): {
  client: EnebaClient;
  page: { goto: ReturnType<typeof vi.fn> };
} {
  const page = { goto: vi.fn() };
  const client = new EnebaClient({
    withPage: async (run: (value: typeof page) => Promise<unknown>) =>
      run(page),
    ...browser,
  } as BrowserService);

  return { client, page };
}
