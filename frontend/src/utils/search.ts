function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cada término de `query` debe aparecer al inicio de alguna "palabra" dentro de `haystack`
 *  (después de un espacio, guion, u otro separador) — evita falsos positivos como que
 *  buscar "20" matchee con un número de oficina "1206-1208". */
export function matchesAllTerms(haystack: string, query: string): boolean {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack.toLowerCase();
  return terms.every((t) => new RegExp('\\b' + escapeRegExp(t)).test(text));
}