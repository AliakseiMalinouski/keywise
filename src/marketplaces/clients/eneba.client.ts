import { Injectable, Logger } from '@nestjs/common';

import { BrowserService } from '../browser.service.js';
import type { MarketplaceClient, Offer } from '../types.js';
import { extractOffersFromDom } from '../utils/dom-offers.js';
import { pickCheapestMatching } from '../utils/match-title.js';
import { fromMinorUnits } from '../utils/parse-price.js';
import { waitForJson } from '../utils/wait-for-json.js';

type EnebaHit = {
  slug?: string;
  productRegions?: string[];
  translations?: {
    en_US?: {
      name?: string;
    };
  };
  lowestPrice?: Record<string, number>;
};

type AlgoliaPayload = {
  results?: Array<{ hits?: EnebaHit[] }>;
};

@Injectable()
export class EnebaClient implements MarketplaceClient {
  readonly source = 'eneba' as const;
  private readonly logger = new Logger(EnebaClient.name);

  constructor(private readonly browser: BrowserService) {}

  async search(query: string): Promise<Offer[]> {
    try {
      return await this.browser.withPage(async (page) => {
        const hitsPromise = waitForJson(
          page,
          (response) => response.ok() && response.url().includes('algolia.net'),
          (payload) => {
            const hits = (payload as AlgoliaPayload).results?.[0]?.hits;
            return hits?.length ? hits : null;
          },
        );

        await page.goto(
          `https://www.eneba.com/store/all?text=${encodeURIComponent(query)}`,
          { waitUntil: 'domcontentloaded', timeout: 30000 },
        );

        const hits = await hitsPromise;
        const offers = hits?.length
          ? this.mapHits(hits)
          : await extractOffersFromDom(page, this.source, query);

        return pickCheapestMatching(offers, query);
      });
    } catch (error) {
      this.logger.warn(`Eneba search failed: ${String(error)}`);
      return [];
    }
  }

  private mapHits(hits: EnebaHit[]): Offer[] {
    const offers: Offer[] = [];

    for (const hit of hits) {
      const title = hit.translations?.en_US?.name;
      const slug = hit.slug;
      const minor =
        hit.lowestPrice?.EUR ?? hit.lowestPrice?.PLN ?? hit.lowestPrice?.USD;

      if (!title || !slug || minor == null) {
        continue;
      }

      const currency = hit.lowestPrice?.EUR
        ? 'EUR'
        : hit.lowestPrice?.PLN
          ? 'PLN'
          : 'USD';

      offers.push({
        source: this.source,
        title,
        url: `https://www.eneba.com/${slug}`,
        region: hit.productRegions?.[0],
        price: fromMinorUnits(minor, currency),
      });
    }

    return offers;
  }
}
