# 📚 School NoteBook

Ứng dụng ghi chép học tập, lập trình, Kho từ vựng thông minh kết hợp Thẻ nhớ 3D Flashcards & Trình ghi chú nhanh **Mini Note** (PWA).

---

## 🚀 Khởi chạy ứng dụng
Mở terminal trong thư mục dự án và chạy:
```bash
python -m http.server 8080
```
Sau đó mở trình duyệt truy cập:
- **Sổ tay chính**: **[http://localhost:8080](http://localhost:8080)**
- **Mini Note (Ghi nhanh hỏa tốc)**: **[http://localhost:8080/mini.html](http://localhost:8080/mini.html)**

Hoặc ghi chú trực tiếp từ Terminal bằng CLI:
```bash
node mininote.js -t "Tiêu đề" "Nội dung ghi chú"
node mininote.js --todo -t "Hôm nay" "Việc 1\nViệc 2"
```

---

## 📖 Tài liệu hướng dẫn & Kỹ thuật
Vui lòng xem chi tiết toàn bộ tính năng, kiến trúc kỹ thuật và hướng dẫn sử dụng tại:  
👉 **[PROJECT_MANUAL.md](./PROJECT_MANUAL.md)**

### Tóm tắt các tính năng chính (Phiên bản v3.0):
- **⚡ Trình ghi chú hỏa tốc Mini Note v2**: 
  - Giao diện tab ngang trên điện thoại, tab dọc trên máy tính.
  - 3 chế độ ghi nhanh: **Ghi chú (Note)**, **Việc cần làm (Todo)**, **Từ vựng nhanh (Vocab)**.
  - Tự động lưu nháp (`localStorage`), gửi khi offline, nhập liệu giọng nói 🎤, nhận chia sẻ từ app khác (Web Share Target).
- **📥 Hộp thư đến (Inbox) thông minh**: Tự động tiếp nhận ghi chú từ Mini Note, CLI và chia sẻ ngoài; nút "Chuyển vào sổ" 1-click.
- **📱 Trải nghiệm di động tối ưu**: 
  - Thanh điều hướng đáy (Bottom Navigation) 5 phím bấm nhanh có huy hiệu số lượng Inbox.
  - Drawer menu bên trái trượt mở bằng vuốt cảm ứng từ mép màn hình.
  - Flashcard 3D hỗ trợ cử chỉ vuốt thẻ: Vuốt phải = Đã thuộc, Vuốt trái = Cần ôn, Chạm = Lật.
  - Hỗ trợ màn hình tai thỏ / thanh home (`env(safe-area-inset)` & `100dvh`).
- **Trình soạn thảo khối (Block Editor)**: Toggle List, Heading Toggle (H1/H2/H3), Kéo thả SortableJS (có độ trễ chạm chống giật khi cuộn), Menu lệnh `/`.
- **Kho Từ Vựng & 3D Flashcard Deck**: 4 nhóm phân loại (Kỹ thuật chuyên sâu, Kỹ thuật quen thuộc, TOEIC, Khác).
- **Thanh bôi đen nổi Notion Floating Toolbar**: Thêm từ vựng 1-click, Đổi kiểu chữ, Tra cứu Google, Bảng màu.
- **Bộ sưu tập Icon & Ảnh bìa đa chế độ**: 80+ Emoji chọn lọc, 20 ảnh Unsplash, Nén ảnh máy tính tự động bằng Canvas.
- **PWA & Offline Toàn diện**: Service Worker (`sw.js`) cache ngoại tuyến, đồng bộ thời gian thực hai chiều (Cloud Firestore + Cross-tab BroadcastChannel).
