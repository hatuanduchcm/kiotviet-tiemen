# Rule tổng hợp & hướng dẫn xây dựng rule xử lý đơn hàng

File này là trung tâm quản lý các rule xử lý đơn hàng, đồng thời hướng dẫn quy trình xây dựng và mở rộng rule.

## Quy trình xây dựng rule

1. **Viết file hướng dẫn (markdown) cho từng rule**
	- Mô tả mục tiêu, logic, các trường dữ liệu liên quan, ví dụ input/output.
	- Đặt tên file rõ ràng, ví dụ: `explode-products-by-quantity.md`.

2. **Viết code thực hiện rule**
	- Sau khi đã rõ logic và các trường cần xử lý, mới bắt đầu code.
	- Đặt tên file code tương ứng, ví dụ: `explode-products-by-quantity.js`.

3. **(Nếu cần) Viết thêm test hoặc ví dụ minh họa**
	- Để kiểm tra rule hoạt động đúng.

4. **Cập nhật file tổng hợp rule (README.md này)**
	- Thêm link tới file hướng dẫn và file code.

### Lưu ý
- Nên tách biệt rõ phần mô tả (markdown) và phần code.
- Khi cần sửa logic, hãy cập nhật file hướng dẫn trước, sau đó mới sửa code.
- Nếu rule không còn dùng, hãy xóa cả file code và file hướng dẫn, đồng thời cập nhật lại README.md này.

---

## Danh sách các rule hiện có

| Rule con                                 | Mô tả                                                        | File liên quan                                         |
|-------------------------------------------|--------------------------------------------------------------|--------------------------------------------------------|
| Filter column từ KiotViet                 | Lọc chỉ giữ các cột cần thiết                                | [filter-columns-kiotviet.md](filter-columns-kiotviet.md)      |
| Tách sản phẩm thành từng dòng số lượng 1  | Tách dòng có Số lượng > 1 thành nhiều dòng, tính lại Đơn giá | [explode-products-by-quantity.md](explode-products-by-quantity.md) |
| Tách BỘ SUIT thành JACKET & QUẦN TÂY      | Tách sản phẩm BỘ SUIT thành 2 dòng JACKET và QUẦN TÂY        | [split-bosuit-to-jacket-pants.md](split-bosuit-to-jacket-pants.md) |
| Merge Canvas vào JACKET/MĂNG TÔ           | Gộp thông tin canvas vào ÁO JACKET hoặc MĂNG TÔ nếu có        | [merge-canvas-to-jacket-manto.md](merge-canvas-to-jacket-manto.md) |
| ...                                       | ...                                                          | ...                                                    |

---

## Ví dụ quy trình

- Viết file: `rules/explode-products-by-quantity.md` (mô tả logic tách sản phẩm)
- Sau đó mới viết: `rules/explode-products-by-quantity.js` (code thực hiện)

Bạn nên tuân thủ quy trình này để dễ bảo trì và mở rộng.
