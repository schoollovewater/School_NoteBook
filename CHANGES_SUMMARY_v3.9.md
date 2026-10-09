# 📋 BÁO CÁO NÂNG CẤP & HOÀN THIỆN PHIÊN BẢN (v3.9)

> **Phiên bản:** v3.9  
> **Nội dung trọng tâm:**  
> 1. **Khắc phục triệt để giao diện khối bảng rườm rà (Notion-style Table Block Redesign)**  
> 2. **Triển khai hệ thống hiển thị & kiểm soát phiên bản tập trung (Version Control & Update Checker)**  
> **Thời gian cập nhật:** 2026-10-09  

---

## 1. Khắc phục giao diện khối Bảng (Table Block) rườm rà

### 🛑 Vấn đề trước khi sửa
- **Thanh công cụ cố định cồng kềnh**: Bảng luôn có một thanh toolbar gồm 7 nút bấm to đùng chiếm diện tích phía trên bảng, khiến ghi chú trông như bảng tính Excel nặng nề.
- **Thanh chân bảng nét đứt thô**: Thanh `+ Thêm dòng` với viền gạch đứt to chiếm diện tích.
- **Gạch chân màu xanh chói**: Hàng tiêu đề có một đường viền `2px solid var(--accent)` màu xanh dương đậm rất cứng nhắc.

### ✨ Cải tiến mới trong v3.9
1. **Floating Micro-Toolbar (Thanh công cụ nổi tự ẩn - Chuẩn phong cách Notion)**:
   - Bình thường khi đọc hoặc ghi chú, thanh công cụ **ẩn hoàn toàn**, trả lại giao diện bảng tối giản, tinh tế và đẹp mắt.
   - Khi **rê chuột (hover)** vào bảng hoặc **click/focus** vào bất kỳ ô nào, thanh công cụ tự động hiện lên góc trên bên phải dạng thanh viên thuốc (floating pill) với hiệu ứng làm mờ nền (backdrop blur) hiện đại.
   - Trên màn hình nhỏ / điện thoại: Tự động co gọn thành các biểu tượng icon tinh tế để không bị tràn màn hình.
2. **Nút thêm cột trực quan bên phải (+)**:
   - Thêm nút `+` mảnh mai ở mép phải của bảng (chỉ hiện khi rê chuột), bấm vào là thêm ngay 1 cột mới mà không cần tìm nút trên menu.
3. **Chân bảng tối giản (+ Thêm dòng & Phím tắt)**:
   - Nút `+ Thêm dòng` thanh mảnh ở góc dưới, đi kèm gợi ý phím tắt `Tab` và `Enter`.
   - Giữ nguyên tính năng phím tắt thông minh: Bấm `Tab` ở ô cuối bảng hoặc `Enter` ở dòng cuối sẽ tự động sinh thêm dòng mới tức thì.
4. **Phong cách màu sắc & đường viền tinh tế**:
   - Loại bỏ đường gạch xanh chói, thay bằng viền phân cách mỏng nhẹ nhàng và nền tiêu đề mờ nhã nhặn.

---

## 2. Hệ thống kiểm soát & hiển thị phiên bản (Version System)

### 🛑 Vấn đề trước khi sửa
- Người dùng không có cách nào biết ứng dụng đang chạy ở phiên bản nào, hoặc mã nguồn trên máy đã cập nhật bản mới chưa hay vẫn bị kẹt cache của Service Worker / Trình duyệt.

### ✨ Cải tiến mới trong v3.9
1. **Hiển thị trực quan ở Sidebar**:
   - Ngay dưới tên sổ tay ở menu trái, hiển thị huy hiệu phiên bản nổi bật: `Personal • v3.9`.
2. **Hiển thị trên Mini Note (Ghi nhanh)**:
   - Trên thanh Header của `mini.html`, hiển thị huy hiệu `v3.9` cạnh logo `⚡ Mini Note`.
3. **Khu vực Quản lý phiên bản trong Cài đặt (Settings Modal)**:
   - Hiển thị: `Phiên bản đang chạy: v3.9` cùng trạng thái `Đã nạp mới nhất`.
   - **Nút "Kiểm tra & Cập nhật ngay"**: Người dùng chỉ cần bấm nút này để tự động xóa toàn bộ cache Service Worker cũ và nạp lại mã nguồn mới nhất chỉ trong 1 giây mà không cần thao tác kỹ thuật phức tạp.
4. **Tự động nhận diện bản cập nhật mới**:
   - Service Worker phát hiện khi có mã nguồn mới được đẩy lên và tự động kích hoạt thông báo Toast: *"🚀 Đã có phiên bản cập nhật mới! Nhấn để làm mới trang."*
