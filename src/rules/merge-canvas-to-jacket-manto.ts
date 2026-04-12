import { hasPrefix, nameIncludes, parseNumber } from './common.js';

export function mergeCanvasToJacketManto(rows: any[]): any[] {
  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    const key = row?.['Mã đặt hàng'] || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  const result: any[] = [];
  for (const groupRows of Object.values(grouped)) {
    const canvasRows = groupRows.filter(r => (hasPrefix(r['Mã hàng'], 'CTA09') || hasPrefix(r['Mã hàng'], 'CTA10')) && (r['Tên hàng'] === 'Half Canvas' || r['Tên hàng'] === 'Full Canvas'));
    const jackets = groupRows.filter(r => hasPrefix(r['Mã hàng'], 'AJ') && nameIncludes(r['Tên hàng'], 'ÁO JACKET'));
    const mantos = groupRows.filter(r => hasPrefix(r['Mã hàng'], 'MT') && nameIncludes(r['Tên hàng'], 'MĂNG TÔ'));
    jackets.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    mantos.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    let canvasIdx = 0;
    for (let i = 0; i < jackets.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      jackets[i]['Ghi chú Canvas'] = canvasRows[canvasIdx]['Tên hàng'];
    }
    for (let i = 0; i < mantos.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      mantos[i]['Ghi chú Canvas'] = canvasRows[canvasIdx]['Tên hàng'];
    }
    for (const r of groupRows) {
      if (!canvasRows.includes(r)) result.push(r);
    }
  }
  return result;
}
