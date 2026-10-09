# 📋 BÁO CÁO NÂNG CẤP & HOÀN THIỆN PHIÊN BẢN (v3.9.2)

> **Phiên bản:** v3.9.2  
> **Nội dung trọng tâm:**  
> 1. **Khắc phục triệt để lỗi nền xanh chọn khối bao quanh bảng & chặn thanh công cụ chữ che khuất bảng**  
> 2. **Nâng cấp kéo chỉnh kích thước khung bảng tự do ở góc dưới phải (Table Corner Resizer như Microsoft Word)**  
> 3. **Bộ kéo chỉnh độ rộng từng cột chuẩn xác với đường gióng dọc (Column Guide Line) & Layout cố định không lỗi**  
> 4. **Xóa bỏ hiện tượng thanh cuộn ngang giả đáy bảng**  
> **Thời gian cập nhật:** 2026-10-09  

---

## 1. Khắc phục các lỗi hiển thị & Điều chỉnh khung bảng (v3.9.2)

### 🛑 Vấn đề người dùng phản hồi ("lỗi quá, vẫn o điều chỉnh đc", "chỉ cần bảng thôi nền sau bỏ đc ko")
- **Hiện tượng nền xanh bao quanh bảng**: Khi người dùng nhấp vào bảng hoặc biểu tượng kéo thả bên trái, toàn bộ khối bảng bị áp dụng hiệu ứng `.block-wrapper.is-block-selected` làm một mảng màu xanh dương lớn bao quanh toàn bộ bảng, khiến người dùng lầm tưởng bảng vẫn còn nền card dày cộp phía sau.
- **Thanh menu bôi đen chữ che khuất bảng**: `#floating-toolbar` (với nút "Bảng (Table)", các nút định dạng chữ và thẻ "Thêm vào Kho Từ vựng") tự động bật lên đè trực tiếp lên hàng cuối và thanh cuộn của bảng, gây cản trở thao tác.
- **Thanh kéo cột bị lỗi/không kéo được**: Do bảng dùng `border-collapse: collapse`, phần tử resizer bị lỗi chiều cao (`height: 0px`) trong trình duyệt, đồng thời sự kiện rê chuột bị cơ chế bôi đen nhiều dòng của editor chặn lại.
- **Thanh cuộn ngang `< >` xuất hiện vô lý**: Do resizer ở cột cuối nhô ra ngoài 3px khiến trình duyệt tưởng có tràn viền ngang và hiện thanh cuộn.

---

### ✨ Giải pháp & Cải tiến trong v3.9.2 (Chuẩn Microsoft Word)

1. **Triệt tiêu 100% màu nền xanh chọn khối cho bảng**:
   - Áp dụng quy tắc ghi đè `.block-wrapper[data-type="table"].is-block-selected { background: transparent !important; outline: none !important; }`.
   - Bảng hòa tan hoàn toàn vào trang giấy như Word, không xuất hiện bất kỳ khung màu xanh nào phía sau khi nhấp chuột.

2. **Chặn thanh menu bôi đen chữ che khuất bảng**:
   - Khi chọn ô bảng hoặc thao tác trong bảng, `#floating-toolbar` tự động ẩn để nhường không gian cho bảng.
   - Bảng sử dụng thanh công cụ nổi tinh tế riêng ở góc trên (`.table-floating-toolbar`) chỉ xuất hiện khi cần.

3. **Thanh kéo chỉnh kích thước khung bảng ở góc dưới bên phải (`table-corner-resizer`)**:
   - Đặt icon kéo `⤡` ở đúng góc dưới bên phải của bảng (chuẩn Microsoft Word).
   - Người dùng chỉ cần giữ và kéo sang trái/phải để phóng to, thu nhỏ hoặc co giãn toàn bộ chiều rộng khung bảng tùy ý.
   - Tự động chuyển trạng thái sang "Khung: Tùy chỉnh" và lưu kích thước chuẩn pixel.

4. **Kéo chỉnh độ rộng từng cột cực kỳ mượt mà & Có đường gióng dọc**:
   - Chuyển sang mô hình `<colgroup><col>` chuẩn W3C kết hợp `border-collapse: separate; border-spacing: 0;`.
   - Khi kéo vách ngăn cột, một đường kẻ màu xanh dọc (`.table-resize-guide`) chạy suốt chiều cao bảng theo con trỏ chuột (như Word và Google Docs), hiển thị chính xác vị trí mới của cột.
   - Thao tác kéo cột được tách biệt hoàn toàn khỏi cơ chế chọn khối của editor.

5. **Xử lý sạch sẽ thanh cuộn ngang**:
   - Cột cuối cùng giữ resizer gọn gàng bên trong viền (`right: 0`), không tạo tràn viền giả lập.
   - Bảng 100% hay Fit đều phẳng phiu, sạch sẽ và sắc nét.

---

## 2. Hệ thống kiểm soát & hiển thị phiên bản (Version System)

1. **Sidebar chính**: Hiển thị huy hiệu `Personal • v3.9.2` nổi bật dưới tên sổ tay.
2. **Cài đặt (Settings Modal)**: Hiển thị `Phiên bản đang chạy: v3.9.2`, trạng thái hoạt động và nút **"Kiểm tra & Cập nhật ngay"** (xóa sạch cache Service Worker và nạp bản mới tức thì).
3. **PWA & Service Worker**: Cache name nâng cấp lên `schooldb-v3.9.2` với query bust cache đầy đủ trên toàn bộ file tài nguyên.
