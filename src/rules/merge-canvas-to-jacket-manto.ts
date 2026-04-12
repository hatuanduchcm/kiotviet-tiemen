import { hasPrefix, nameIncludes, parseNumber, detectProductCategory } from './common.js';

export function mergeCanvasToJacketManto(rows: any[]): any[] {
  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    const key = row?.['Mã đặt hàng'] || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  const result: any[] = [];
  for (const groupRows of Object.values(grouped)) {
    const canvasRows = groupRows.filter(
      (r) =>
        (hasPrefix(r['Mã hàng'], 'CTA09') || hasPrefix(r['Mã hàng'], 'CTA10')) &&
        (r['Tên hàng'] === 'Half Canvas' || r['Tên hàng'] === 'Full Canvas')
    );
    const jackets = groupRows.filter((r) => detectProductCategory(r['Mã hàng'], r['Tên hàng']) === 'JACKET');
    const mantos = groupRows.filter((r) => detectProductCategory(r['Mã hàng'], r['Tên hàng']) === 'MANTO');
    jackets.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    mantos.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    let canvasIdx = 0;
    // Merge into jackets first, then mantos. For each merge, recalculate prices.
    for (let i = 0; i < jackets.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      const target = jackets[i];
      const canvas = canvasRows[canvasIdx];
      // set canvas note (if already present, keep it or append)
      target['Ghi chú Canvas'] = canvas['Tên hàng'];

      // Recalculate prices: Đơn giá_mới = Đơn giá_target + Đơn giá_canvas
      const baseUnit = parseNumber(target['Đơn giá']);
      const canvasUnit = parseNumber(canvas['Đơn giá']);
      const newUnit = baseUnit + canvasUnit;

      // Prefer percent discount if present
      const discountPct = parseNumber(target['Giảm giá %']);
      let discountValue = 0;
      if (discountPct && discountPct > 0) {
        discountValue = Math.round(newUnit * (discountPct / 100));
      } else {
        // fallback to absolute discount if provided
        discountValue = parseNumber(target['Giảm giá']);
      }

      const newPrice = newUnit - discountValue;
      const qty = Number(parseInt(String(target['Số lượng'] ?? '1'), 10)) || 1;
      const lineTotal = newPrice * qty;

      target['Đơn giá'] = newUnit;
      target['Giảm giá'] = discountValue;
      target['Giá bán'] = newPrice;
      target['Thành tiền'] = lineTotal;
    }
    for (let i = 0; i < mantos.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      const target = mantos[i];
      const canvas = canvasRows[canvasIdx];
      target['Ghi chú Canvas'] = canvas['Tên hàng'];

      const baseUnit = parseNumber(target['Đơn giá']);
      const canvasUnit = parseNumber(canvas['Đơn giá']);
      const newUnit = baseUnit + canvasUnit;

      const discountPct = parseNumber(target['Giảm giá %']);
      let discountValue = 0;
      if (discountPct && discountPct > 0) {
        discountValue = Math.round(newUnit * (discountPct / 100));
      } else {
        discountValue = parseNumber(target['Giảm giá']);
      }

      const newPrice = newUnit - discountValue;
      const qty = Number(parseInt(String(target['Số lượng'] ?? '1'), 10)) || 1;
      const lineTotal = newPrice * qty;

      target['Đơn giá'] = newUnit;
      target['Giảm giá'] = discountValue;
      target['Giá bán'] = newPrice;
      target['Thành tiền'] = lineTotal;
    }
    for (const r of groupRows) {
      if (!canvasRows.includes(r)) result.push(r);
    }
  }
  return result;
}
