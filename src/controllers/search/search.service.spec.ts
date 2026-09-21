import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import { GgDealsClient } from '../../marketplaces/clients/ggdeals.client.js';
import { ItadClient } from '../../marketplaces/clients/itad.client.js';
import type { Offer, SearchResponse } from '../../marketplaces/types.js';
import { SteamClient } from '../../steam/index.js';
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

const itadOffer: Offer = {
  source: 'GOG',
  title: 'ELDEN RING',
  url: 'https://isthereanydeal.com/link/gog',
  region: 'pl',
  price: { amount: 199.99, currency: 'PLN' },
};

const sourceResult = [
  { source: 'cheapshark', data: [steamOffer] },
  { source: 'gg.deals', data: [ggDealsOffer] },
  { source: 'itad', data: [itadOffer] },
];

const cachedResult: SearchResponse = {
  result: sourceResult,
  best: {
    ...ggDealsOffer,
    marketplace: 'gg.deals',
  },
};

describe('SearchService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sources and the cheapest regional offer', async () => {
    const service = await createService();

    await expect(service.search('elden ring', 'pl')).resolves.toEqual(cachedResult);
  });

  it('keeps a source with empty data when it fails', async () => {
    const service = await createService({
      cheapsharkSearch: async () => {
        throw new Error('network');
      },
    });

    await expect(service.search('elden ring', 'pl')).resolves.toEqual({
      result: [
        { source: 'cheapshark', data: [] },
        { source: 'gg.deals', data: [ggDealsOffer] },
        { source: 'itad', data: [itadOffer] },
      ],
      best: {
        ...ggDealsOffer,
        marketplace: 'gg.deals',
      },
    });
  });

  it('reuses the cached response for the same query within 5 minutes', async () => {
    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const ggdealsSearch = vi.fn(async () => [ggDealsOffer]);
    const itadSearch = vi.fn(async () => [itadOffer]);
    const service = await createService({
      cheapsharkSearch,
      ggdealsSearch,
      itadSearch,
    });

    await service.search('Elden Ring', 'pl');
    await service.search('elden ring', 'pl');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(1);
    expect(ggdealsSearch).toHaveBeenCalledTimes(1);
    expect(itadSearch).toHaveBeenCalledTimes(1);
    expect(ggdealsSearch).toHaveBeenCalledWith('Elden Ring', { region: 'pl' });
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
    const itadSearch = vi.fn(async () => [itadOffer]);
    const service = await createService({
      cheapsharkSearch,
      ggdealsSearch,
      itadSearch,
    });

    const first = service.search('elden ring', 'pl');
    const second = service.search('elden ring', 'pl');

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
    const itadSearch = vi.fn(async () => [itadOffer]);
    const service = await createService({
      cheapsharkSearch,
      ggdealsSearch,
      itadSearch,
    });

    await service.search('elden ring', 'pl');
    vi.setSystemTime(new Date('2026-09-13T18:05:01.000Z'));
    await service.search('elden ring', 'pl');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(2);
    expect(ggdealsSearch).toHaveBeenCalledTimes(2);
    expect(itadSearch).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cache for the same query in another region', async () => {
    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const ggdealsSearch = vi.fn(async () => [ggDealsOffer]);
    const itadSearch = vi.fn(async () => [itadOffer]);
    const service = await createService({
      cheapsharkSearch,
      ggdealsSearch,
      itadSearch,
    });

    await service.search('elden ring', 'pl');
    await service.search('elden ring', 'us');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(2);
    expect(ggdealsSearch).toHaveBeenCalledWith('elden ring', { region: 'us' });
  });

  it('marks the searched game as selected when it is on the Steam wishlist', async () => {
    const getWishlist = vi.fn(async () => [
      { appid: 1245620, title: 'ELDEN RING' },
      { appid: 570, title: 'Dota 2' },
    ]);
    const service = await createService({ getWishlist });

    await expect(
      service.search('elden ring', 'pl', '76561198012345678'),
    ).resolves.toEqual({
      ...cachedResult,
      wishlist: [
        { appid: 1245620, title: 'ELDEN RING', selected: true },
        { appid: 570, title: 'Dota 2', selected: false },
      ],
    });
    expect(getWishlist).toHaveBeenCalledWith('76561198012345678');
  });

  it('resolves a profile URL before loading the wishlist', async () => {
    const resolveSteamid = vi.fn(async () => '76561198012345678');
    const getWishlist = vi.fn(async () => [
      { appid: 570, title: 'Dota 2' },
    ]);
    const service = await createService({ resolveSteamid, getWishlist });

    const response = await service.search(
      'elden ring',
      'pl',
      'https://steamcommunity.com/id/gaben',
    );

    expect(resolveSteamid).toHaveBeenCalledWith({ vanity: 'gaben' });
    expect(response.wishlist).toEqual([
      { appid: 570, title: 'Dota 2', selected: false },
    ]);
  });

  it('returns an empty wishlist when steam is invalid', async () => {
    const service = await createService();

    await expect(
      service.search('elden ring', 'pl', 'not-a-steam-profile'),
    ).resolves.toEqual({
      ...cachedResult,
      wishlist: [],
    });
  });

  it('returns an empty wishlist when the steam profile cannot be resolved', async () => {
    const service = await createService({
      resolveSteamid: async () => null,
    });

    await expect(
      service.search('elden ring', 'pl', 'https://steamcommunity.com/id/missing'),
    ).resolves.toEqual({
      ...cachedResult,
      wishlist: [],
    });
  });

  it('keeps marketplace cache when steam profiles differ', async () => {
    const cheapsharkSearch = vi.fn(async () => [steamOffer]);
    const getWishlist = vi.fn(async (steamid: string) => [
      {
        appid: steamid === '76561198012345678' ? 1245620 : 570,
        title: steamid === '76561198012345678' ? 'ELDEN RING' : 'Dota 2',
      },
    ]);
    const service = await createService({ cheapsharkSearch, getWishlist });

    await service.search('elden ring', 'pl', '76561198012345678');
    await service.search('elden ring', 'pl', '76561198000000000');

    expect(cheapsharkSearch).toHaveBeenCalledTimes(1);
    expect(getWishlist).toHaveBeenCalledTimes(2);
  });

  it('returns an empty wishlist when Steam fails after a valid profile', async () => {
    const service = await createService({
      getWishlist: async () => {
        throw new Error('steam down');
      },
    });

    await expect(
      service.search('elden ring', 'pl', '76561198012345678'),
    ).resolves.toEqual({
      ...cachedResult,
      wishlist: [],
    });
  });
});

