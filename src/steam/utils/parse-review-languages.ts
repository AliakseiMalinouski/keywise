/** Steam `GetAppReviews` language codes (not ISO country codes). */
export const STEAM_REVIEW_LANGUAGES = [
  'arabic',
  'brazilian',
  'bulgarian',
  'czech',
  'danish',
  'dutch',
  'english',
  'finnish',
  'french',
  'german',
  'greek',
  'hungarian',
  'indonesian',
  'italian',
  'japanese',
  'koreana',
  'latam',
  'norwegian',
  'polish',
  'portuguese',
  'romanian',
  'russian',
  'schinese',
  'spanish',
  'swedish',
  'tchinese',
  'thai',
  'turkish',
  'ukrainian',
  'vietnamese',
] as const;

export type SteamReviewLanguage = (typeof STEAM_REVIEW_LANGUAGES)[number];

const LANGUAGE_SET = new Set<string>(STEAM_REVIEW_LANGUAGES);

export const DEFAULT_REVIEW_LANGUAGES: readonly ['all'] = ['all'];

export function reviewLanguagesCacheKey(languages: readonly string[]): string {
  if (languages.length === 1 && languages[0] === 'all') {
    return 'all';
  }

  return [...languages].sort().join(',');
}

export function parseReviewLanguages(value?: string): string[] {
  const raw = value?.trim().toLowerCase();
  if (!raw || raw === 'all') {
    return [...DEFAULT_REVIEW_LANGUAGES];
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.includes('all')) {
    return [...DEFAULT_REVIEW_LANGUAGES];
  }

  const valid = parts.filter((part) => LANGUAGE_SET.has(part));
  if (valid.length === 0) {
    return [...DEFAULT_REVIEW_LANGUAGES];
  }

  return [...new Set(valid)];
}
