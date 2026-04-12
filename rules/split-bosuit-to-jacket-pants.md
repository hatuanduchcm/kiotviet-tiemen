
# Rule: Tách sản phẩm BỘ SUIT thành ÁO JACKET và QUẦN TÂY

## Mục tiêu
- Khi gặp sản phẩm có mã bắt đầu bằng "BS" và tên bắt đầu bằng "BỘ SUIT" (không phân biệt hoa thường), sẽ tách thành 2 sản phẩm:
  - ÁO JACKET (mã AJ~)
  - QUẦN TÂY (mã QT~)
- Các thông tin còn lại giữ nguyên, chỉ thay đổi mã và tên sản phẩm tương ứng.
- **Giá trị (Đơn giá, Giá bán, Thành tiền, v.v.) được chia lại:**
  - 80% cho ÁO JACKET
  - 20% cho QUẦN TÂY


## Định nghĩa
- **BỘ SUIT**: Sản phẩm có mã bắt đầu bằng "BS" và tên bắt đầu bằng "BỘ SUIT".
- **ÁO JACKET**: Sản phẩm có mã bắt đầu bằng "AJ" hoặc là kết quả tách từ BỘ SUIT.
- **QUẦN TÂY**: Sản phẩm có mã bắt đầu bằng "QT" hoặc là kết quả tách từ BỘ SUIT.


## Cách tách
- Với mỗi dòng sản phẩm BỘ SUIT:
  - Sinh ra 2 dòng mới:
    - 1 dòng: mã = "AJ" + mã gốc không có "BS", tên = thay "BỘ SUIT" thành "ÁO JACKET" trong tên gốc, các trường giá trị chia 80%.
    - 1 dòng: mã = "QT" + mã gốc không có "BS", tên = thay "BỘ SUIT" thành "QUẦN TÂY" trong tên gốc, các trường giá trị chia 20%.



### Ví dụ
| Mã SP   | Tên SP                                   | Đơn giá      |
|---------|------------------------------------------|--------------|
| BS0150  | BỘ SUIT - T.INGENIATOR - HELIOS' CLOTH   | 10,000,000   |

Tách thành:
| Mã SP   | Tên SP                                   | Đơn giá      |
|---------|------------------------------------------|--------------|
| AJ0150  | ÁO JACKET - T.INGENIATOR - HELIOS' CLOTH | 8,000,000    |
| QT0150  | QUẦN TÂY - T.INGENIATOR - HELIOS' CLOTH  | 2,000,000    |

> Lưu ý: Các thông tin khác giữ nguyên.
