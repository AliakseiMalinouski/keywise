import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import { GgDealsClient } from '../../marketplaces/clients/ggdeals.client.js';
import type { Offer } from '../../marketplaces/types.js';
import { SearchService } from './search.service.js';

const steamOffer: Offer = {
  source: 'Steam',
  title: 'ELDEN RING',
  url: 'https://www.cheapshark.com/redirect?dealID=abc',
  price: { amount: 59.99, currency: 'USD' },
};

const ggDealsOffer: Offer = {
  source: 'GG.deals keyshops',
  title: 'ELDEN RING',
  url: 'https://gg.deals/game/elden-ring/',
  region: 'pl',
  price: { amount: 129.99, currency: 'PLN' },
};

const cachedResult = [
  { source: 'cheapshark', data: [steamOffer] },
  { source: 'gg.deals', data: [ggDealsOffer] },
];

describe('SearchService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a result per source', async () => {
    const service = await createService();

    await expect(service.search('elden ring')).resolves.toEqual(cachedResult);
  });

  it('keeps a source with empty data when it fails', async () => {
    const service = await createService({
      cheapsharkSearch: async () => {
        throw new Error('network');
      },
    });

    await expect(service.search('elden ring')).resolves.toEqual([
      { source: 'cheapshark', data: [] },
      { source: 'gg.deals', data: [ggDealsOffer] },
    ]);
  });

  it('reuses the cached response for the same query within 5 minutes', async () => {
    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const ggdealsSearch = vi.fn(async () => [ggDealsOffer]);
    const service = await createService({ cheapsharkSearch, ggdealsSearch });

    await service.search('Elden Ring');
    await service.search('elden ring');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(1);
    expect(ggdealsSearch).toHaveBeenCalledTimes(1);
  });

  it('shares one inflight request for the same query', async () => {
    let finish!: (value: Offer[]) => void;
    const cheapsharkSearch = vi.fn(
      () =>
        new Promise<Offer[]>((resolve) => {
          finish = resolve;
        }),
    );
    const ggdealsSearch = vi.fn(async () => [ggDealsOffer]);
    const service = await createService({ cheapsharkSearch, ggdealsSearch });

    const first = service.search('elden ring');
    const second = service.search('elden ring');

    finish([steamOffer]);
    await expect(Promise.all([first, second])).resolves.toEqual([
      cachedResult,
      cachedResult,
    ]);
    expect(cheapsharkSearch).toHaveBeenCalledTimes(1);
  });

  it('refetches after the cache expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T18:00:00.000Z'));

    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const ggdealsSearch = vi.fn(async () => [ggDealsOffer]);
    const service = await createService({ cheapsharkSearch, ggdealsSearch });

    await service.search('elden ring');
    vi.setSystemTime(new Date('2026-09-13T18:05:01.000Z'));
    await service.search('elden ring');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(2);
    expect(ggdealsSearch).toHaveBeenCalledTimes(2);
  });
});

async function createService({
  cheapsharkSearch = async () => [steamOffer],
  ggdealsSearch = async () => [ggDealsOffer],
}: {
  cheapsharkSearch?: () => Promise<Offer[]>;
  ggdealsSearch?: () => Promise<Offer[]>;
} = {}): Promise<SearchService> {
  const module = await Test.createTestingModule({
    providers: [
      SearchService,
      {
        provide: CheapSharkClient,
        useValue: {
          source: 'cheapshark',
          search: cheapsharkSearch,
        },
      },
      {
        provide: GgDealsClient,
        useValue: {
          source: 'gg.deals',
          search: ggdealsSearch,
        },
      },
    ],
  }).compile();

  return module.get(SearchService);
}
