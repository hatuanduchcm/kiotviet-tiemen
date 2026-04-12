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

## Danh sách các rule hiện có (thứ tự xử lý)

Trình tự xử lý hiện được sắp xếp theo yêu cầu: filter → add column → N11 → explode → split → merge → canvas-tier → final filter. Lưu ý: theo thứ tự này, N11 sẽ được tính dựa trên Đơn giá trước khi merge canvas vào sản phẩm (pre-merge). Explode (tách theo Số lượng) được thực hiện trước khi tách BỘ SUIT.

| STT | Rule con                                 | Mô tả                                                        | File liên quan                                         |
|-----|-------------------------------------------|--------------------------------------------------------------|--------------------------------------------------------|
| 1   | Filter columns từ KiotViet                | Lọc chỉ giữ các cột cần thiết ban đầu để đơn giản hoá dữ liệu | [filter-columns-kiotviet.md](filter-columns-kiotviet.md)      |
| 2   | (implicit) Ensure optional columns        | `filter` already includes optional columns (`N11`, `Ghi chú Canvas`) so explicit ensure step removed | `src/rules/filter-columns-kiotviet.ts` |
| 3   | N11 rule                                  | Gắn nhãn `N11` cho các dòng có Đơn giá >= ngưỡng (theo bảng trong `n11-rules.md`). Lưu ý: ở luồng này N11 dùng Đơn giá pre-merge. | [n11-rules.md](n11-rules.md) |
| 4   | Explode (tách theo Số lượng)               | Tách dòng có Số lượng > 1 thành nhiều dòng đơn vị (Số lượng = 1) và phân bổ các trường tổng | [explode-products-by-quantity.md](explode-products-by-quantity.md) |
| 5   | Tách BỘ SUIT thành JACKET & QUẦN TÂY      | Tách sản phẩm BỘ SUIT thành 2 dòng JACKET và QUẦN TÂY        | [split-bosuit-to-jacket-pants.md](split-bosuit-to-jacket-pants.md) |
| 6   | Merge Canvas vào JACKET/MĂNG TÔ           | Gộp thông tin canvas vào ÁO JACKET hoặc MĂNG TÔ nếu có; tính lại giá sản phẩm sau khi merge | [merge-canvas-to-jacket-manto.md](merge-canvas-to-jacket-manto.md) |
| 7   | Canvas-tier rules                          | Xác định loại Canvas (Full / Half) theo quy tắt: TB70 => "Full Canvas"; Mid-tier thresholds => "Half Canvas" (AJ >= 17.000.000; MT >= 22.100.000). | [canvas-tier-rules.md](canvas-tier-rules.md) |
| 8   | (Sau cùng) Final filter                    | Lọc lại theo header upload cố định                            | [explode-products-by-quantity.md](explode-products-by-quantity.md) |


---

## Ví dụ quy trình

- Viết file: `rules/explode-products-by-quantity.md` (mô tả logic tách sản phẩm)
- Sau đó mới viết: `rules/explode-products-by-quantity.js` (code thực hiện)

Bạn nên tuân thủ quy trình này để dễ bảo trì và mở rộng.
