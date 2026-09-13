export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function titleMatchesQuery(title: string, query: string): boolean {
  const words = normalizeTitle(query)
    .split(' ')
    .filter((word) => word.length > 1);

  if (words.length === 0) {
    return false;
  }

  const normalized = normalizeTitle(title);
  return words.every((word) => normalized.includes(word));
}

export function pickCheapestMatching<T extends { title: string; price: { amount: number } }>(
  items: T[],
  query: string,
  limit = 5,
): T[] {
  return items
    .filter((item) => titleMatchesQuery(item.title, query))
    .sort((left, right) => left.price.amount - right.price.amount)
    .slice(0, limit);
}
