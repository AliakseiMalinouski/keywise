const CURRENCY_BY_SYMBOL: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  zł: 'PLN',
  pln: 'PLN',
  eur: 'EUR',
  usd: 'USD',
  gbp: 'GBP',
};

export function parseAmount(raw: string): number | null {
  const value = raw.trim();
  const hasComma = value.includes(',');
  const hasDot = value.includes('.');

  const normalized =
    hasComma && hasDot
      ? value.replace(/\./g, '').replace(',', '.')
      : hasComma
        ? value.replace(',', '.')
        : value;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function parsePrice(
  text: string,
): { amount: number; currency: string } | null {
  const cleaned = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const match = cleaned.match(
    /(?:([€$£]|USD|EUR|GBP|PLN|zł)\s*)?(\d{1,5}(?:[.,]\d{3})*[.,]\d{2}|\d{1,5})(?:\s*([€$£]|USD|EUR|GBP|PLN|zł))?/i,
  );

  if (!match) {
    return null;
  }

  const amount = parseAmount(match[2]);
  if (amount === null) {
    return null;
  }

  const currencyRaw = (match[1] || match[3] || '').toLowerCase();
  const currency = CURRENCY_BY_SYMBOL[currencyRaw] ?? 'EUR';

  return { amount, currency };
}

export function fromMinorUnits(
  amount: number,
  currency: string,
): { amount: number; currency: string } {
  return { amount: amount / 100, currency };
}
