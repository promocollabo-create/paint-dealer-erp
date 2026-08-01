/**
 * Firestore has no native full-text/partial-text search, so we precompute a "searchTokens"
 * array on each product: every word from name/code/category/series/company, exploded into
 * prefixes (min length 2). A query for "seri" then matches via a plain `array-contains`
 * because "seri" was generated as a prefix of "series". This is the standard workaround for
 * "search as you type" without a third-party search service (Algolia/Typesense).
 */

const MIN_PREFIX_LENGTH = 2;
const MAX_TOKENS = 150;

function wordPrefixes(word: string): string[] {
  const clean = word.toLowerCase().trim();
  if (clean.length < MIN_PREFIX_LENGTH) return clean ? [clean] : [];
  const prefixes: string[] = [];
  for (let i = MIN_PREFIX_LENGTH; i <= clean.length; i++) {
    prefixes.push(clean.slice(0, i));
  }
  return prefixes;
}

export function generateSearchTokens(fields: {
  productName: string;
  category: string;
  series: string;
  company: string;
}): string[] {
  const words = [fields.productName, fields.category, fields.series, fields.company]
    .join(" ")
    .split(/[\s\-_/]+/)
    .filter(Boolean);

  const tokenSet = new Set<string>();
  for (const word of words) {
    for (const prefix of wordPrefixes(word)) {
      tokenSet.add(prefix);
      if (tokenSet.size >= MAX_TOKENS) break;
    }
    if (tokenSet.size >= MAX_TOKENS) break;
  }
  return Array.from(tokenSet);
}

/** Normalizes a free-text search query into words for both the Firestore token match
 *  (first word) and the client-side refinement filter (remaining words). */
export function normalizeQueryWords(input: string): string[] {
  return input
    .toLowerCase()
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean);
}
