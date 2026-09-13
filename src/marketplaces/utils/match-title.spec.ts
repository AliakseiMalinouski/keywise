import { describe, expect, it } from 'vitest';

import { pickCheapestMatching, titleMatchesQuery } from './match-title.js';

describe('titleMatchesQuery', () => {
  it('matches when all query words are present', () => {
    expect(
      titleMatchesQuery('Elden Ring (PC) Steam Key EUROPE', 'elden ring'),
    ).toBe(true);
  });

  it('rejects unrelated titles', () => {
    expect(titleMatchesQuery('Cyberpunk 2077 Steam Key', 'elden ring')).toBe(
      false,
    );
  });
});

describe('pickCheapestMatching', () => {
  it('keeps matching offers and sorts them by price', () => {
    const picked = pickCheapestMatching(
      [
        {
          title: 'Elden Ring Global',
          price: { amount: 50 },
        },
        {
          title: 'Random DLC',
          price: { amount: 1 },
        },
        {
          title: 'Elden Ring Europe',
          price: { amount: 40 },
        },
      ],
      'elden ring',
    );

    expect(picked.map((item) => item.price.amount)).toEqual([40, 50]);
  });
});
