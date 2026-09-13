import type { Page } from 'playwright';

import type { Offer } from '../types.js';
import { titleMatchesQuery } from './match-title.js';
import { parsePrice } from './parse-price.js';

type RawCard = {
  href: string;
  text: string;
};

export async function extractOffersFromDom(
  page: Page,
  source: string,
  query: string,
): Promise<Offer[]> {
  const cards = await page.evaluate((): RawCard[] => {
    return [...document.querySelectorAll('a[href]')]
      .map((anchor) => ({
        href: (anchor as HTMLAnchorElement).href,
        text: (anchor.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((card) => card.href.startsWith('http') && card.text.length > 0);
  });

  const offers: Offer[] = [];

  for (const card of cards) {
    if (!titleMatchesQuery(card.text, query)) {
      continue;
    }

    const price = parsePrice(card.text);
    if (!price) {
      continue;
    }

    offers.push({
      source,
      title: card.text.slice(0, 160),
      url: card.href,
      price,
    });
  }

  return offers;
}
