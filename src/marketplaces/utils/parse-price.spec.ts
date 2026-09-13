import { describe, expect, it } from 'vitest';

import { fromMinorUnits, parsePrice } from './parse-price.js';

describe('parsePrice', () => {
  it('parses euro with symbol after the amount', () => {
    expect(parsePrice('19,99 €')).toEqual({ amount: 19.99, currency: 'EUR' });
  });

  it('parses PLN with a decimal dot', () => {
    expect(parsePrice('PLN 193.15')).toEqual({
      amount: 193.15,
      currency: 'PLN',
    });
  });

  it('returns null when there is no price', () => {
    expect(parsePrice('Elden Ring Steam Key')).toBeNull();
  });
});

describe('fromMinorUnits', () => {
  it('converts Algolia minor units to a decimal price', () => {
    expect(fromMinorUnits(4467, 'EUR')).toEqual({
      amount: 44.67,
      currency: 'EUR',
    });
  });
});
