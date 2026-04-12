// Common utilities for rules (dùng cho src/rules/*)
import { CATEGORY_TEMPLATE } from './category-template.js';

export function normalizeProductName(name: unknown): string {
  return (String(name || '')).replace(/\s+/g, ' ').trim();
}

export function hasPrefix(code: unknown, prefix: string): boolean {
  return typeof code === 'string' && code.toUpperCase().startsWith(prefix.toUpperCase());
}

export function nameIncludes(name: unknown, keyword: string): boolean {
  return typeof name === 'string' && name.toUpperCase().includes(keyword.toUpperCase());
}

export function parseNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const s = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

/**
 * Detect product category from product `Mã hàng` and `Tên hàng`.
 * Returns one of the canonical keys used across rules (SUIT, JACKET, MANTO, GILE, QUAN, SOMI)
 * or null when no match is found. Matching is case-insensitive and uses prefixes and
 * name keywords.
 */
export function detectProductCategory(code: unknown, name: unknown):
  | 'SUIT'
  | 'JACKET'
  | 'MANTO'
  | 'GILE'
  | 'QUAN'
  | 'SOMI'
  | null {
  const c = String(code ?? '').toUpperCase();
  const n = String(name ?? '').toUpperCase();

  // Use a central category template if available to drive detection.
  const tpl = CATEGORY_TEMPLATE;
  if (tpl && Array.isArray(tpl)) {
    for (const entry of tpl) {
      const prefixes: string[] | undefined = entry.prefixes;
      const keywords: string[] | undefined = entry.nameKeywords;
      const prefixMatch = prefixes?.some((p) => c.startsWith((p || '').toUpperCase()));
      const nameMatch = keywords?.some((k) => n.includes((k || '').toUpperCase()));
      if (prefixMatch || nameMatch) return entry.key as any;
    }
  }

  // Fallback hard-coded checks
  const matchesPrefix = (prefixes?: string[]) => prefixes?.some((p) => c.startsWith((p || '').toUpperCase()));
  const matchesName = (keywords?: string[]) => keywords?.some((k) => n.includes((k || '').toUpperCase()));

  if (matchesPrefix(['BS']) || matchesName(['BỘ SUIT', 'SUIT'])) return 'SUIT';
  if (matchesPrefix(['AJ']) || matchesName(['ÁO JACKET', 'JACKET'])) return 'JACKET';
  if (matchesPrefix(['MT']) || matchesName(['MĂNG TÔ', 'MANTO'])) return 'MANTO';
  if (matchesPrefix(['AG']) || matchesName(['GILE', 'GILET', 'ÁO GILE'])) return 'GILE';
  if (matchesPrefix(['QT']) || matchesName(['QUẦN', 'PANTS'])) return 'QUAN';
  if (matchesPrefix(['SM']) || matchesName(['SƠ MI', 'SOMI'])) return 'SOMI';

  return null;
}
