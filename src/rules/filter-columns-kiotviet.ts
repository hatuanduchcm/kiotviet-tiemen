// Lọc các cột cần thiết từ dữ liệu đơn hàng KiotViet
export const COLUMNS_TO_KEEP = [
  // STT is a sequential index populated before final upload
  'STT',
  'Chi nhánh xử lý','Mã đặt hàng','Thời gian tạo','Mã khách hàng','Tên khách hàng','Điện thoại','Người nhận đặt','Kênh bán','Ghi chú','Ghi chú hàng hóa','Tổng tiền hàng','Thu khác','Giảm giá phiếu đặt','Khách cần trả','Khách đã trả',
  // Product identification columns
  'Mã hàng','Tên hàng','Thương hiệu',
  // Optional product-level notes we want immediately after product identification
  'Ghi chú Canvas','N11',
  // Remaining order/product numeric columns
  'Số lượng','Đơn giá','Giảm giá %','Giảm giá','Giá bán','Thành tiền'
];

export function filterColumnsKiotViet(rows: any[]): any[] {
  return rows.map(row => {
    const filtered: Record<string, any> = {};
    for (const col of COLUMNS_TO_KEEP) {
      filtered[col] = row?.[col] ?? '';
    }
    return filtered;
  });
}
