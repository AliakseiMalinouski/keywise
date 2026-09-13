import { Injectable, Logger } from '@nestjs/common';

import type { MarketplaceClient, Offer } from '../types.js';
import { normalizeTitle, titleMatchesQuery } from '../utils/match-title.js';

const CHEAPSHARK_API = 'https://www.cheapshark.com/api/1.0';
const USER_AGENT = 'keywise/0.0.1 (https://github.com/AliakseiMalinouski/keywise)';

type CheapSharkGame = {
  gameID: string;
  steamAppID?: string | null;
  cheapest: string;
  cheapestDealID: string;
  external: string;
};

type CheapSharkDeal = {
  storeID: string;
  dealID: string;
  price: string;
  retailPrice: string;
};

type CheapSharkGameDetails = {
  info?: {
    title?: string;
  };
  deals?: CheapSharkDeal[];
};

type CheapSharkStore = {
  storeID: string;
  storeName: string;
  isActive: number;
};

@Injectable()
export class CheapSharkClient implements MarketplaceClient {
  readonly source = 'cheapshark';
  private readonly logger = new Logger(CheapSharkClient.name);
  private storesPromise: Promise<Map<string, string>> | null = null;
  private readonly gameLookups = new Map<string, Promise<CheapSharkGame | null>>();

  async findSteamAppId(query: string): Promise<string | null> {
    const game = await this.findBestGame(query);
    const steamAppId = game?.steamAppID?.trim();

    return steamAppId && steamAppId !== '0' ? steamAppId : null;
  }

  async search(query: string): Promise<Offer[]> {
    try {
      const game = await this.findBestGame(query);
      if (!game) {
        return [];
      }

      const [details, stores] = await Promise.all([
        this.getJson<CheapSharkGameDetails>(
          `${CHEAPSHARK_API}/games?id=${encodeURIComponent(game.gameID)}`,
        ),
        this.getStores(),
      ]);

      const title = details.info?.title ?? game.external;

      return (details.deals ?? [])
        .map((deal) => this.toOffer(deal, title, stores))
        .filter((offer): offer is Offer => offer !== null)
        .sort((left, right) => left.price.amount - right.price.amount);
    } catch (error) {
      this.logger.warn(`CheapShark search failed: ${String(error)}`);
      return [];
    }
  }

  private findBestGame(query: string): Promise<CheapSharkGame | null> {
    const key = query.trim().toLowerCase();
    const pending = this.gameLookups.get(key);

    if (pending) {
      return pending;
    }

    const request = this.loadBestGame(query).finally(() => {
      this.gameLookups.delete(key);
    });

    this.gameLookups.set(key, request);
    return request;
  }

  private async loadBestGame(query: string): Promise<CheapSharkGame | null> {
    const games = await this.getJson<CheapSharkGame[]>(
      `${CHEAPSHARK_API}/games?title=${encodeURIComponent(query)}`,
    );

    return this.pickBestGame(games, query) ?? null;
  }

  private pickBestGame(
    games: CheapSharkGame[],
    query: string,
  ): CheapSharkGame | undefined {
    const queryWords = normalizeTitle(query)
      .split(' ')
      .filter((word) => word.length > 1);

    return games
      .filter((game) => titleMatchesQuery(game.external, query))
      .sort((left, right) => {
        const leftExtra = extraWordCount(left.external, queryWords);
        const rightExtra = extraWordCount(right.external, queryWords);
        if (leftExtra !== rightExtra) {
          return leftExtra - rightExtra;
        }

        return Number(left.cheapest) - Number(right.cheapest);
      })[0];
  }

  private toOffer(
    deal: CheapSharkDeal,
    title: string,
    stores: Map<string, string>,
  ): Offer | null {
    const amount = Number(deal.price);
    if (!Number.isFinite(amount)) {
      return null;
    }

    return {
      source: stores.get(deal.storeID) ?? `store-${deal.storeID}`,
      title,
      url: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
      price: { amount, currency: 'USD' },
    };
  }

  private getStores(): Promise<Map<string, string>> {
    this.storesPromise ??= this.getJson<CheapSharkStore[]>(
      `${CHEAPSHARK_API}/stores`,
    )
      .then((stores) => {
        return new Map(
          stores
            .filter((store) => store.isActive)
            .map((store) => [store.storeID, store.storeName]),
        );
      })
      .catch((error: unknown) => {
        this.storesPromise = null;
        throw error;
      });

    return this.storesPromise;
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`CheapShark responded ${response.status}`);
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
