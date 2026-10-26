import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { normalizeTitle, titleMatchesQuery } from '../marketplaces/utils/match-title.js';
import type { SteamIdentity } from './parse-steam-input.js';
import {
  CACHE_TTL_MS,
  REVIEWS_PER_PAGE,
  STEAM_API,
  STEAM_STORE_SEARCH,
  TITLE_BATCH_SIZE,
  USER_AGENT,
} from './steam.client.const.js';
import type {
  AppReviewItem,
  AppReviewsResponse,
  AppSearchCacheEntry,
  AppSearchResult,
  GameRating,
  GameRatingCacheEntry,
  SteamReview,
  SteamWishlistItem,
  StoreItemsResponse,
  StoreSearchItem,
  StoreSearchResponse,
  TitleCacheEntry,
  VanityCacheEntry,
  VanityResponse,
  WishlistCacheEntry,
  WishlistResponse,
} from './steam.client.types.js';

@Injectable()
export class SteamClient {
  private readonly logger = new Logger(SteamClient.name);
  private readonly wishlistCache = new Map<string, WishlistCacheEntry>();
  private readonly wishlistInflight = new Map<
    string,
    Promise<SteamWishlistItem[]>
  >();
  private readonly vanityCache = new Map<string, VanityCacheEntry>();
  private readonly vanityInflight = new Map<string, Promise<string | null>>();
  private readonly titleCache = new Map<number, TitleCacheEntry>();
  private readonly appSearchCache = new Map<string, AppSearchCacheEntry>();
  private readonly appSearchInflight = new Map<
    string,
    Promise<AppSearchResult | null>
  >();
  private readonly ratingCache = new Map<string, GameRatingCacheEntry>();
  private readonly ratingInflight = new Map<string, Promise<GameRating | null>>();

  constructor(private readonly config: ConfigService) {}

  async getGameRating(query: string): Promise<GameRating | null> {
    const key = query.trim().toLowerCase();
    const cached = this.ratingCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rating;
    }

