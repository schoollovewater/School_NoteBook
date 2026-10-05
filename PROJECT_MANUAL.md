# 📚 School NoteBook — Hướng Dẫn & Tài Liệu Kỹ Thuật Toàn Diện

> **Sổ tay ghi chép học tập, lập trình & Kho từ vựng thông minh theo phong cách Notion kết hợp Thẻ nhớ 3D Flashcards.**  
> *Phiên bản hiện tại:* **v2.6**  
> *Nền tảng:* Web App (HTML5, Vanilla CSS, Vanilla JavaScript, Firebase Compat, SortableJS).

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
5. [Lịch sử sửa lỗi kỹ thuật quan trọng](#5-lịch-sử-sửa-lỗi-kỹ-thuật-quan-trọng)
6. [Bảng phím tắt tiện ích (Shortcuts Cheat Sheet)](#6-bảng-phím-tắt-tiện-ích-shortcuts-cheat-sheet)

---

## 1. Giới thiệu tổng quan
**School NoteBook** là một ứng dụng ghi chép chuyên sâu dành cho sinh viên, học sinh và lập trình viên. Ứng dụng kết hợp tính linh hoạt của các khối nội dung (Block Editor kiểu Notion), tính thẩm mỹ cao (Dark/Light mode, ảnh bìa, icon) và khả năng học từ vựng tiếng Anh chuyên ngành thông qua mô hình Flashcard 3D phản xạ nhanh.

---

## 2. Cấu trúc mã nguồn dự án

```
School_NoteBook/
├── index.html              # Bộ khung giao diện chính, modal từ vựng, popover bìa & icon, thanh bôi đen
├── styles.css              # Hệ thống CSS Design Tokens, Glassmorphism, 3D Flashcard, Responsive
├── app.js                  # Toàn bộ logic ứng dụng (Editor, Popovers, Vocab, Flashcard, Floating Toolbar)
├── firebase-config.js      # Cấu hình Firebase Firestore (tùy chọn)
├── mini.html / mininote.js # Phiên bản ghi chú mini popup
├── manifest.json           # Cấu hình PWA (Progressive Web App)
└── PROJECT_MANUAL.md       # Tài liệu hướng dẫn & kỹ thuật chi tiết này
```

---

## 3. Hướng dẫn cài đặt & Khởi chạy

### Cách 1: Chạy bằng Python Local Server (Khuyên dùng)
Mở terminal tại thư mục dự án và chạy:
```bash
python -m http.server 8080
```
Sau đó mở trình duyệt truy cập: **`http://localhost:8080`**

### Cách 2: Chạy trực tiếp bằng Live Server trên VS Code
Nhấp chuột phải vào `index.html` và chọn **"Open with Live Server"**.

---

## 4. Chi tiết các tính năng đã hoàn thiện

### 4.1. Trình soạn thảo khối (Block Editor & Toggles)
* **Khối Toggle List**:
  * Đóng/mở bằng mũi tên tam giác.
  * **Cách xuống dòng khác ngoài toggle:** Khi đang ở dòng trống bên trong toggle, nhấn `Enter` sẽ tự động thoát khỏi toggle và tạo một khối văn bản thường ngay bên dưới.
  * Nhấn `Backspace` ở đầu khối toggle rỗng sẽ chuyển khối thành đoạn văn bản bình thường.
* **Heading Toggles**: Hỗ trợ Heading 1, 2, 3 có khả năng thu gọn / mở rộng nội dung bên dưới.
* **Kéo thả khối (Drag & Drop)**:
  * Tích hợp thư viện `SortableJS`.
  * Có nút tay cầm kéo thả `⋮⋮` ở mỗi khối.
  * Đã khắc phục triệt để lỗi dòng bị nhảy lên đầu trang khi kéo thả.

### 4.2. Menu lệnh gạch chéo (Slash Commands `/`)
* Gõ ký tự `/` ở bất kỳ khối nào để kích hoạt menu gợi ý.
* Hỗ trợ tìm kiếm nhanh: `/h1`, `/h2`, `/h3`, `/to`, `/bull`, `/num`, `/code`, `/quote`, `/callout`...
* Điều hướng bằng phím mũi tên `↑` `↓`, chọn bằng phím `Enter` hoặc click chuột.
* Nhấn `Esc` để đóng menu.

### 4.3. Kho Từ Vựng & Thẻ nhớ 3D Flashcard
* **4 Nhóm từ vựng trọng tâm:**
  1. 🔧 **Kỹ thuật chuyên sâu** (`TechAdvanced`): Thuật toán, kiến trúc hệ thống, giao thức mạng, cấu trúc dữ liệu...
  2. 💻 **Kỹ thuật quen thuộc** (`TechCommon`): Các khái niệm IT phổ biến (Bug, Deploy, Framework, API...).
  3. 🎯 **Tiếng Anh TOEIC** (`TOEIC`): Từ vựng luyện thi chứng chỉ, công sở, thương mại.
  4. 📝 **Khác** (`Other`): Từ vựng đời sống, ghi chép học tập tự do.
* **Quản lý danh sách từ vựng:**
  * Modal thêm / sửa từ vựng đẹp mắt với đầy đủ trường: Từ vựng, Phiên âm, Phân loại, Nghĩa tiếng Việt, Câu ví dụ.
  * Bộ lọc từ vựng theo tab phân loại & thanh tìm kiếm tức thì.
  * Đánh dấu trạng thái: **Đã nhớ (Mastered)** hoặc **Cần ôn (Learning)**.
* **Chế độ Thẻ Lật 3D (3D Flashcard Deck):**
  * Thẻ hiển thị hiệu ứng lật 3D chân thực bằng CSS `perspective` và `rotateY(180deg)`.
  * **Mặt trước:** Từ tiếng Anh, phiên âm, huy hiệu phân loại, gợi ý lật.
  * **Mặt sau:** Nghĩa tiếng Việt, phân loại, câu ví dụ thực tế.
  * Thanh tiến độ (Progress bar) & bộ đếm số thẻ (`Thẻ x / y`).
  * 2 nút hành động: **"Cần ôn lại"** (chuyển sang màu vàng) & **"Đã thuộc từ này"** (chuyển sang màu xanh lá).
  * **Phím tắt luyện thẻ:**
    * Phím `Space` (Cách): Lật thẻ.
    * Phím `→` (Mũi tên phải): Sang thẻ tiếp theo.
    * Phím `←` (Mũi tên trái): Quay lại thẻ trước.

### 4.4. Thanh công cụ bôi đen nổi (Floating Selection Toolbar)
* Xuất hiện ngay phía trên vị trí con trỏ chuột khi bôi đen bất kỳ văn bản nào trong trang (tương tự Notion / Medium).
* **Tác vụ 1-Click: "+ Thêm vào Kho Từ vựng & Flashcard":**
  * Tự động trích xuất từ/cụm từ đang bôi đen và điền sẵn vào ô từ vựng trong modal.
* **Đổi kiểu chữ (Word Case Tools):**
  * `AA` **IN HOA**: Chuyển chuỗi bôi đen thành in hoa.
  * `aa` **in thường**: Chuyển chuỗi bôi đen thành chữ thường.
  * `Aa` **Viết Hoa Đầu**: Viết hoa chữ cái đầu tiên của từng từ.
* **Tra cứu nhanh Google:** Mở tab tìm kiếm Google cho từ được chọn chỉ với 1 click.
* **Bộ chọn màu & Highlight:** Bảng màu chữ và màu nền highlight pastel.
* **Định dạng cơ bản:** Đậm (`Ctrl+B`), Nghiêng (`Ctrl+I`), Gạch chân (`Ctrl+U`), Gạch ngang, Code nội dòng, Xóa định dạng.
* **Chuyển đổi kiểu khối:** Cho phép biến đoạn văn bản bôi đen thành H1, H2, H3, Bullet, Number, Todo, Quote, Code.
* **Thống kê:** Hiển thị tức thì số lượng từ và số ký tự của đoạn văn bản đang chọn.

### 4.5. Hệ thống Icon & Tìm kiếm Emoji
* **Hơn 80+ icon chọn lọc** thuộc 5 nhóm chủ đề:
  * 📚 **Học tập** (Study): 📚, 📖, ✏️, 📝, 🎓, 🔬, 🧪, 📐, 🔭, 💡, 🧠, 📊, 📈, 📌, 📋, 🔖
  * 💻 **Công nghệ** (Tech): 💻, 🖥️, ⌨️, 🖱️, 📱, ⚙️, 🔧, 🔨, 🚀, 🤖, 🌐, 🔒, 📡, 🔋, 💾, ⚡
  * ✨ **Cảm xúc** (Emotion): 😀, 😎, 🤔, 🥳, 🤩, ✨, 🔥, ⭐, 💯, 🎯, 💖, 👏, 🙌, ✌️, 🎉, ☕
  * 🌿 **Đời sống** (Life): 🌿, 🌸, 🍀, 🌞, 🌙, 🌈, 🐱, 🍕, 🍔, ⚽, 🎮, 🎧, 🚲, ✈️, 🏕️, 🎨
  * 📂 **Quản lý** (Office): 📂, 📁, 📄, 🗓️, 📅, ⏰, ⏳, 🏷️, 💼, 🗂️, 🗃️, 📉, ✉️, 📦, 🔔, 🔑
* **Tìm kiếm theo từ khóa thông minh:** Gõ cả tiếng Việt không dấu hoặc tiếng Anh (ví dụ: *sach, book, code, dev, thong ke, banh, may bay...*).
* **Tự nhập emoji tùy thích:** Nhập ký tự hoặc biểu tượng cảm xúc bất kỳ vào ô gõ tay.
* **Xóa icon:** Đặt lại biểu tượng sạch sẽ mặc định (`📄`).

### 4.6. Hệ thống Ảnh bìa (Cover Image) đa chế độ
Bảng chọn ảnh bìa gồm **4 tab tiện lợi**:
1. **📁 Bộ sưu tập (Gallery):** 20 ảnh bìa chất lượng cao tuyển chọn từ Unsplash theo 4 chủ đề (💻 Công nghệ, 📚 Học tập, 🌿 Thiên nhiên, 🎨 Gradient nghệ thuật).
2. **💻 Tải từ máy tính (Local Upload):**
   * Hỗ trợ chọn tệp hoặc **Kéo thả ảnh (Drag & Drop)** từ máy tính vào ô dropzone.
   * **Nén ảnh tự động bằng HTML5 Canvas:** Tối ưu hóa kích thước (tối đa 1400x600px, JPEG quality 0.82) nén dung lượng xuống còn ~80-150KB.
   * Lưu trữ cục bộ dạng Base64 Data URL mà **không làm đầy giới hạn `localStorage` của trình duyệt**.
3. **🌐 Dán link URL:** Nhập link ảnh từ bất kỳ trang web nào (`https://...`) kèm khung xem trước (Live Preview).
4. **🗑️ Xóa bìa:** Xóa ảnh bìa của trang hiện tại chỉ với 1 click.

### 4.7. Tùy biến trang & Cài đặt nâng cao
* **Đổi phông chữ:** Default (Sans-serif hiện đại), Serif (Cổ điển lịch thiệp), Mono (Lập trình).
* **Bật/Tắt chữ nhỏ (Small Text).**
* **Bật/Tắt tràn màn hình (Full Width).**
* **Khóa trang (Lock Page):** Chuyển trang sang chế độ chỉ đọc để tránh vô tình chỉnh sửa.
* **Thống kê từ & Ký tự (Word Count & Analytics):** Xem tổng số từ, ký tự và ước tính thời gian đọc.
* **Xuất file:** Tải toàn bộ nội dung trang thành tệp văn bản `.txt`.
* **Nhân bản trang (Duplicate):** Tạo bản sao y hệt của trang hiện tại với phím tắt `Ctrl+D`.
* **Chủ đề Giao diện (Theme):** Nút chuyển đổi nhanh Dark Mode / Light Mode với bảng màu mượt mà.

### 4.8. Cơ chế lưu trữ Offline & Đồng bộ Cloud
* **Offline-First:** Tất cả các trang, danh mục, từ vựng và cấu hình được lưu vào `localStorage` của trình duyệt (`schooldb_pages`, `schooldb_vocab`, `theme`). Hoạt động 100% mượt mà không cần kết nối mạng.
* **Firebase Firestore Sync (Tùy chọn):** Khi cung cấp thông tin cấu hình trong `firebase-config.js`, hệ thống có thể kết nối đồng bộ theo thời gian thực.

---

## 5. Lịch sử sửa lỗi kỹ thuật quan trọng

| Vấn đề gặp phải | Nguyên nhân kỹ thuật | Giải pháp đã áp dụng |
|---|---|---|
| **Kéo thả dòng bị nhảy lên đầu trang** | Khi kéo thả, sự kiện drag của `SortableJS` tính toán sai phần tử cha do các khối lồng nhau và vị trí chuột. | Cấu hình lại `SortableJS` trên container `#block-editor`, loại bỏ xung đột target và thêm class kéo thả chống jitter. |
| **Không thoát được Toggle List khi xuống dòng** | Nhấn `Enter` trong khối con của toggle tiếp tục tạo thêm khối con trong toggle đó. | Bắt sự kiện `keydown` trên khối toggle: nếu khối toggle đang rỗng mà nhấn `Enter`, ngăn mặc định và tạo khối đoạn văn mới bên dưới toggle. |
| **Gõ `/` + chữ cái không hiện gợi ý** | Bộ lắng nghe `input` chỉ kiểm tra ký tự `/` chính xác ở vị trí đầu tiên, không xử lý tốt khi gõ thêm chữ. | Sửa hàm `handleSlashCommandInput` kiểm tra đoạn text bắt đầu bằng `/`, lọc danh sách gợi ý thời gian thực và tự động mở menu. |
| **Ảnh tải từ máy tính làm đầy dung lượng LocalStorage** | Ảnh gốc từ máy ảnh/điện thoại thường có dung lượng 3MB - 10MB, vượt quá hạn mức 5MB của LocalStorage. | Dùng HTML5 Canvas giải mã hình ảnh, hạ độ phân giải xuống tỉ lệ banner (tối đa 1400x600) và nén chất lượng JPEG 82%, dung lượng chỉ còn ~100KB. |
| **Thanh bôi đen che mất thao tác gõ** | Sự kiện `selectionchange` kích hoạt cả khi người dùng đang nhập liệu trong ô input/modal. | Bổ sung kiểm tra vị trí vùng chọn (`Selection.contains` hoặc kiểm tra target thuộc input/modal) để ẩn thanh nổi khi người dùng đang nhập văn bản. |

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

### 🃏 Ôn luyện Flashcard 3D
* **`Space` (Phím cách)**: Lật thẻ để xem nghĩa và ví dụ / lật lại mặt trước.
* **`→` (Mũi tên sang phải)**: Chuyển sang thẻ từ vựng tiếp theo.
* **`←` (Mũi tên sang trái)**: Quay lại thẻ từ vựng trước đó.

---
*Tài liệu được cập nhật tự động và lưu trữ trực tiếp trong mã nguồn dự án School NoteBook.*
