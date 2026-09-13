import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import { EnebaClient } from '../../marketplaces/clients/eneba.client.js';
import type { Offer } from '../../marketplaces/types.js';
import { SearchService } from './search.service.js';

const steamOffer: Offer = {
  source: 'Steam',
  title: 'ELDEN RING',
  url: 'https://www.cheapshark.com/redirect?dealID=abc',
  price: { amount: 59.99, currency: 'USD' },
};

const enebaOffer: Offer = {
  source: 'eneba',
  title: 'Elden Ring (PC) Steam Key EUROPE',
  url: 'https://www.eneba.com/steam-elden-ring-pc-steam-key-europe',
  region: 'europe',
  price: { amount: 44.66, currency: 'EUR' },
};

describe('SearchService', () => {
  it('returns a result per source', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: CheapSharkClient,
          useValue: {
            source: 'cheapshark',
            search: async () => [steamOffer],
          },
        },
        {
          provide: EnebaClient,
          useValue: {
            source: 'eneba',
            search: async () => [enebaOffer],
          },
        },
      ],
    }).compile();

    const service = module.get(SearchService);

    await expect(service.search('elden ring')).resolves.toEqual([
      { source: 'cheapshark', data: [steamOffer] },
      { source: 'eneba', data: [enebaOffer] },
    ]);
  });

  it('keeps a source with empty data when it fails', async () => {
    const module = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: CheapSharkClient,
          useValue: {
            source: 'cheapshark',
            search: async () => {
              throw new Error('network');
            },
          },
        },
        {
          provide: EnebaClient,
          useValue: {
            source: 'eneba',
            search: async () => [enebaOffer],
          },
        },
      ],
    }).compile();

    const service = module.get(SearchService);

    await expect(service.search('elden ring')).resolves.toEqual([
      { source: 'cheapshark', data: [] },
      { source: 'eneba', data: [enebaOffer] },
    ]);
  });
});