async function createService({
  cheapsharkSearch = async () => [steamOffer],
  findSteamAppId = async () => '1245620',
  ggdealsSearch = async () => [ggDealsOffer],
  itadSearch = async () => [itadOffer],
  resolveSteamid = async (identity: { steamid?: string }) =>
    identity.steamid ?? '76561198012345678',
  getWishlist = async () => [],
}: {
  cheapsharkSearch?: () => Promise<Offer[]>;
  findSteamAppId?: () => Promise<string | null>;
  ggdealsSearch?: () => Promise<Offer[]>;
  itadSearch?: () => Promise<Offer[]>;
  resolveSteamid?: (identity: {
    steamid?: string;
    vanity?: string;
  }) => Promise<string | null>;
  getWishlist?: (steamid: string) => Promise<
    Array<{
      appid: number;
      title: string | null;
    }>
  >;
} = {}): Promise<SearchService> {
  const module = await Test.createTestingModule({
    providers: [
      SearchService,
      {
        provide: CheapSharkClient,
        useValue: {
          source: 'cheapshark',
          search: cheapsharkSearch,
          findSteamAppId,
        },
      },
      {
        provide: GgDealsClient,
        useValue: {
          source: 'gg.deals',
          search: ggdealsSearch,
        },
      },
      {
        provide: ItadClient,
        useValue: {
          source: 'itad',
          search: itadSearch,
        },
      },
      {
        provide: SteamClient,
        useValue: {
          resolveSteamid,
          getWishlist,
        },
      },
    ],
  }).compile();

  return module.get(SearchService);
}
