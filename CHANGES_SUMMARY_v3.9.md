# 📋 BÁO CÁO NÂNG CẤP & HOÀN THIỆN PHIÊN BẢN (v3.9.1)

> **Phiên bản:** v3.9.1  
> **Nội dung trọng tâm:**  
> 1. **Bỏ hoàn toàn nền card phía sau bảng, tối ưu bảng hiển thị trực tiếp trên trang chuẩn Microsoft Word**  
> 2. **Tính năng kéo chỉnh độ rộng từng cột (Column Resizer) & Chuyển đổi khung bảng (Full-width / Fit)**  
> 3. **Hệ thống hiển thị & quản lý phiên bản tập trung (Version Control & Update Checker)**  
> **Thời gian cập nhật:** 2026-10-09  

---

## 1. Khắc phục triệt để khung nền bảng & Tối ưu hóa như Word

### 🛑 Vấn đề trước khi sửa
- Bảng bị đặt trong một chiếc hộp card trắng (`table-block-container`) có viền, bo góc và màu nền card dày cộp bao quanh, tạo khoảng trống thừa thãi trên và dưới khiến bảng bị cô lập, thiếu tự nhiên.
- Không thể điều chỉnh độ rộng từng cột bằng chuột như Word.
- Thanh chân bảng nét đứt to chiếm diện tích.

### ✨ Cải tiến mới trong v3.9.1 (Chuẩn Microsoft Word)
1. **Xóa bỏ 100% khung nền card phía sau**:
   - Khung bao ngoài được chuyển thành `background: transparent`, `border: none`, `box-shadow: none`, `padding: 0`.
   - Bảng hiển thị **trực tiếp trên nền trang tài liệu**, các ô có đường kẻ ô sắc nét, vừa vặn, không còn bất kỳ khoảng trống vô lý nào bao quanh.
2. **Kéo chỉnh độ rộng từng cột (Column Resizer như Word)**:
   - Ở hàng đầu tiên, mỗi vách ngăn giữa các cột đều có thanh kéo điều chỉnh.
   - Khi rê chuột vào vách ngăn, con trỏ đổi thành `col-resize` — người dùng chỉ cần giữ và kéo sang trái/phải để nới rộng hoặc thu hẹp từng cột tự do.
   - Kích thước từng cột được tự động lưu lại vào dữ liệu ghi chú.
3. **Chuyển đổi chế độ khung bảng (Frame Width Mode)**:
   - Trên thanh toolbar mini có nút **"Khung: 100% / Fit"**:
     - `100%`: Bảng trải dài toàn bộ chiều rộng trang tài liệu.
     - `Fit`: Khung bảng tự động thu gọn vừa khít với nội dung chữ trong ô.
4. **Toolbar nổi mini Word-style**:
   - Nằm sát mép trên góc phải khi hover/focus, không chiếm không gian ghi chép.
   - Đầy đủ chức năng: Đổi khung, Bật/tắt tiêu đề, Thêm/xóa dòng & cột, Sao chép Markdown, Xóa bảng.
5. **Thêm dòng/cột thông minh**:
   - Nút `+` nhỏ gọn xuất hiện ở mép phải (thêm cột) và mép dưới (thêm dòng).
   - Ở ô cuối cùng, chỉ cần nhấn <kbd>Tab</kbd> hoặc <kbd>Enter</kbd> là tự động sinh thêm dòng mới tức thì.

---

## 2. Hệ thống kiểm soát & hiển thị phiên bản (Version System)

1. **Sidebar chính**: Hiển thị huy hiệu `Personal • v3.9` nổi bật dưới tên sổ tay.
2. **Mini Note Header**: Hiển thị huy hiệu `v3.9` cạnh logo `⚡ Mini Note`.
3. **Cài đặt (Settings Modal)**: Hiển thị `Phiên bản đang chạy: v3.9`, trạng thái hoạt động và nút **"Kiểm tra & Cập nhật ngay"** (xóa sạch cache Service Worker và nạp bản mới trong 1 giây).
4. **Tự động báo bản mới**: Service Worker tự động hiện thông báo Toast khi có mã nguồn mới.
