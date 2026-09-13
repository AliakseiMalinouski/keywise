import { Injectable, Logger } from '@nestjs/common';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import { GgDealsClient } from '../../marketplaces/clients/ggdeals.client.js';
import { ItadClient } from '../../marketplaces/clients/itad.client.js';
import type { MarketplaceClient, SourceResult } from '../../marketplaces/types.js';

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  data: SourceResult[];
};

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly clients: MarketplaceClient[];
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<SourceResult[]>>();

  constructor(
    cheapshark: CheapSharkClient,
    ggdeals: GgDealsClient,
    itad: ItadClient,
  ) {
    this.clients = [cheapshark, ggdeals, itad];
  }

  async search(query: string, region: string): Promise<SourceResult[]> {
    const key = `${query.trim().toLowerCase()}|${region}`;
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.fetchSources(query, region)
      .then((data) => {
        this.cache.set(key, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          data,
        });
        return data;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, request);
    return request;
  }

  private async fetchSources(
    query: string,
    region: string,
  ): Promise<SourceResult[]> {
    const results = await Promise.allSettled(
      this.clients.map((client) => client.search(query, { region })),
    );

    return results.map((result, index) => {
      const source = this.clients[index].source;

      if (result.status === 'fulfilled') {
        return { source, data: result.value };
      }

      this.logger.warn(`${source} search failed: ${String(result.reason)}`);
      return { source, data: [] };
    });
  }
}
