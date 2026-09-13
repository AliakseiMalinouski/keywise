import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import type { Offer } from '../../marketplaces/types.js';
import { SearchService } from './search.service.js';

const steamOffer: Offer = {
  source: 'Steam',
  title: 'ELDEN RING',
  url: 'https://www.cheapshark.com/redirect?dealID=abc',
  price: { amount: 59.99, currency: 'USD' },
};

const cachedResult = [{ source: 'cheapshark', data: [steamOffer] }];

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
    ]);
  });

  it('reuses the cached response for the same query within 5 minutes', async () => {
    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const service = await createService({ cheapsharkSearch });

    await service.search('Elden Ring');
    await service.search('elden ring');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(1);
  });

  it('shares one inflight request for the same query', async () => {
    let finish!: (value: Offer[]) => void;
    const cheapsharkSearch = vi.fn(
      () =>
        new Promise<Offer[]>((resolve) => {
          finish = resolve;
        }),
    );
    const service = await createService({ cheapsharkSearch });

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
    const service = await createService({ cheapsharkSearch });

    await service.search('elden ring');
    vi.setSystemTime(new Date('2026-09-13T18:05:01.000Z'));
    await service.search('elden ring');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(2);
  });
});

async function createService({
  cheapsharkSearch = async () => [steamOffer],
}: {
  cheapsharkSearch?: () => Promise<Offer[]>;
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
    ],
  }).compile();

  return module.get(SearchService);
}
