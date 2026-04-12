// Merge Canvas vào ÁO JACKET hoặc MĂNG TÔ
const { hasPrefix, nameIncludes, parseNumber } = require('./common');

function mergeCanvasToJacketManto(rows) {
  // Gom theo mã đặt hàng
  const grouped = {};
  for (const row of rows) {
    const key = row['Mã đặt hàng'] || '';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }
  const result = [];
  for (const groupRows of Object.values(grouped)) {
    // Tìm các canvas
    const canvasRows = groupRows.filter(r => (hasPrefix(r['Mã hàng'], 'CTA09') || hasPrefix(r['Mã hàng'], 'CTA10')) && (r['Tên hàng'] === 'Half Canvas' || r['Tên hàng'] === 'Full Canvas'));
    // Tìm các jacket/măng tô
    const jackets = groupRows.filter(r => hasPrefix(r['Mã hàng'], 'AJ') && nameIncludes(r['Tên hàng'], 'ÁO JACKET'));
    const mantos = groupRows.filter(r => hasPrefix(r['Mã hàng'], 'MT') && nameIncludes(r['Tên hàng'], 'MĂNG TÔ'));
    // Sắp xếp jacket/manto theo giá giảm dần
    jackets.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    mantos.sort((a, b) => parseNumber(b['Đơn giá']) - parseNumber(a['Đơn giá']));
    let canvasIdx = 0;
    // Merge vào jacket trước
    for (let i = 0; i < jackets.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      jackets[i]['Ghi chú Canvas'] = canvasRows[canvasIdx]['Tên hàng'];
    }
    // Merge vào manto nếu còn
    for (let i = 0; i < mantos.length && canvasIdx < canvasRows.length; i++, canvasIdx++) {
      mantos[i]['Ghi chú Canvas'] = canvasRows[canvasIdx]['Tên hàng'];
    }
    // Loại bỏ dòng canvas
    for (const r of groupRows) {
      if (!canvasRows.includes(r)) result.push(r);
    }
  }
  return result;
}

module.exports = { mergeCanvasToJacketManto };
