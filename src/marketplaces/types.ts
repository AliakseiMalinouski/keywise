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

export type SearchOptions = {
  region: string;
};

export interface MarketplaceClient {
  readonly source: string;
  search(query: string, options: SearchOptions): Promise<Offer[]>;
}
