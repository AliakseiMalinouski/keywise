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

export function parseSearchRegion(value?: string): SearchRegion {
  const region = value?.trim().toLowerCase();

  return region && SEARCH_REGIONS.includes(region as SearchRegion)
    ? (region as SearchRegion)
    : DEFAULT_SEARCH_REGION;
}
