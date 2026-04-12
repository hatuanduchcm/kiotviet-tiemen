import { parseNumber, hasPrefix, nameIncludes } from './common.js';
import N11_THRESHOLDS from './n11-thresholds.js';

/**
 * Apply N11 flag to rows.
 * - For each row, detect product category heuristically from `Mã hàng` and `Tên hàng`.
 * - If `Đơn giá` >= configured threshold for that category, set column `N11` = 'N11'.
 */
export function applyN11Rule(rows: any[]): any[] {
  for (const r of rows) {
    const code = String(r?.['Mã hàng'] ?? '');
    const name = String(r?.['Tên hàng'] ?? '');
    const unit = parseNumber(r?.['Đơn giá']);

    let threshold: number | null = null;

    // Heuristics to find category -> threshold
    if (hasPrefix(code, 'AJ') || nameIncludes(name, 'ÁO JACKET') || nameIncludes(name, 'JACKET')) {
      threshold = N11_THRESHOLDS.JACKET;
    } else if (hasPrefix(code, 'MT') || nameIncludes(name, 'MĂNG TÔ') || nameIncludes(name, 'MANTO')) {
      threshold = N11_THRESHOLDS.MANTO;
    } else if (nameIncludes(name, 'BỘ SUIT') || nameIncludes(name, 'SUIT') || hasPrefix(code, 'SU')) {
      threshold = N11_THRESHOLDS.SUIT;
    } else if (nameIncludes(name, 'GILE')) {
      threshold = N11_THRESHOLDS.GILE;
    } else if (nameIncludes(name, 'QUẦN') || nameIncludes(name, 'PANTS') || hasPrefix(code, 'QT')) {
      threshold = N11_THRESHOLDS.QUAN;
    } else if (nameIncludes(name, 'SƠ MI') || nameIncludes(name, 'SOMI') || hasPrefix(code, 'SM')) {
      threshold = N11_THRESHOLDS.SOMI;
    }

    if (threshold != null && unit >= threshold) {
      r['N11'] = 'N11';
    }
  }

  return rows;
}

export default applyN11Rule;
