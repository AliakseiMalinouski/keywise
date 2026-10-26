import type { GameRating } from '../steam/steam.client.types.js';

export type { GameRating, SteamReview } from '../steam/steam.client.types.js';

export type OfferPrice = {
  amount: number;
  currency: string;
};

export type Offer = {
  source: string;
  title: string;
  url: string;
  region?: string;
  price: OfferPrice;
};

export type SourceResult<T = Offer[]> = {
  source: string;
  data: T;
};

export type BestOffer = Offer & {
  marketplace: string;
};

export type WishlistGame = {
  appid: number;
  title: string | null;
  selected: boolean;
};

export type SearchResponse = {
  result: SourceResult[];
  best: BestOffer | null;
  rating: GameRating | null;
  wishlist?: WishlistGame[];
};

export type SearchOptions = {
  region: string;
};

export interface MarketplaceClient {
  readonly source: string;
  search(query: string, options: SearchOptions): Promise<Offer[]>;
}
