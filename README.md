# 📚 School NoteBook

Ứng dụng ghi chép học tập, lập trình & Kho từ vựng thông minh phong cách Notion kết hợp Thẻ nhớ 3D Flashcards.

---

## 🚀 Khởi chạy ứng dụng
Mở terminal trong thư mục dự án và chạy:
```bash
python -m http.server 8080
```
Sau đó mở trình duyệt truy cập: **[http://localhost:8080](http://localhost:8080)**

---

## 📖 Tài liệu hướng dẫn & Kỹ thuật
Vui lòng xem chi tiết toàn bộ tính năng, kiến trúc kỹ thuật và lịch sử giải pháp tại:  
👉 **[PROJECT_MANUAL.md](./PROJECT_MANUAL.md)**

### Tóm tắt các tính năng chính:
- **Trình soạn thảo khối (Block Editor)**: Hỗ trợ Toggle List, Heading Toggle (H1/H2/H3), Kéo thả SortableJS, Menu lệnh gạch chéo `/`.
- **Kho Từ Vựng & 3D Flashcard Deck**: 4 nhóm phân loại (Kỹ thuật chuyên sâu, Kỹ thuật quen thuộc, TOEIC, Khác), Lật thẻ 3D phản xạ với phím tắt `Space`, `←`, `→`.
- **Thanh bôi đen nổi Notion Floating Toolbar**: Thêm từ vựng 1-click, Đổi kiểu chữ (IN HOA, in thường, Viết Hoa Đầu), Tra cứu Google, Bảng màu & Highlight.
- **Bộ sưu tập Icon (80+ Emoji)**: Phân loại theo 5 chủ đề, tìm kiếm từ khóa tiếng Việt & tiếng Anh thông minh, tự nhập emoji tùy thích.
- **Ảnh bìa (Cover Image) đa chế độ**: Gallery tuyển chọn 20 ảnh Unsplash, Tải từ máy tính với công nghệ nén HTML5 Canvas chống tràn LocalStorage, Dán link URL ngoài có xem trước.
- **Lưu trữ Offline-first**: Lưu dữ liệu trực tiếp trong trình duyệt bằng `localStorage`, có hỗ trợ đồng bộ thời gian thực qua Firebase Firestore.