    const pending = this.ratingInflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.loadGameRating(query)
      .then((rating) => {
        this.ratingCache.set(key, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          rating,
        });
        return rating;
      })
      .finally(() => {
        this.ratingInflight.delete(key);
      });

    this.ratingInflight.set(key, request);
    return request;
  }

  async resolveSteamid(identity: SteamIdentity): Promise<string | null> {
    if ('steamid' in identity) {
      return identity.steamid;
    }

    return this.resolveVanity(identity.vanity);
  }

  async getWishlist(steamid: string): Promise<SteamWishlistItem[]> {
    const cached = this.wishlistCache.get(steamid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    const pending = this.wishlistInflight.get(steamid);
    if (pending) {
      return pending;
    }

    const request = this.loadWishlist(steamid)
      .then((items) => {
        this.wishlistCache.set(steamid, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          items,
        });
        return items;
      })
      .finally(() => {
        this.wishlistInflight.delete(steamid);
      });

    this.wishlistInflight.set(steamid, request);
    return request;
  }

  private async resolveVanity(vanity: string): Promise<string | null> {
    const key = vanity.trim().toLowerCase();
    const cached = this.vanityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.steamid;
    }

    const pending = this.vanityInflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.lookupVanity(vanity)
      .then((steamid) => {
        if (steamid) {
          this.vanityCache.set(key, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            steamid,
          });
        }

        return steamid;
      })
      .finally(() => {
        this.vanityInflight.delete(key);
      });

    this.vanityInflight.set(key, request);
    return request;
  }

  private async lookupVanity(vanity: string): Promise<string | null> {
    const fromApi = await this.lookupVanityApi(vanity);
    if (fromApi) {
      return fromApi;
    }

    return this.lookupVanityProfile(vanity);
  }

  private async lookupVanityApi(vanity: string): Promise<string | null> {
    const apiKey = this.config.get<string>('STEAM_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('STEAM_API_KEY is not set, resolving vanity from profile page');
      return null;
    }

    const url = new URL(`${STEAM_API}/ISteamUser/ResolveVanityURL/v1/`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('vanityurl', vanity);

    try {
      const payload = await this.getJson<VanityResponse>(url);
      const steamid = payload.response?.steamid?.trim();
      return payload.response?.success === 1 && steamid ? steamid : null;
    } catch (error) {
      this.logger.warn(`Steam vanity lookup failed: ${String(error)}`);
      return null;
    }
  }

  private async lookupVanityProfile(vanity: string): Promise<string | null> {
    const encoded = encodeURIComponent(vanity);
    const urls = [
      `https://steamcommunity.com/id/${encoded}/?xml=1`,
      `https://steamcommunity.com/id/${encoded}`,
    ];

    for (const href of urls) {
      try {
        const response = await fetch(href, {
          headers: { 'User-Agent': USER_AGENT },
        });
        if (!response.ok) {
          continue;
        }

        const steamid = extractSteamid(await response.text());
        if (steamid) {
          return steamid;
        }
      } catch (error) {
        this.logger.warn(`Steam profile vanity lookup failed: ${String(error)}`);
      }
    }

    return null;
  }

  private async loadWishlist(steamid: string): Promise<SteamWishlistItem[]> {
    const url = new URL(`${STEAM_API}/IWishlistService/GetWishlist/v1/`);
    url.searchParams.set('steamid', steamid);

    const payload = await this.getJson<WishlistResponse>(url);
    const appids = (payload.response?.items ?? [])
      .map((item) => item.appid)
      .filter((appid): appid is number => Number.isInteger(appid));

    const titles = await this.getTitles(appids);

    return appids.map((appid) => ({
      appid,
      title: titles.get(appid) ?? null,
    }));
  }

  private async getTitles(appids: number[]): Promise<Map<number, string>> {
    const titles = new Map<number, string>();
    const missing: number[] = [];

    for (const appid of appids) {
      const cached = this.titleCache.get(appid);
      if (cached && cached.expiresAt > Date.now()) {
        titles.set(appid, cached.title);
        continue;
      }

      missing.push(appid);
    }

    if (missing.length === 0) {
      return titles;
    }

    const results = await Promise.allSettled(
      chunk(missing, TITLE_BATCH_SIZE).map((batch) => this.fetchTitleBatch(batch)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`Steam title lookup failed: ${String(result.reason)}`);
        continue;
      }

      for (const [appid, title] of result.value) {
        this.titleCache.set(appid, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          title,
        });
        titles.set(appid, title);
      }
    }

    return titles;
  }

  private async loadGameRating(query: string): Promise<GameRating | null> {
    const match = await this.findAppByTitle(query);
    if (!match) {
      return null;
    }

    const url = new URL(`${STEAM_API}/IUserReviewsService/GetAppReviews/v1/`);
    url.searchParams.set(
      'input_json',
      JSON.stringify({
        appid: match.appid,
        cursor: '*',
        filter: 'Recent',
        languages: ['all'],
        num_per_page: REVIEWS_PER_PAGE,
      }),
    );

    const apiKey = this.config.get<string>('STEAM_API_KEY')?.trim();
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }

    try {
      const payload = await this.getJson<AppReviewsResponse>(url);
      const summary = payload.response?.query_summary;
      if (!summary) {
        return null;
      }

      const reviews = (payload.response?.reviews ?? [])
        .map((review) => this.toSteamReview(review))
        .filter((review): review is SteamReview => review !== null);

      return {
        appid: match.appid,
        title: match.title,
        score: summary.review_score ?? 0,
        scoreDescription: summary.review_score_desc?.trim() ?? '',
        totalPositive: summary.total_positive ?? 0,
        totalNegative: summary.total_negative ?? 0,
        totalReviews: summary.total_reviews ?? 0,
        reviews,
      };
    } catch (error) {
      this.logger.warn(`Steam reviews failed: ${String(error)}`);
      return null;
    }
  }

  private async findAppByTitle(query: string): Promise<AppSearchResult | null> {
    const key = query.trim().toLowerCase();
    const cached = this.appSearchCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.match;
    }

    const pending = this.appSearchInflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.searchStore(query)
      .then((match) => {
        this.appSearchCache.set(key, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          match,
        });
        return match;
      })
      .finally(() => {
        this.appSearchInflight.delete(key);
      });

    this.appSearchInflight.set(key, request);
    return request;
  }

  private async searchStore(query: string): Promise<AppSearchResult | null> {
    const url = new URL(STEAM_STORE_SEARCH);
    url.searchParams.set('term', query);
    url.searchParams.set('l', 'english');
    url.searchParams.set('cc', 'us');

    try {
      const payload = await this.getJson<StoreSearchResponse>(url);
      const match = this.pickBestStoreItem(payload.items ?? [], query);
      if (!match?.id || !match.name?.trim()) {
        return null;
      }

      return { appid: match.id, title: match.name.trim() };
    } catch (error) {
      this.logger.warn(`Steam store search failed: ${String(error)}`);
      return null;
    }
  }

  private pickBestStoreItem(
    items: StoreSearchItem[],
    query: string,
  ): StoreSearchItem | undefined {
    const queryWords = normalizeTitle(query)
      .split(' ')
      .filter((word) => word.length > 1);

    return items
      .filter(
        (item) =>
          item.type === 'app' &&
          item.id != null &&
          titleMatchesQuery(item.name ?? '', query),
      )
      .sort((left, right) => {
        const leftExtra = extraWordCount(left.name ?? '', queryWords);
        const rightExtra = extraWordCount(right.name ?? '', queryWords);
        if (leftExtra !== rightExtra) {
          return leftExtra - rightExtra;
        }

        return (left.name ?? '').length - (right.name ?? '').length;
      })[0];
  }

  private toSteamReview(review: AppReviewItem): SteamReview | null {
    const recommendationId = review.recommendationid?.trim();
    const text = review.review?.trim();
    if (!recommendationId || !text) {
      return null;
    }

    return {
      recommendationId,
      language: review.language?.trim() ?? '',
      text,
      votedUp: review.voted_up === true,
      timestamp: review.timestamp_created ?? 0,
      votesUp: review.votes_up ?? 0,
    };
  }

  private async fetchTitleBatch(appids: number[]): Promise<Map<number, string>> {
    const url = new URL(`${STEAM_API}/IStoreBrowseService/GetItems/v1`);
    url.searchParams.set(
      'input_json',
      JSON.stringify({
        ids: appids.map((appid) => ({ appid })),
        context: {
          language: 'english',
          country_code: 'US',
          steam_realm: 1,
        },
        data_request: {
          include_basic_info: true,
        },
      }),
    );

    const payload = await this.getJson<StoreItemsResponse>(url);
    const items = payload.response?.store_items ?? payload.response?.items ?? [];
    const titles = new Map<number, string>();

    for (const item of items) {
      const title = item.name?.trim();
      if (item.appid != null && title) {
        titles.set(item.appid, title);
      }
    }

    return titles;
  }

  private async getJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Steam responded ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

const STEAMID64 = /7656119\d{10}/;

function extractSteamid(body: string): string | null {
  const xml = body.match(/<steamID64>(7656119\d{10})<\/steamID64>/i);
  if (xml?.[1]) {
    return xml[1];
  }

  const quoted = body.match(/"steamid"\s*:\s*"(7656119\d{10})"/i);
  if (quoted?.[1]) {
    return quoted[1];
  }

  return body.match(STEAMID64)?.[0] ?? null;
}

function extraWordCount(title: string, queryWords: string[]): number {
  const words = normalizeTitle(title)
    .split(' ')
    .filter((word) => word.length > 1);

  return Math.max(0, words.length - queryWords.length);
}

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}
