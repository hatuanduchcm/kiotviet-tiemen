// Common utilities for rules (dùng cho src/rules/*)

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
