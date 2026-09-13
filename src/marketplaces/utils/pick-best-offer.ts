import { regionCurrency } from '../regions.js';
import type { BestOffer, SourceResult } from '../types.js';

export function pickBestOffer(
  results: SourceResult[],
  region: string,
): BestOffer | null {
  const offers = results.flatMap((result) =>
    result.data.map((offer) => ({
      ...offer,
      marketplace: result.source,
    })),
  );

  if (offers.length === 0) {
    return null;
  }

  const preferred = regionCurrency(region);
  const inRegion = offers.filter(
    (offer) => offer.price.currency.toUpperCase() === preferred,
  );
  const pool = inRegion.length > 0 ? inRegion : offers;

  return pool.reduce((best, offer) =>
    offer.price.amount < best.price.amount ? offer : best,
  );
}
