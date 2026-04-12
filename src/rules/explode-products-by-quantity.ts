import { parseNumber } from './common.js';

// Split rows where 'Số lượng' > 1 into multiple rows with quantity 1.
// Numeric totals (e.g., 'Thành tiền', 'Giảm giá') are divided evenly across the split rows.
export function explodeProductsByQuantity(rows: any[]): any[] {
  const result: any[] = [];

  for (const row of rows) {
    const rawQty = row?.['Số lượng'];
    const qty = Number(parseInt(String(rawQty || '0'), 10)) || 0;

    if (!qty || qty <= 1) {
      result.push(row);
      continue;
    }

    // Determine numeric fields to split (totals). Keep unit fields as-is if present.
    const totalFields = ['Thành tiền', 'Giảm giá', 'Giá bán'];
    const unitFields = ['Đơn giá'];

    // Parse totals
    const totals: Record<string, number> = {};
    for (const f of totalFields) totals[f] = parseNumber(row?.[f]);

    // Compute per-unit totals (rounding; distribute remainder to first copies)
    const perUnit: Record<string, number> = {};
    const remainders: Record<string, number> = {};
    for (const f of totalFields) {
      const v = totals[f];
      const unit = Math.floor(v / qty);
      perUnit[f] = unit;
      remainders[f] = v - unit * qty; // remainder to distribute
    }

    // For each unit, clone row and assign unit-level values
    for (let i = 0; i < qty; i++) {
      const r = { ...row };
      r['Số lượng'] = 1;
      for (const f of totalFields) {
        // distribute any remainder into the earliest items
        const add = i < remainders[f] ? 1 : 0;
        r[f] = perUnit[f] + add;
      }

      // For unitFields, prefer existing Đơn giá; if missing, derive from Thành tiền
      for (const uf of unitFields) {
        if (r[uf] == null || r[uf] === '') {
          const unitPrice = perUnit['Thành tiền'] && perUnit['Thành tiền'] > 0 ? perUnit['Thành tiền'] : parseNumber(r[uf]);
          r[uf] = unitPrice;
        }
      }

      result.push(r);
    }
  }

  return result;
}
