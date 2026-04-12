# Rule: Merge Canvas vào ÁO JACKET hoặc MĂNG TÔ

## Mục tiêu
- Nếu trong cùng một đơn hàng (cùng "Mã đặt hàng") có sản phẩm mã CTA09 hoặc CTA10, tên là "Half Canvas" hoặc "Full Canvas" thì merge thông tin canvas này vào sản phẩm ÁO JACKET hoặc MĂNG TÔ (nếu có).
- Thêm cột mới "Ghi chú Canvas" vào sản phẩm ÁO JACKET hoặc MĂNG TÔ, ghi giá trị canvas tương ứng.

## Định nghĩa
- **ÁO JACKET**: Sản phẩm có mã bắt đầu bằng "AJ" và tên chứa "ÁO JACKET".
- **MĂNG TÔ**: Sản phẩm có mã bắt đầu bằng "MT" và tên chứa "MĂNG TÔ".
- **Canvas**: Sản phẩm có mã CTA09 hoặc CTA10, tên là "Half Canvas" hoặc "Full Canvas".

## Cách merge
- Với mỗi đơn hàng:
  - Nếu có sản phẩm canvas, tìm sản phẩm ÁO JACKET hoặc MĂNG TÔ trong cùng đơn hàng.
  - Thêm cột "Ghi chú Canvas" vào sản phẩm đó, giá trị là tên canvas ("Half Canvas" hoặc "Full Canvas").
  - Xóa dòng sản phẩm canvas khỏi đơn hàng (nếu cần).

## Tính toán lại giá sau khi merge
Khi merge giá trị canvas vào sản phẩm chính, cần cập nhật các trường giá để phản ánh giá cộng lại và áp dụng giảm giá hiện có. Quy tắc tính như sau (áp dụng trước khi tính `Thành tiền`):

- Nếu sản phẩm canvas có giá riêng, cộng tất cả giá canvas vào `Đơn giá` sản phẩm chính:
  - `Đơn giá_mới = Đơn giá_sản_phẩm_chính + Σ Đơn giá_canvas`
  - Nếu không có giá canvas (hoặc canvas miễn phí), `Đơn giá_mới = Đơn giá_sản_phẩm_chính`.
- Áp dụng **Giảm giá** theo phần trăm (nếu trường `Giảm giá` đang lưu là %):
  - `Giá giảm (VND) = Đơn giá_mới * (Giảm giá% / 100)`
  - `Giá bán = Đơn giá_mới - Giá giảm`  (tương đương `Giá bán = Đơn giá_mới * (1 - Giảm giá% / 100)`)
- `Thành tiền = Giá bán * Số lượng`.

Ghi chú quan trọng:
- Nếu `Giảm giá` trong dữ liệu là một giá trị tuyệt đối (VND) thay vì %, giữ nguyên cách áp dụng như hiện tại — nhưng khuyến nghị chuẩn hoá `Giảm giá` thành phần trăm để xử lý hợp nhất giá dễ dàng.
- Nếu merge nhiều canvas vào cùng sản phẩm, cộng tất cả `Đơn giá_canvas` trước khi tính `Giảm giá`.
- Làm tròn các phép tính theo quy ước của hệ thống (ví dụ: làm tròn tới đồng gần nhất). Nếu cần phân phối phần dư khi tách `Thành tiền` cho nhiều dòng, dùng quy tắc phân bố đều hoặc ưu tiên dòng giá cao hơn.
- Cột "Ghi chú Canvas" không thay đổi giá trị giảm hoặc cách áp dụng giảm; nó chỉ ghi nhận loại canvas đã gộp.

### Ví dụ
| Mã SP  | Tên SP                                   |
|--------|------------------------------------------|
| CTA09  | Half Canvas                              |
| AJ0150 | ÁO JACKET - T.INGENIATOR - HELIOS' CLOTH |

Sau khi merge:
| Mã SP  | Tên SP                                   | Ghi chú Canvas |
|--------|------------------------------------------|----------------|
| AJ0150 | ÁO JACKET - T.INGENIATOR - HELIOS' CLOTH | Half Canvas    |


> Lưu ý:
> - Nếu có cả ÁO JACKET và MĂNG TÔ, ưu tiên merge vào ÁO JACKET trước.
> - Nếu có nhiều sản phẩm ÁO JACKET (hoặc MĂNG TÔ) và nhiều canvas, hãy merge canvas vào các sản phẩm có giá trị cao nhất trước (theo thứ tự giá giảm dần), cho tới khi hết canvas.
> - Có thể có n sản phẩm JACKET, n-y canvas; chỉ merge tối đa số lượng canvas vào các sản phẩm giá cao nhất.
