import { describe, expect, it } from 'vitest';

import { DEFAULT_SEARCH_REGION, parseSearchRegion } from './regions.js';

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
