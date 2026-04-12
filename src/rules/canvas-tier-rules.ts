import { hasPrefix, nameIncludes, parseNumber } from './common.js';

/**
 * Apply canvas rules based on package/tier heuristics.
 * Priority (high -> low):
 *  1) TB70 rule: product name contains 'TB70' -> Full Canvas
 *  2) Existing 'Ghi chú Canvas' coming from accessory merge is preserved unless TB70 applies
 *  3) Mid-tier thresholds: AJ with Đơn giá >= 17_000_000 or MT with Đơn giá >= 22_100_000 -> Half Canvas
 *  4) N11 flag: if product's group/index is 11..20 (detected by NHÓM column or code suffix -11..-20) -> set 'N11' = 'Yes'
 *
 * The rule modifies rows in-place and returns the new array.
 */
export function applyCanvasTierRules(rows: any[]): any[] {
  const res: any[] = [];

  for (const row of rows) {
    const r = { ...row };
    const code = String(r['Mã hàng'] ?? '').toUpperCase();
    const name = String(r['Tên hàng'] ?? '');
    const unitPrice = parseNumber(r['Đơn giá']);

    let appliedRule: 'TB70' | 'MERGE' | 'MID' | null = null;

    // Detect existing merge-provided canvas note
    const existingCanvas = r['Ghi chú Canvas'] ? String(r['Ghi chú Canvas']).trim() : '';
    if (existingCanvas) appliedRule = 'MERGE';

    // 1) TB70 rule (highest). If name contains 'TB70', set Full Canvas and mark applied.
    if (name.toUpperCase().includes('TB70')) {
      r['Ghi chú Canvas'] = 'Full Canvas';
      appliedRule = 'TB70';
    } else {
      // 3) Mid-tier thresholds only apply if we don't already have a higher-priority rule
      // Check AJ (jacket) threshold
      if (!appliedRule || appliedRule === 'MERGE') {
        if (hasPrefix(code, 'AJ') && unitPrice >= 17_000_000) {
          // Only set if not already set by MERGE; if MERGE exists, keep it (unless TB70 matched above)
          if (!existingCanvas) {
            r['Ghi chú Canvas'] = 'Half Canvas';
            appliedRule = 'MID';
          }
        }

        // Check MT (măng tô) threshold
        if (hasPrefix(code, 'MT') && unitPrice >= 22_100_000) {
          if (!existingCanvas) {
            r['Ghi chú Canvas'] = 'Half Canvas';
            appliedRule = 'MID';
          }
        }
      }
    }

    // 4) N11 flag: determine group index from 'NHÓM' column or trailing -NN in code
    let groupIndex: number | null = null;
    const grp = r['NHÓM'] ?? r['Nhóm'] ?? r['nhóm'];
    if (grp != null && String(grp).trim() !== '') {
      const n = parseInt(String(grp).replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(n)) groupIndex = n;
    }

    if (groupIndex === null) {
      // try to extract trailing -NN or trailing number from code
      const m = code.match(/-(\d{1,3})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n)) groupIndex = n;
      } else {
        // try trailing digits in code
        const m2 = code.match(/(\d{1,3})$/);
        if (m2) {
          const n = parseInt(m2[1], 10);
          if (!Number.isNaN(n)) groupIndex = n;
        }
      }
    }

    if (groupIndex !== null && groupIndex >= 11 && groupIndex <= 20) {
      r['N11'] = 'Yes';
    }

    res.push(r);
  }

  return res;
}
