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
