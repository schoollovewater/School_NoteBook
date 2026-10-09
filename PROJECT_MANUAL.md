# 📚 School NoteBook — Hướng Dẫn & Tài Liệu Kỹ Thuật Toàn Diện

> **Sổ tay ghi chép học tập, lập trình & Kho từ vựng thông minh theo phong cách Notion kết hợp Thẻ nhớ 3D Flashcards & Mini Note hỏa tốc.**  
> *Phiên bản hiện tại:* **v3.9.2**  
> *Nền tảng:* Web App & PWA (HTML5, Vanilla CSS, Vanilla JavaScript, Firebase Compat, SortableJS, Service Worker).

---

## 📑 Mục lục
1. [Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
2. [Cấu trúc mã nguồn dự án](#2-cấu-trúc-mã-nguồn-dự-án)
3. [Hướng dẫn cài đặt & Khởi chạy](#3-hướng-dẫn-cài-đặt--khởi-chạy)
4. [Chi tiết các tính năng đã hoàn thiện](#4-chi-tiết-các-tính-năng-đã-hoàn-thiện)
   - [4.1. Trình soạn thảo khối (Block Editor & Toggles)](#41-trình-soạn-thảo-khối-block-editor--toggles)
   - [4.2. Menu lệnh gạch chéo (Slash Commands `/`)](#42-menu-lệnh-gạch-chéo-slash-commands-)
   - [4.3. Kho Từ Vựng & Thẻ nhớ 3D Flashcard](#43-kho-từ-vựng--thẻ-nhớ-3d-flashcard)
   - [4.4. Thanh công cụ bôi đen nổi (Floating Selection Toolbar)](#44-thanh-công-cụ-bôi-đen-nổi-floating-selection-toolbar)
   - [4.5. Hệ thống Icon & Tìm kiếm Emoji](#45-hệ-thống-icon--tìm-kiếm-emoji)
   - [4.6. Hệ thống Ảnh bìa (Cover Image) đa chế độ](#46-hệ-thống-ảnh-bìa-cover-image-đa-chế-độ)
   - [4.7. Tùy biến trang & Cài đặt nâng cao](#47-tùy-biến-trang--cài-đặt-nâng-cao)
   - [4.8. Cơ chế lưu trữ Offline & Đồng bộ Cloud](#48-cơ-chế-lưu-trữ-offline--đồng-bộ-cloud)
   - [4.9. Trình ghi chú nhanh Mini Note v2 (PWA & CLI)](#49-trình-ghi-chú-nhanh-mini-note-v2-pwa--cli)
   - [4.10. Hộp thư đến (Inbox) & Đồng bộ thời gian thực hai chiều](#410-hộp-thư-đến-inbox--đồng-bộ-thời-gian-thực-hai-chiều)
   - [4.11. Trải nghiệm & Cử chỉ cảm ứng trên Điện thoại (Mobile UX)](#411-trải-nghiệm--cử-chỉ-cảm-ứng-trên-điện-thoại-mobile-ux)
5. [Lịch sử sửa lỗi kỹ thuật quan trọng](#5-lịch-sử-sửa-lỗi-kỹ-thuật-quan-trọng)
6. [Bảng phím tắt tiện ích (Shortcuts Cheat Sheet)](#6-bảng-phím-tắt-tiện-ích-shortcuts-cheat-sheet)

---

## 1. Giới thiệu tổng quan
**School NoteBook** là một ứng dụng ghi chép chuyên sâu dành cho sinh viên, học sinh và lập trình viên. Ứng dụng kết hợp tính linh hoạt của các khối nội dung (Block Editor kiểu Notion), tính thẩm mỹ cao (Dark/Light mode, ảnh bìa, icon) và khả năng học từ vựng tiếng Anh chuyên ngành thông qua mô hình Flashcard 3D phản xạ nhanh.

Phiên bản **v3.0** bổ sung kiến trúc **Quick-Capture** với **Mini Note v2** hoạt động độc lập hoặc cài đặt như ứng dụng PWA trên điện thoại, đồng bộ thời gian thực vào mục **Inbox** của sổ tay chính.

---

## 2. Cấu trúc mã nguồn dự án

```
School_NoteBook/
├── index.html              # Sổ tay chính (Web App & PWA)
├── styles.css              # Hệ thống CSS Design Tokens, Glassmorphism, 3D Flashcard, Responsive
├── app.js                  # Toàn bộ logic Sổ tay chính (Editor, Drawer, Inbox, Flashcard, Realtime Sync)
├── mini.html               # Mini Note v2: Trình ghi chú nhanh độc lập (PWA & Offline)
├── mininote.js             # CLI Tool ghi chú hỏa tốc từ Terminal
├── shared/
│   └── note-schema.js      # Hợp đồng dữ liệu dùng chung (Schema, textToBlocks, migration)
├── icons/
│   ├── icon-192.png        # Icon PWA độ phân giải 192x192
│   └── icon-512.png        # Icon PWA độ phân giải 512x512
├── sw.js                   # Service Worker hỗ trợ ngoại tuyến (Offline-first)
├── manifest.json           # Cấu hình PWA cho Sổ tay chính
├── manifest-mini.json      # Cấu hình PWA cho Mini Note (Web Share Target)
├── firebase-config.js      # Cấu hình Firebase Firestore (tùy chọn)
├── README.md               # Tài liệu khởi động nhanh
└── PROJECT_MANUAL.md       # Tài liệu kỹ thuật toàn diện này
```

---

## 3. Hướng dẫn cài đặt & Khởi chạy

### Cách 1: Chạy bằng Python Local Server (Khuyên dùng)
Mở terminal tại thư mục dự án và chạy:
```bash
python -m http.server 8080
```
- Truy cập Sổ tay chính: **`http://localhost:8080`**
- Truy cập Mini Note: **`http://localhost:8080/mini.html`**

### Cách 2: Ghi chú hỏa tốc từ Terminal (CLI)
```bash
# Ghi chú thường vào Inbox
node mininote.js -t "Vi điều khiển" "Học về ngoại vi SPI và I2C"

# Tạo danh sách việc cần làm (Todo list)
node mininote.js --todo -t "Việc hôm nay" "Học từ vựng\nLàm bài tập lớn\nÔn Flashcard"
```

---

## 4. Chi tiết các tính năng đã hoàn thiện

### 4.1. Trình soạn thảo khối (Block Editor & Toggles)
* **Khối Toggle List**: Đóng/mở bằng mũi tên tam giác. Nhấn `Enter` ở dòng rỗng bên trong sẽ tự thoát toggle. Nhấn `Backspace` ở đầu dòng rỗng chuyển thành text.
* **Heading Toggles**: Hỗ trợ Heading 1, 2, 3 có khả năng thu gọn / mở rộng.
* **Kéo thả khối (SortableJS)**:
  - Có nút tay cầm kéo thả `⋮⋮` ở mỗi khối.
  - Tối ưu chạm di động: Kích hoạt độ trễ `delay: 220ms` (`delayOnTouchOnly: true`) để cuộn trang trên màn hình cảm ứng mượt mà không bị kéo nhầm.

### 4.2. Menu lệnh gạch chéo (Slash Commands `/`)
* Gõ `/` để mở menu gợi ý kiểu khối (`h1`, `h2`, `h3`, `todo`, `bullet`, `number`, `quote`, `code`, `callout`...).
* Trên màn hình di động, menu gạch chéo tự chuyển thành dạng Bottom Sheet trượt từ dưới lên dễ chọn bằng ngón cái.

### 4.3. Kho Từ Vựng & Thẻ nhớ 3D Flashcard
* **4 Nhóm từ vựng trọng tâm:** Kỹ thuật chuyên sâu (`TechAdvanced`), Kỹ thuật quen thuộc (`TechCommon`), TOEIC (`TOEIC`), Khác (`Other`).
* **Lật thẻ 3D phản xạ:**
  - Mặt trước: Từ tiếng Anh, phiên âm, tag phân loại.
  - Mặt sau: Nghĩa tiếng Việt, ví dụ thực tế.
  - Phím tắt: `Space` (lật thẻ), `→` (tiếp theo), `←` (quay lại), `1` (cần ôn), `2` (đã thuộc).
  - Cử chỉ cảm ứng trên điện thoại: **Vuốt phải** = Đã thuộc, **Vuốt trái** = Cần ôn, **Chạm** = Lật thẻ.

### 4.4. Thanh công cụ bôi đen nổi (Floating Selection Toolbar)
* Xuất hiện khi bôi đen văn bản.
* Thêm từ vựng 1-click vào kho & flashcard.
* Đổi kiểu chữ (`AA` IN HOA, `aa` in thường, `Aa` Viết Hoa Đầu).
* Tra cứu Google nhanh, bảng màu & highlight, chuyển đổi khối, thống kê từ/ký tự.

### 4.5. Hệ thống Icon & Tìm kiếm Emoji
* 80+ icon chọn lọc theo 5 chủ đề (Học tập, Công nghệ, Cảm xúc, Đời sống, Quản lý).
* Tìm kiếm từ khóa song ngữ tiếng Việt / tiếng Anh.

### 4.6. Hệ thống Ảnh bìa (Cover Image) đa chế độ
* Gallery (20 ảnh Unsplash tuyển chọn).
* Tải từ máy tính: tự động nén bằng HTML5 Canvas xuống <150KB chống tràn LocalStorage.
* Dán link URL ngoài có xem trước.

### 4.7. Tùy biến trang & Cài đặt nâng cao
* Đổi phông chữ (Default, Serif, Mono).
* Bật/Tắt Small Text, Full Width, Khóa trang (Lock Page chỉ đọc).
* Nhân bản trang (`Ctrl+D`), sao chép liên kết (`Ctrl+L`), xuất file `.txt`.

### 4.8. Cơ chế lưu trữ Offline & Đồng bộ Cloud
* **Offline-First:** Lưu vào `localStorage` của trình duyệt. Tự động cache tĩnh qua Service Worker (`sw.js`).
* **Firebase Firestore Sync:** Đồng bộ dữ liệu theo thời gian thực hai chiều.

---

### 4.9. Trình ghi chú nhanh Mini Note v2 (PWA & CLI)
* **Giao diện đa thiết bị:**
  - **Trên điện thoại (< 640px):** Thanh tab nằm ngang vuốt mượt mà, input rộng rãi, thanh công cụ dính trên bàn phím.
  - **Trên máy tính (≥ 640px):** Thanh tab dọc bên trái dạng icon số hiện đại.
* **3 Loại ghi nhanh:**
  1. 📝 **Ghi chú (Note):** Nhập tiêu đề, nội dung Markdown, gắn thẻ `#tag`.
  2. ☑ **Việc cần làm (Todo):** Nhập danh sách công việc, tự động tách dòng thành các block checkbox todo.
  3. 📚 **Từ vựng nhanh (Vocab):** Nhập từ, phiên âm, nghĩa tiếng Việt, phân loại và ví dụ; lưu trực tiếp vào Kho từ vựng & Flashcard.
* **Tự động lưu nháp (Auto-save draft):** Lưu thời gian thực vào `localStorage.mini_drafts`. F5 hoặc đóng trình duyệt không bị mất dữ liệu.
* **Quản lý tab:** Thêm tab `+`, đóng tab `✕` (có hộp thoại cảnh báo nếu tab đang có nội dung chưa gửi).
* **Nhập liệu bằng giọng nói (Voice Typing):** Tích hợp Web Speech API tiếng Việt (`vi-VN`) 🎤.
* **Chia sẻ từ ứng dụng khác (Web Share Target):** Nhận link, văn bản chia sẻ từ Chrome/Zalo/YouTube trên Android trực tiếp vào ô ghi chú.
* **Phím tắt:** `Ctrl + Enter` (gửi ngay), `Alt + N` (thêm tab), `Alt + W` (đóng tab), `Alt + 1..9` (nhảy tab).

---

### 4.10. Hộp thư đến (Inbox) & Đồng bộ thời gian thực hai chiều
* **Hộp thư đến 📥 INBOX:**
  - Mọi ghi chú tạo từ Mini Note, Terminal CLI hoặc chia sẻ ngoài được đánh dấu `inbox: true` và gom vào thư mục **📥 INBOX** trên thanh sidebar.
  - Badge số đếm hiển thị số lượng ghi chú mới chưa xử lý.
  - Khi mở ghi chú trong Inbox, xuất hiện banner thông báo: *"📥 Ghi chú từ Mini Note đang nằm trong Inbox"* kèm nút **"Chuyển vào sổ"** để chuyển 1-click thành trang chính thức.
* **Đồng bộ thời gian thực 2 chiều:**
  - **Cross-tab BroadcastChannel:** Khi mở Mini Note và Sổ tay chính trên cùng thiết bị, bấm "Gửi" ở Mini Note sẽ xuất hiện tức thì trong Sổ tay mà không cần tải lại trang và không phụ thuộc vào kết nối mạng.
  - **Cloud Firestore Realtime (`onSnapshot`):** Lắng nghe thay đổi tức thì từ Cloud trên nhiều thiết bị.
  - **Tự động chuyển đổi ghi chú cũ (Legacy Migration):** Các ghi chú cũ dạng thô `{title, content}` gửi từ phiên bản cũ sẽ tự động được phân tích và chuyển đổi thành dạng cấu trúc khối `blocks` chuẩn.

---

### 4.11. Trải nghiệm & Cử chỉ cảm ứng trên Điện thoại (Mobile UX)
* **Thanh điều hướng đáy (Mobile Bottom Navigation):**
  - Gồm 5 nút tiện ích: **Trang (Sidebar)** kèm Badge Inbox, **Tìm kiếm (Search)**, **Ghi nhanh (Mở Mini Note)**, **Tạo mới (New Page)**, **Kho từ vựng (Vocab)**.
* **Ngăn kéo Sidebar mượt mà (Mobile Drawer):**
  - Mở bằng nút ☰ hoặc vuốt từ mép trái màn hình (`touch gesture`).
  - Lớp phủ mờ (Backdrop overlay) làm nổi bật sidebar và tự đóng khi chọn trang.
* **Tối ưu hiển thị màn hình di động:**
  - Sử dụng chiều cao động `100dvh` chống lỗi che khuất của thanh địa chỉ trình duyệt trên iOS Safari / Android Chrome.
  - Hỗ trợ vùng an toàn tai thỏ và thanh gạt Home (`env(safe-area-inset-*)`).
  - Menu gạch chéo `/` và bảng chọn Emoji/Cover chuyển thành Bottom Sheet trượt từ cạnh dưới.
* **Service Worker (`sw.js`) & Cài đặt PWA:**
  - Cài đặt độc lập 2 icon trên màn hình chính: Sổ tay chính và Mini Note.
  - Cache tài nguyên ngoại tuyến, mở app ngay cả khi mất mạng.

---

## 5. Lịch sử sửa lỗi kỹ thuật quan trọng

| Vấn đề gặp phải | Nguyên nhân kỹ thuật | Giải pháp đã áp dụng |
|---|---|---|
| **Ghi chú từ Mini Note không hiện trên Web Tổng** | `mini.html` gửi schema `{title, content}` trong khi `app.js` chỉ đọc `if (data.blocks)`. | Tạo thư viện chung `shared/note-schema.js` chuẩn hóa `textToBlocks()`, tự động migrate ghi chú cũ sang `blocks` và đẩy vào mục **📥 INBOX**. |
| **Nút ☰ trên di động không phản hồi** | ID `#toggle-sidebar` chưa được gắn trình lắng nghe sự kiện trong `app.js`. | Viết hàm `initMobile()`, kết hợp sự kiện chạm vuốt mép trái, lớp phủ `#sidebar-overlay` và thanh Bottom Nav. |
| **Mất dữ liệu nháp khi tắt Mini Note** | Dữ liệu chỉ lưu trong biến RAM `let notes = [...]`. | Lưu tự động vào `localStorage.mini_drafts`, khôi phục nguyên vẹn trạng thái các tab khi mở lại. |
| **Cuộn trang trên điện thoại bị giật kéo thả** | Sự kiện touch drag của SortableJS cướp thao tác cuộn thông thường. | Thêm cấu hình `delay: 220`, `delayOnTouchOnly: true` và `touchStartThreshold: 4` cho SortableJS. |
| **Tràn màn hình trên iOS / Android** | Đơn vị CSS `100vh` tính cả thanh URL của trình duyệt di động. | Đổi thành `height: 100dvh` và bổ sung `padding-bottom: env(safe-area-inset-bottom)`. |

---

## 6. Bảng phím tắt tiện ích (Shortcuts Cheat Sheet)

### 📝 Thao tác soạn thảo & Quản lý trang
* **`Ctrl + N`**: Tạo trang ghi chú mới.
* **`Ctrl + K`**: Mở thanh tìm kiếm nhanh các trang.
* **`Ctrl + D`**: Nhân bản (Duplicate) trang hiện tại.
* **`Ctrl + L`**: Sao chép đường dẫn liên kết đến trang.
* **`Ctrl + B`**: In đậm chữ đang chọn.
* **`Ctrl + I`**: In nghiêng chữ đang chọn.
* **`Ctrl + U`**: Gạch chân chữ đang chọn.
* **`/` (Gạch chéo)**: Mở menu chọn kiểu khối nhanh.
* **`Esc`**: Đóng menu gợi ý hoặc đóng modal.

### ⚡ Mini Note (Ghi nhanh)
* **`Ctrl + Enter`**: Gửi tất cả các tab hợp lệ lên Sổ tay chính.
* **`Alt + N`**: Thêm tab mới.
* **`Alt + W`**: Đóng tab hiện tại.
* **`Alt + 1..9`**: Chuyển nhanh giữa các tab.

### 🃏 Ôn luyện Flashcard 3D
* **`Space` (Phím cách)**: Lật thẻ xem nghĩa và ví dụ / lật lại.
* **`→` (Mũi tên sang phải)**: Chuyển sang thẻ tiếp theo.
* **`←` (Mũi tên sang trái)**: Quay lại thẻ trước đó.
* **Vuốt phải (Cảm ứng)**: Đánh dấu đã thuộc thẻ.
* **Vuốt trái (Cảm ứng)**: Đánh dấu cần ôn lại thẻ.

---
*Tài liệu được cập nhật tự động và lưu trữ trực tiếp trong mã nguồn dự án School NoteBook (Phiên bản v3.0).*
