// Common utilities for rules (dùng cho src/rules/*)

/**
 * Chuẩn hóa tên sản phẩm (bỏ khoảng trắng thừa, viết hoa đầu từ, ...)
 */
export function normalizeProductName(name) {
  return (name || '').replace(/\s+/g, ' ').trim();
}

/**
 * So sánh mã sản phẩm theo tiền tố (case-insensitive)
 */
export function hasPrefix(code, prefix) {
  return typeof code === 'string' && code.toUpperCase().startsWith(prefix.toUpperCase());
}

/**
 * Kiểm tra tên sản phẩm có chứa từ khóa (case-insensitive)
 */
export function nameIncludes(name, keyword) {
  return typeof name === 'string' && name.toUpperCase().includes(keyword.toUpperCase());
}

/**
 * Parse giá trị số từ chuỗi (bỏ ký tự đặc biệt, chuyển về số)
 */
export function parseNumber(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(val.toString().replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
}

module.exports = {
  normalizeProductName,
  hasPrefix,
  nameIncludes,
  parseNumber
};
