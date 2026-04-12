import { parseNumber, detectProductCategory } from './common.js';
import N11_THRESHOLDS from './n11-thresholds.js';

/**
 * Category detection template used by N11 rule.
 * Each entry contains a category key that maps to N11_THRESHOLDS, a set of code prefixes
 * and a set of name keywords. The detection is performed in order; the first match wins.
 */
const CATEGORY_TEMPLATE: Array<{
  key: keyof typeof N11_THRESHOLDS;
  prefixes?: string[];
  nameKeywords?: string[];
}> = [
  { key: 'SUIT', prefixes: ['BS', 'SU'], nameKeywords: ['BỘ SUIT', 'SUIT'] },
  { key: 'JACKET', prefixes: ['AJ'], nameKeywords: ['ÁO JACKET', 'JACKET'] },
  { key: 'MANTO', prefixes: ['MT'], nameKeywords: ['MĂNG TÔ', 'MANTO'] },
  { key: 'GILE', prefixes: ['AG'], nameKeywords: ['GILE', 'GILET', 'ÁO GILE'] },
  { key: 'QUAN', prefixes: ['QT'], nameKeywords: ['QUẦN', 'PANTS'] },
  { key: 'SOMI', prefixes: ['SM'], nameKeywords: ['SƠ MI', 'SOMI'] }
];

function strIncludesAny(src: string, patterns?: string[]) {
  if (!patterns || patterns.length === 0) return false;
  const s = String(src || '').toUpperCase();
  return patterns.some((p) => s.includes(String(p || '').toUpperCase()));
}

/**
 * Apply N11 flag to rows using a small template for detection.
 */
export function applyN11Rule(rows: any[]): any[] {
  for (const r of rows) {
    const code = String(r?.['Mã hàng'] ?? '').toUpperCase();
    const name = String(r?.['Tên hàng'] ?? '');
    const unit = parseNumber(r?.['Đơn giá']);

    let threshold: number | null = null;

    const cat = detectProductCategory(code, name);
    if (cat) {
      threshold = N11_THRESHOLDS[cat as keyof typeof N11_THRESHOLDS];
    }

    if (threshold != null && unit >= threshold) {
      r['N11'] = 'N11';
    }
  }

  return rows;
}

export default applyN11Rule;
