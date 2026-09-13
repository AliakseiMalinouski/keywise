import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEFAULT_SEARCH_REGION, toItadCountry } from '../regions.js';
import type { MarketplaceClient, Offer, SearchOptions } from '../types.js';
import { normalizeTitle, titleMatchesQuery } from '../utils/match-title.js';

const ITAD_API = 'https://api.isthereanydeal.com';
const USER_AGENT = 'keywise/0.0.1 (https://github.com/AliakseiMalinouski/keywise)';
const OFFER_LIMIT = 8;

type ItadSearchGame = {
  id?: string;
  slug?: string;
  title?: string;
  type?: string;
};

type ItadDeal = {
  shop?: {
    name?: string;
  };
  price?: {
    amount?: number;
    currency?: string;
  };
  url?: string;
};

type ItadPricesGame = {
  id?: string;
  deals?: ItadDeal[];
};

@Injectable()
export class ItadClient implements MarketplaceClient {
  readonly source = 'itad' as const;
  private readonly logger = new Logger(ItadClient.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string, options: SearchOptions): Promise<Offer[]> {
    const apiKey = this.config.get<string>('IS_THERE_ANY_DEAL_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('IS_THERE_ANY_DEAL_API_KEY is not set');
      return [];
    }

    try {
      const game = await this.findBestGame(apiKey, query);
      if (!game?.id || !game.title) {
        return [];
      }

      const country = toItadCountry(options.region || DEFAULT_SEARCH_REGION);
      const pricesUrl = new URL(`${ITAD_API}/games/prices/v3`);
      pricesUrl.searchParams.set('key', apiKey);
      pricesUrl.searchParams.set('country', country);

      const games = await this.getJson<ItadPricesGame[]>(pricesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([game.id]),
      });

      const title = game.title;
      const fallbackUrl = game.slug
        ? `https://isthereanydeal.com/game/${game.slug}/`
        : undefined;

      return (games[0]?.deals ?? [])
        .map((deal) => this.toOffer(deal, title, fallbackUrl, options.region))
        .filter((offer): offer is Offer => offer !== null)
        .sort((left, right) => left.price.amount - right.price.amount)
        .slice(0, OFFER_LIMIT);
    } catch (error) {
      this.logger.warn(`ITAD search failed: ${String(error)}`);
      return [];
    }
  }

  private async findBestGame(
    apiKey: string,
    query: string,
  ): Promise<ItadSearchGame | null> {
    const searchUrl = new URL(`${ITAD_API}/games/search/v1`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('title', query);
    searchUrl.searchParams.set('results', '10');

    const games = await this.getJson<ItadSearchGame[]>(searchUrl);
    const queryWords = normalizeTitle(query)
      .split(' ')
      .filter((word) => word.length > 1);

    return (
      games
        .filter((game) => game.id && game.title && titleMatchesQuery(game.title, query))
        .sort((left, right) => {
          const leftGame = left.type === 'game' ? 0 : 1;
          const rightGame = right.type === 'game' ? 0 : 1;
          if (leftGame !== rightGame) {
            return leftGame - rightGame;
          }

          return extraWordCount(left.title ?? '', queryWords) - extraWordCount(right.title ?? '', queryWords);
        })[0] ?? null
    );
  }

  private toOffer(
    deal: ItadDeal,
    title: string,
    fallbackUrl: string | undefined,
    region: string,
  ): Offer | null {
    const amount = deal.price?.amount;
    const shop = deal.shop?.name?.trim();
    const url = deal.url?.trim() || fallbackUrl;

    if (!shop || !url || amount == null || !Number.isFinite(amount)) {
      return null;
    }

    return {
      source: shop,
      title,
      url,
      region,
      price: {
        amount,
        currency: deal.price?.currency ?? 'EUR',
      },
    };
  }

  private async getJson<T>(url: URL, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        'User-Agent': USER_AGENT,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`ITAD responded ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

function extraWordCount(title: string, queryWords: string[]): number {
  const words = normalizeTitle(title)
    .split(' ')
    .filter((word) => word.length > 1);

  return Math.max(0, words.length - queryWords.length);
}
