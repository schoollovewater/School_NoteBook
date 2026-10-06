# 📋 BÁO CÁO NÂNG CẤP & KHẮC PHỤC TRIỆT ĐỂ LỖI TRÌNH SOẠN THẢO (v3.2)

> **Dự án:** School NoteBook  
> **Thời gian cập nhật:** 06/10/2026  
> **Phiên bản:** v3.2  
> **Trạng thái dữ liệu:** An toàn 100% (bảo lưu toàn bộ ghi chú trên localStorage và Firestore)

---

## 1. Tổng hợp 5 vấn đề và Giải pháp xử lý

| STT | Vấn đề phản hồi | Nguyên nhân kỹ thuật | Giải pháp khắc phục triệt để |
|---|---|---|---|
| 1 | **Không Ctrl+Z / Ctrl+Y được** | • Service Worker (`sw.js`) cache cứng file cũ `v3.0`<br>• Khai báo lặp `let activeBlockId` che khuất biến toàn cục<br>• `handleBlockInput` không truyền đối tượng sự kiện `e` sang `recordTyping(e)`<br>• Sự kiện `keydown` chặn phím của form input chuẩn | • Nâng cấp cache Service Worker lên `schooldb-v3.2` + bypass cache mạng trực tiếp trên localhost<br>• Đồng bộ `activeBlockId` module-level<br>• Nhận diện ngắt từ (dấu cách, chấm, phẩy) và ghi snapshot trước khi gõ<br>• Cho phép native undo hoạt động bình thường trên `<input>` và `<textarea>` |
| 2 | **Không xoá được nguyên 1 dòng có ảnh** | • Khối ảnh có `contenteditable="false"`, khi bấm vào ảnh hoặc icon handle thì trình duyệt không focus vào khối, dẫn tới phím Backspace/Delete không tới được khối ảnh<br>• Con trỏ ở dòng dưới Backspace không xóa ảnh phía trước | • Thiết lập `wrapper.setAttribute('tabindex', '-1'); wrapper.focus();` khi chọn khối ảnh để nhận phím xóa trực tiếp<br>• Lắng nghe Backspace ở đầu dòng dưới để xóa ngay khối ảnh phía trước<br>• Lắng nghe Delete ở cuối dòng trên để xóa ngay khối ảnh phía dưới<br>• Xóa nhanh dòng ảnh khi Backspace trong chú thích ảnh trống |
| 3 | **Bôi đen xong copy paste xuống dòng khác bị mất bôi đen / highlight** | • Hàm `serializeBlocks()` trước đây chỉ lưu `innerText` thay vì `innerHTML`<br>• Khi dán đơn dòng, hàm paste gọi `document.execCommand('insertText')` làm mất sạch thẻ HTML highlight (`<mark>`, màu nền, `<b>`, `<i>`) | • Cập nhật `serializeBlocks()` lưu trữ toàn vẹn `innerHTML`<br>• Thêm hàm `extractCleanInlineHtml(html)` và dùng `document.execCommand('insertHTML')` khi dán để giữ nguyên 100% bôi đen highlight, màu sắc và kiểu chữ |
| 4 | **Sau khi import ảnh, không gian bị trống quá nhiều** | • Mỗi khi chèn ảnh bằng paste/modal/drop, hệ thống tự ý tạo thêm 1 khối văn bản trống (`nextTextBlock`) phía dưới ảnh<br>• Thẻ `.image-caption` chiếm chiều cao ngay cả khi không có chú thích | • Xóa bỏ cơ chế tự động chèn dòng trống thừa dưới ảnh<br>• Ẩn hoàn toàn chú thích khi rỗng (`display: none !important`), chỉ hiện khi người dùng bấm nút thêm chú thích<br>• Thu gọn lề khối ảnh (`margin: 1px 0`) |
| 5 | **Không thể Ctrl+C cả dòng, chỉ copy được chữ** | • Sự kiện `copy` chỉ nhận diện khi `sel.isCollapsed`, nếu người dùng bôi đen chữ trong dòng thì bị rơi vào copy mặc định hoặc thiếu cấu trúc dòng<br>• Thao tác copy khối thêm ký tự `\n` khiến khi dán bị vỡ thành dòng rỗng | • Khi con trỏ ở trong dòng mà không bôi đen chữ hoặc bôi đen toàn bộ dòng -> tự động sao chép toàn bộ dòng (Markdown + HTML)<br>• Khi bôi đen đoạn chữ: sao chép đầy đủ cả text và HTML formatted fragment<br>• Khi dán: tự động loại bỏ ký tự ngắt dòng thừa ở cuối để không sinh dòng trống |

---

## 2. Danh sách tệp đã điều chỉnh

1. **`app.js`**:
   - Tối ưu hóa `EditorHistory` (nhận diện ngắt từ, hỗ trợ undo/redo trơn tru, khôi phục vị trí con trỏ).
   - Bảo toàn `innerHTML` trong `serializeBlocks` (giữ nguyên highlight, màu sắc, định dạng phong phú).
   - Thiết lập `tabindex="-1"` và `focus()` trên khối được chọn để phím Backspace/Delete hoạt động trực tiếp.
   - Bổ sung `extractCleanInlineHtml()` và sử dụng `insertHTML` khi dán để không bao giờ mất bôi đen.
   - Loại bỏ việc tự động sinh dòng trống thừa dưới ảnh khi import.
   - Xử lý phím Enter trên khối ảnh đã chọn để tạo dòng mới khi người dùng thực sự muốn.
2. **`styles.css`**:
   - Khắc phục placeholder của chú thích ảnh (`data-placeholder`).
   - Ẩn triệt để chú thích rỗng (`.image-caption:empty:not(:focus)`).
   - Thu hẹp lề và khoảng cách khối ảnh.
3. **`sw.js`**:
   - Nâng cấp phiên bản cache lên `schooldb-v3.2`.
   - Bổ sung cơ chế vượt cache (network-first bypass) khi chạy trên môi trường phát triển `localhost`.
4. **`index.html` & `mini.html`**:
   - Cập nhật cache-busting queries lên `?v=3.2`.
