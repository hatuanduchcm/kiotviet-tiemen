import { hasPrefix, detectProductCategory } from './common.js';

// Tách BỘ SUIT thành ÁO JACKET và QUẦN TÂY, chia giá trị 80/20
export function splitBoSuitToJacketPants(rows: any[]): any[] {
  const result: any[] = [];
  for (const row of rows) {
  if (detectProductCategory(row?.['Mã hàng'], row?.['Tên hàng']) === 'SUIT' && typeof row?.['Tên hàng'] === 'string' && row['Tên hàng'].toUpperCase().startsWith('BỘ SUIT')) {
  // Only split source unit price and line total. Leave 'Giá bán' to be recomputed later
  // so that discounts (percent or absolute) are applied consistently per resulting row.
  const fieldsToSplit = ['Đơn giá','Thành tiền'];
      const jacket = { ...row };
      const pants = { ...row };
      jacket['Mã hàng'] = String(row['Mã hàng']).replace(/^BS/i, 'AJ');
      jacket['Tên hàng'] = String(row['Tên hàng']).replace(/BỘ SUIT/i, 'ÁO JACKET');
      pants['Mã hàng'] = String(row['Mã hàng']).replace(/^BS/i, 'QT');
      pants['Tên hàng'] = String(row['Tên hàng']).replace(/BỘ SUIT/i, 'QUẦN TÂY');
      for (const f of fieldsToSplit) {
        if (row[f] != null) {
          const val = parseFloat(String(row[f]).replace(/[^\d.-]/g, '')) || 0;
          jacket[f] = Math.round(val * 0.8);
          pants[f] = Math.round(val * 0.2);
        }
      }
      result.push(jacket, pants);
    } else {
      result.push(row);
    }
  }
  return result;
}
