import { describe, expect, it } from 'vitest';

import { DEFAULT_SEARCH_REGION, parseSearchRegion, toItadCountry } from './regions.js';

describe('parseSearchRegion', () => {
  it('defaults to pl when region is omitted', () => {
    expect(parseSearchRegion()).toBe(DEFAULT_SEARCH_REGION);
    expect(parseSearchRegion('')).toBe('pl');
  });

  it('normalizes case', () => {
    expect(parseSearchRegion('US')).toBe('us');
  });

  it('falls back to pl for unknown regions', () => {
    expect(parseSearchRegion('ru')).toBe('pl');
    expect(parseSearchRegion('poland')).toBe('pl');
  });
});

describe('toItadCountry', () => {
  it('uppercases ISO regions and maps eu to DE', () => {
    expect(toItadCountry('pl')).toBe('PL');
    expect(toItadCountry('us')).toBe('US');
    expect(toItadCountry('eu')).toBe('DE');
  });
});
