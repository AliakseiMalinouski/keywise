import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MarketplaceClient, Offer } from '../types.js';
import { parseAmount } from '../utils/parse-price.js';
import { CheapSharkClient } from './cheapshark.client.js';

const GGDEALS_PRICES_URL = 'https://api.gg.deals/v1/prices/by-steam-app-id/';
const USER_AGENT = 'keywise/0.0.1 (https://github.com/AliakseiMalinouski/keywise)';
const DEFAULT_REGION = 'pl';

type GgDealsPrices = {
  currentRetail?: string | null;
  currentKeyshops?: string | null;
  currency?: string;
};

type GgDealsGame = {
  title?: string;
  url?: string;
  prices?: GgDealsPrices;
};

type GgDealsResponse = {
  success?: boolean;
  data?: Record<string, GgDealsGame | null>;
};

@Injectable()
export class GgDealsClient implements MarketplaceClient {
  readonly source = 'gg.deals' as const;
  private readonly logger = new Logger(GgDealsClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cheapshark: CheapSharkClient,
  ) {}

  async search(query: string): Promise<Offer[]> {
    const apiKey = this.config.get<string>('GGDEALS_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('GGDEALS_API_KEY is not set');
      return [];
    }

    try {
      const steamAppId = await this.cheapshark.findSteamAppId(query);
      if (!steamAppId) {
        return [];
      }

      const region = this.config.get<string>('GGDEALS_REGION')?.trim() || DEFAULT_REGION;
      const url = new URL(GGDEALS_PRICES_URL);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('ids', steamAppId);
      url.searchParams.set('region', region);

      const payload = await this.getJson<GgDealsResponse>(url);
      const game = payload.data?.[steamAppId];
      if (!game?.url || !game.title) {
        return [];
      }

      return [
        this.toOffer(game, 'GG.deals retail', game.prices?.currentRetail, region),
        this.toOffer(game, 'GG.deals keyshops', game.prices?.currentKeyshops, region),
      ].filter((offer): offer is Offer => offer !== null);
    } catch (error) {
      this.logger.warn(`GG.deals search failed: ${String(error)}`);
      return [];
    }
  }

  private toOffer(
    game: GgDealsGame,
    source: string,
    rawPrice: string | null | undefined,
    region: string,
  ): Offer | null {
    if (!rawPrice || !game.title || !game.url) {
      return null;
    }

    const amount = parseAmount(rawPrice);
    if (amount === null) {
      return null;
    }

    return {
      source,
      title: game.title,
      url: game.url,
      region,
      price: {
        amount,
        currency: game.prices?.currency ?? 'EUR',
      },
    };
  }

  private async getJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`GG.deals responded ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
