# Ngưỡng N11 — danh sách giá bắt đầu áp dụng "N11"

Các sản phẩm có đơn giá >= ngưỡng bên dưới sẽ được gắn nhãn **N11** trong cột `N11`.

| Sản phẩm | Ngưỡng N11 (VND) |
|----------|------------------:|
| SUIT     | 38.200.000 đ      |
| JACKET (Áo Jacket) | 31.900.000 đ |
| MĂNG TÔ  | 41.500.000 đ      |
| GILE     | 10.600.000 đ      |
| QUẦN    | 10.000.000 đ      |
| SƠ MI    | 12.100.000 đ      |

Ghi chú: so sánh dựa trên **Đơn giá** (hoặc trường giá bạn đang dùng trong pipeline). Nếu giá sản phẩm lớn hơn hoặc bằng ngưỡng tương ứng, rule N11 sẽ thêm chuỗi "N11" vào cột `N11`.