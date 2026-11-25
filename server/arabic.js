/**
 * Normalize Arabic text for diacritic- and hamza-insensitive search.
 * @param {string} text
 * @returns {string}
 */
export function normalizeArabic(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Check whether every normalized search token in query appears in haystack.
 * @param {string} haystack
 * @param {string} query
 * @returns {boolean}
 */
export function matchesArabicQuery(haystack, query) {
  const normQuery = normalizeArabic(query);
  if (!normQuery) return true;
  const normHaystack = normalizeArabic(haystack);
  if (!normHaystack) return false;
  const tokens = normQuery.split(' ');
  return tokens.every((token) => normHaystack.includes(token));
}
