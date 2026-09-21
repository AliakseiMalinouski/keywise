import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SteamIdentity } from './parse-steam-input.js';

const STEAM_API = 'https://api.steampowered.com';
const USER_AGENT = 'keywise/0.0.1 (https://github.com/AliakseiMalinouski/keywise)';
const WISHLIST_CACHE_TTL_MS = 5 * 60 * 1000;
const TITLE_BATCH_SIZE = 100;

export type SteamWishlistItem = {
  appid: number;
  title: string | null;
};

type CacheEntry = {
  expiresAt: number;
  items: SteamWishlistItem[];
};

type VanityResponse = {
  response?: {
    success?: number;
    steamid?: string;
  };
};

type WishlistResponse = {
  response?: {
    items?: Array<{
      appid?: number;
    }>;
  };
};

type StoreItemsResponse = {
  response?: {
    store_items?: Array<{
      appid?: number;
      name?: string;
    }>;
    items?: Array<{
      appid?: number;
      name?: string;
    }>;
  };
};

@Injectable()
export class SteamClient {
  private readonly logger = new Logger(SteamClient.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<SteamWishlistItem[]>>();

  constructor(private readonly config: ConfigService) {}

  async resolveSteamid(identity: SteamIdentity): Promise<string | null> {
    if ('steamid' in identity) {
      return identity.steamid;
    }

    return this.resolveVanity(identity.vanity);
  }

  async getWishlist(steamid: string): Promise<SteamWishlistItem[]> {
    const cached = this.cache.get(steamid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    const pending = this.inflight.get(steamid);
    if (pending) {
      return pending;
    }

    const request = this.loadWishlist(steamid)
      .then((items) => {
        this.cache.set(steamid, {
          expiresAt: Date.now() + WISHLIST_CACHE_TTL_MS,
          items,
        });
        return items;
      })
      .finally(() => {
        this.inflight.delete(steamid);
      });

    this.inflight.set(steamid, request);
    return request;
  }

  private async resolveVanity(vanity: string): Promise<string | null> {
    const apiKey = this.config.get<string>('STEAM_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn('STEAM_API_KEY is not set');
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
    if (appids.length === 0) {
      return titles;
    }

    for (const batch of chunk(appids, TITLE_BATCH_SIZE)) {
      try {
        const url = new URL(`${STEAM_API}/IStoreBrowseService/GetItems/v1`);
        url.searchParams.set(
          'input_json',
          JSON.stringify({
            ids: batch.map((appid) => ({ appid })),
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
        const items =
          payload.response?.store_items ?? payload.response?.items ?? [];

        for (const item of items) {
          const title = item.name?.trim();
          if (item.appid != null && title) {
            titles.set(item.appid, title);
          }
        }
      } catch (error) {
        this.logger.warn(`Steam title lookup failed: ${String(error)}`);
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

function chunk<T>(values: T[], size: number): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}
