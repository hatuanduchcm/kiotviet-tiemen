// Lọc các cột cần thiết từ dữ liệu đơn hàng KiotViet
export const COLUMNS_TO_KEEP = [
  'Chi nhánh xử lý','Mã đặt hàng','Thời gian tạo','Mã khách hàng','Tên khách hàng','Điện thoại','Người nhận đặt','Kênh bán','Ghi chú','Tổng tiền hàng','Thu khác','Giảm giá phiếu đặt','Khách cần trả','Khách đã trả','Mã hàng','Tên hàng','Thương hiệu','Số lượng','Đơn giá','Giảm giá %','Giảm giá','Giá bán','Thành tiền'
];

export function filterColumnsKiotViet(rows) {
  return rows.map(row => {
    const filtered = {};
    for (const col of COLUMNS_TO_KEEP) {
      filtered[col] = row[col] ?? '';
    }
    return filtered;
  });
}


