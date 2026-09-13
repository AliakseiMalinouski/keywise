export const SEARCH_REGIONS = [
  'au',
  'be',
  'br',
  'ca',
  'ch',
  'de',
  'dk',
  'es',
  'eu',
  'fi',
  'fr',
  'gb',
  'ie',
  'it',
  'nl',
  'no',
  'pl',
  'se',
  'us',
] as const;

export type SearchRegion = (typeof SEARCH_REGIONS)[number];

export const DEFAULT_SEARCH_REGION: SearchRegion = 'pl';

const CURRENCY_BY_REGION: Record<SearchRegion, string> = {
  au: 'AUD',
  be: 'EUR',
  br: 'BRL',
  ca: 'CAD',
  ch: 'CHF',
  de: 'EUR',
  dk: 'DKK',
  es: 'EUR',
  eu: 'EUR',
  fi: 'EUR',
  fr: 'EUR',
  gb: 'GBP',
  ie: 'EUR',
  it: 'EUR',
  nl: 'EUR',
  no: 'NOK',
  pl: 'PLN',
  se: 'SEK',
  us: 'USD',
};

export function regionCurrency(region: string): string {
  return CURRENCY_BY_REGION[region as SearchRegion] ?? 'EUR';
}

export function toItadCountry(region: string): string {
  return region === 'eu' ? 'DE' : region.toUpperCase();
}

export function parseSearchRegion(value?: string): SearchRegion {
  const region = value?.trim().toLowerCase();

  return region && SEARCH_REGIONS.includes(region as SearchRegion)
    ? (region as SearchRegion)
    : DEFAULT_SEARCH_REGION;
}
