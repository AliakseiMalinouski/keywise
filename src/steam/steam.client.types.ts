export type SteamWishlistItem = {
  appid: number;
  title: string | null;
};

export type SteamReview = {
  recommendationId: string;
  language: string;
  text: string;
  votedUp: boolean;
  timestamp: number;
  votesUp: number;
};

export type GameRating = {
  appid: number;
  title: string;
  score: number;
  scoreDescription: string;
  totalPositive: number;
  totalNegative: number;
  totalReviews: number;
  reviews: SteamReview[];
};

export type WishlistCacheEntry = {
  expiresAt: number;
  items: SteamWishlistItem[];
};

export type VanityCacheEntry = {
  expiresAt: number;
  steamid: string;
};

export type TitleCacheEntry = {
  expiresAt: number;
  title: string;
};

export type VanityResponse = {
  response?: {
    success?: number;
    steamid?: string;
  };
};

export type WishlistResponse = {
  response?: {
    items?: Array<{
      appid?: number;
    }>;
  };
};

export type StoreItemsResponse = {
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

export type StoreSearchItem = {
  type?: string;
  name?: string;
  id?: number;
};

export type StoreSearchResponse = {
  items?: StoreSearchItem[];
};

export type AppSearchResult = {
  appid: number;
  title: string;
};

export type AppSearchCacheEntry = {
  expiresAt: number;
  match: AppSearchResult | null;
};

export type GameRatingCacheEntry = {
  expiresAt: number;
  rating: GameRating | null;
};

export type AppReviewItem = {
  recommendationid?: string;
  language?: string;
  review?: string;
  voted_up?: boolean;
  timestamp_created?: number;
  votes_up?: number;
};

export type AppReviewsResponse = {
  response?: {
    query_summary?: {
      review_score?: number;
      review_score_desc?: string;
      total_positive?: number;
      total_negative?: number;
      total_reviews?: number;
    };
    reviews?: AppReviewItem[];
  };
};
