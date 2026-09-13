import { describe, expect, it } from 'vitest';

import type { Offer, SourceResult } from '../types.js';
import { pickBestOffer } from './pick-best-offer.js';

const usd: Offer = {
  source: 'Steam',
  title: 'ELDEN RING',
  url: 'https://cheapshark.example/steam',
  price: { amount: 19.99, currency: 'USD' },
};

const plnCheap: Offer = {
  source: 'GG.deals keyshops',
  title: 'ELDEN RING',
  url: 'https://gg.deals/elden-ring',
  region: 'pl',
  price: { amount: 129.99, currency: 'PLN' },
};

const plnExpensive: Offer = {
  source: 'GOG',
  title: 'ELDEN RING',
  url: 'https://itad.example/gog',
  region: 'pl',
  price: { amount: 199.99, currency: 'PLN' },
};

describe('pickBestOffer', () => {
  it('returns null when every source is empty', () => {
    expect(
      pickBestOffer([{ source: 'cheapshark', data: [] }], 'pl'),
    ).toBeNull();
  });

  it('prefers the cheapest offer in the region currency', () => {
    const results: SourceResult[] = [
      { source: 'cheapshark', data: [usd] },
      { source: 'gg.deals', data: [plnCheap] },
      { source: 'itad', data: [plnExpensive] },
    ];

    expect(pickBestOffer(results, 'pl')).toEqual({
      ...plnCheap,
      marketplace: 'gg.deals',
    });
  });

  it('falls back to the lowest amount when no offer matches the region', () => {
    expect(
      pickBestOffer([{ source: 'cheapshark', data: [usd] }], 'pl'),
    ).toEqual({
      ...usd,
      marketplace: 'cheapshark',
    });
  });
});
