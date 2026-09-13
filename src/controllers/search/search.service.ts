import { Injectable, Logger } from '@nestjs/common';

import { CheapSharkClient } from '../../marketplaces/clients/cheapshark.client.js';
import { EnebaClient } from '../../marketplaces/clients/eneba.client.js';
import type { MarketplaceClient, SourceResult } from '../../marketplaces/types.js';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly clients: MarketplaceClient[];

  constructor(cheapshark: CheapSharkClient, eneba: EnebaClient) {
    this.clients = [cheapshark, eneba];
  }

  async search(query: string): Promise<SourceResult[]> {
    const results = await Promise.allSettled(
      this.clients.map((client) => client.search(query)),
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
