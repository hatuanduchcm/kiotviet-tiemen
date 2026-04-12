// Rule: Tách từng sản phẩm thành dòng riêng, mỗi dòng số lượng = 1
// Sau khi tách, tính lại "Giảm giá" và "Thành tiền" theo "Giảm giá %", "Đơn giá", "Số lượng"
const { parseNumber } = require('./common');

/**
 * Tách các dòng có Số lượng > 1 thành nhiều dòng, mỗi dòng số lượng = 1.
 * Tính lại Giảm giá và Thành tiền cho từng dòng.
 * @param {Array<Object>} rows - Dữ liệu các dòng đơn hàng
 * @returns {Array<Object>} - Dữ liệu đã tách dòng
 */
function explodeProductsByQuantity(rows) {
  const result = [];
  for (const row of rows) {
    const soLuong = parseInt(row['Số lượng'] ?? 1, 10) || 1;
    const donGia = parseNumber(row['Đơn giá']);
    const giamGiaPhanTram = parseNumber(row['Giảm giá %']);
    for (let i = 0; i < soLuong; i++) {
      const giamGia = Math.round(donGia * giamGiaPhanTram / 100);
      const thanhTien = donGia - giamGia;
      result.push({
        ...row,
        'Số lượng': 1,
        'Giảm giá': giamGia,
        'Thành tiền': thanhTien
      });
    }
  }
  return result;
}

module.exports = {
  explodeProductsByQuantity
};
