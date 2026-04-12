import { parseNumber } from './common.js';

/**
 * Recompute per-row price fields deterministically:
 * - Đơn giá: numeric
 * - Giảm giá %: numeric percent
 * - Giảm giá: absolute numeric
 * - Giá bán = Đơn giá - (percent ? round(Đơn giá * pct) : Giảm giá)
 * - Thành tiền = Giá bán * Số lượng
 *
 * This avoids accidental overwrites and ensures Giá bán/Thành tiền stay consistent.
 */
export function recomputePrices(rows: any[]): any[] {
  return rows.map((r) => {
    const out = { ...r };
    const unit = parseNumber(out['Đơn giá']);
    const qty = Number(parseInt(String(out['Số lượng'] ?? '1'), 10)) || 1;
    const pct = parseNumber(out['Giảm giá %']);
    const absDiscount = parseNumber(out['Giảm giá']);

    let discountValue = 0;
    if (pct && pct > 0) {
      discountValue = Math.round(unit * (pct / 100));
    } else if (absDiscount && absDiscount > 0) {
      // If absolute discount looks like a line-level discount, use it.
      discountValue = absDiscount;
    }

    const price = Math.round(unit - discountValue);
    const lineTotal = price * qty;

    out['Đơn giá'] = unit;
    out['Giảm giá'] = discountValue;
    out['Giá bán'] = price;
    out['Thành tiền'] = lineTotal;

    return out;
  });
}

export default recomputePrices;
