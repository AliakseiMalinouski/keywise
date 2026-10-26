import { describe, expect, it } from 'vitest';

import {
  parseReviewLanguages,
  reviewLanguagesCacheKey,
} from './parse-review-languages.js';

describe('parseReviewLanguages', () => {
  it('defaults to all when missing or empty', () => {
    expect(parseReviewLanguages()).toEqual(['all']);
    expect(parseReviewLanguages('')).toEqual(['all']);
    expect(parseReviewLanguages('   ')).toEqual(['all']);
  });

  it('accepts a single Steam language code', () => {
    expect(parseReviewLanguages('russian')).toEqual(['russian']);
    expect(parseReviewLanguages('ENGLISH')).toEqual(['english']);
  });

  it('accepts comma-separated languages', () => {
    expect(parseReviewLanguages('english, polish')).toEqual(['english', 'polish']);
  });

  it('deduplicates languages', () => {
    expect(parseReviewLanguages('english,english')).toEqual(['english']);
  });

  it('falls back to all for unknown codes', () => {
    expect(parseReviewLanguages('klingon')).toEqual(['all']);
  });

  it('ignores unknown codes when mixed with valid ones', () => {
    expect(parseReviewLanguages('russian,klingon')).toEqual(['russian']);
  });

  it('treats all as exclusive', () => {
    expect(parseReviewLanguages('all,russian')).toEqual(['all']);
  });
});

describe('reviewLanguagesCacheKey', () => {
  it('uses all for the default filter', () => {
    expect(reviewLanguagesCacheKey(['all'])).toBe('all');
  });

  it('sorts language codes for stable cache keys', () => {
    expect(reviewLanguagesCacheKey(['polish', 'english'])).toBe('english,polish');
  });
});
