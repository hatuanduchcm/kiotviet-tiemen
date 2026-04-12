# Rule: Tách sản phẩm thành từng dòng số lượng 1

Nếu "Số lượng" > 1 thì tách thành nhiều dòng, mỗi dòng số lượng = 1.

Sau khi tách, cần tính lại:
- **Giảm giá** = Đơn giá × Giảm giá % / 100
- **Thành tiền** = Đơn giá - Giảm giá

Ví dụ: Nếu "Số lượng" là 3, sẽ tạo ra 3 dòng giống nhau, mỗi dòng số lượng = 1, mỗi dòng đều tính lại Giảm giá và Thành tiền theo công thức trên.

Bạn có thể chỉnh sửa rule này tại file `src/rules/explode-products-by-quantity.js`.
