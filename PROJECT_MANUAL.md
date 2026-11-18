# 📚 School NoteBook — Hướng Dẫn & Tài Liệu Kỹ Thuật Toàn Diện

> **Sổ tay ghi chép học tập, lập trình & Kho từ vựng thông minh theo phong cách Notion kết hợp Thẻ nhớ 3D Flashcards, Mini Note hỏa tốc & Trợ lý AI Gemini thông minh.**  
> *Phiên bản hiện tại:* **v4.7.0**  
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

### 🤖 Trợ lý Trí tuệ Nhân tạo (Google Gemini AI)
* **`Ctrl + J`**: Mở / Đóng nhanh thanh Trợ lý AI bên phải màn hình (AI Assistant Sidebar).
* **Menu `✨ AI` khi bôi đen chữ**: Tóm tắt, Viết lại mượt mà, Dịch Anh-Việt, Sửa chính tả & ngữ pháp, Giải thích code, Giải thích thuật ngữ.
* **1-Click AI Tra từ vựng**: Tự động điền phiên âm IPA, chủ đề, nghĩa tiếng Việt chuẩn và câu ví dụ thực tế kèm bản dịch.
* **AI Gia sư chấm bài đặt câu**: Nhận xét ngữ pháp, chấm điểm thang 10 và gợi ý câu tiếng Anh tự nhiên chuẩn bản xứ.
* **AI Trắc nghiệm ôn tập**: Tự động tạo bộ đề trắc nghiệm 5 - 10 câu hỏi từ kho từ vựng cá nhân, chấm điểm và giải thích chi tiết.
* **Điều phối thông minh đa mô hình (Smart Task Routing - v4.2.0)**: Tự động hoán đổi mô hình theo tính chất tác vụ:
  - ⚡ *Tác vụ nhanh (< 1s)*: Tra từ vựng, tạo trắc nghiệm quiz, dịch câu ngắn -> điều phối sang **`Gemini 2.0 Flash`**.
  - 🧠 *Tác vụ nặng & suy nghĩ sâu*: AI Gia sư chấm bài đặt câu, giải thích code thuật toán, viết lại văn phong, trò chuyện Sidebar -> điều phối sang **`Gemini 2.0 Flash Thinking`** hoặc **`Gemini 2.0 Pro`**.
  - Người dùng có thể để chế độ **`🤖 Tự động thông minh`** (mặc định) hoặc ghim cố định một mô hình yêu thích trong Cài đặt.
* **Tự phục hồi & Tự phát hiện Model**: Tự động gọi `ModelService.ListModels` để nhận diện các mô hình khả dụng theo API Key của từng người dùng, hỗ trợ cơ chế fallback đa tầng (`v1beta` & `v1`) bảo đảm không bao giờ đứt đoạn.

### 👥 Đa Không Gian Làm Việc Độc Lập & Cổng Vũ Trụ (Universe Portal & Sub-pages - v4.3.0)
* **Kiến trúc Trang Tổng & Trang Con**:
  - 🌌 **Trang Tổng Universe** (`/`): Cổng điều phối trung tâm tuyệt đẹp, hiển thị thẻ trực quan của 2 không gian, thống kê ghi chú & từ vựng thời gian thực, kèm tùy chọn "Tự động mở không gian gần nhất".
  - 🏫 **Trang Con USER SCHOOL** (`/school`): Không gian Sổ tay & Kho từ vựng chính, chứa 100% dữ liệu hiện hữu.
  - 💧 **Trang Con USER WATER** (`/water`): Không gian Sổ tay & Ý tưởng độc lập thứ hai.
  - ⚡ **Mini Note hỏa tốc** (`/mini`): Hỗ trợ nút gạt nhanh cho cả 2 nhánh.
* **Tách biệt dữ liệu 100%**: Ghi chú, Kho từ vựng, Thẻ nhớ Flashcard và Mini Note nháp/inbox được phân vùng độc lập giữa 2 người dùng (`school` và `water`).
* **1-Click Workspace Switcher**: Bấm trực tiếp vào avatar / tên Workspace ở góc trên bên trái thanh Sidebar để bật popover chuyển đổi tức thì giữa:
  - 🏫 **USER SCHOOL** (Chính): Toàn bộ ghi chú và từ vựng hiện hữu, chủ đề màu Hổ phách (Amber).
  - 💧 **USER WATER** (Nhánh 2): Không gian ghi chú và từ vựng độc lập thứ 2, chủ đề màu Xanh Biển (Cyan/Sky Blue), tự động khởi tạo trang chào mừng riêng.
  - 🌌 **Về Trang Tổng**: Nút quay về Cổng điều phối Universe Portal bất cứ lúc nào.
* **Định tuyến Vercel siêu sạch (`vercel.json`)**: Hỗ trợ Clean URLs rewrite để truy cập trực tiếp `https://schooluniversenotebook.vercel.app/school` và `https://schooluniversenotebook.vercel.app/water` mượt mà không bị chuyển hướng rườm rà.
* **Tương thích ngược tuyệt đối (Zero Data Loss)**: Toàn bộ ghi chú và từ vựng cũ tự động quy thuộc về USER SCHOOL, không mất mát dù chỉ 1 ký tự.
* **Mini Note Phân luồng chuẩn xác**: Mini Note PWA hỗ trợ nút gạt chuyển nhánh nhanh `🏫 SCHOOL` / `💧 WATER`. Khi bấm "Gửi", ghi chú và từ vựng sẽ nạp chuẩn xác vào Inbox của đúng User đang chọn, kèm theo giao diện đổi màu tương ứng.
* **Đồng bộ Cloud Firestore phân vùng**: Các tài liệu `notes` và `vocab_items` trên Firestore mang trường `user: 'school'` hoặc `user: 'water'`, các thiết bị khác nhau chỉ lắng nghe và nạp ghi chú thuộc về User đang kích hoạt.

### 🎧 Nhánh Từ Vựng Bỏ Túi School Vocab (School Vocab Pocket — v4.3.3)
* **Đường dẫn**: `/school/vocab` hoặc `/school/eb`
* **Mục tiêu**: Ứng dụng PWA chuyên biệt cho việc học từ vựng tiếng Anh trên điện thoại di động, tối ưu thao tác 1 tay và dùng tốt khi đang đi ngoài đường.
* **Các tính năng nổi bật**:
  - 🎴 **Lật thẻ 3D vuốt chạm (Swipe Flashcards)**: Chạm để lật thẻ 3D mượt mà. Vuốt sang Phải để đánh dấu Đã nhớ (Mastered), Vuốt sang Trái để đánh dấu Cần ôn (Learning).
  - 🚶 **Chế độ Đi Đường Rảnh Tay (Hands-free Walk Mode)**: Bấm nút tròn trung tâm để kích hoạt chu kỳ tự động: đọc từ vựng tiếng Anh -> tạm dừng 2.5s để não tự nhớ -> tự lật xem nghĩa tiếng Việt -> tự chuyển thẻ kế tiếp. Cực kỳ tiện lợi khi đeo tai nghe đi bộ, đi xe buýt, tập thể dục.
  - 🔊 **Phát âm bản xứ tự nhiên (Web Speech API)**: Phát âm chuẩn En-US với nút Loa to ngay mặt trước thẻ và khả năng tùy chỉnh tốc độ đọc (0.8x, 1.0x, 1.2x).
  - 🎯 **Quiz Phản Xạ 4 Đáp Án**: Luyện phản xạ trắc nghiệm nhanh với chuỗi đúng liên tiếp (Streak) và âm báo rung haptic.
  - 📱 **Tối ưu Vùng ngón cái (Thumb Zone)**: Toàn bộ nút thao tác chính nằm ở nửa dưới màn hình để điều khiển dễ dàng bằng 1 tay khi di chuyển.
  - 📲 **Cài đặt PWA riêng (`manifest-vocab.json`)**: Có thể thêm trực tiếp ra màn hình chính điện thoại như ứng dụng native độc lập, chạy offline 100%.
  - 🔄 **Đồng bộ tự động 2 chiều**: Dùng chung kho từ vựng với Sổ tay School (`schooldb_school_vocab_items` & Firestore `vocab_items`).

### 🃏 Ôn luyện Flashcard 3D
* **`Space` (Phím cách)**: Lật thẻ xem nghĩa và ví dụ / lật lại.
* **`→` (Mũi tên sang phải)**: Chuyển sang thẻ tiếp theo.
* **`←` (Mũi tên sang trái)**: Quay lại thẻ trước đó.
* **Vuốt phải (Cảm ứng)**: Đánh dấu đã thuộc thẻ.
* **Vuốt trái (Cảm ứng)**: Đánh dấu cần ôn lại thẻ.

---

## 5. Lịch sử phiên bản & Sửa lỗi kỹ thuật quan trọng

### 🚀 Phiên bản v4.7.0 (Hiện tại)
* **Tối ưu hóa Luồng Điền & Hiển thị Chuyên biệt cho Từ Viết Tắt (Acronym Dedicated Flow & Layout)**:
  - **Phân tách rạch ròi luồng điền Từ thông thường vs. Từ viết tắt**:
    - **Ô tick `[ ] Là từ viết tắt (Acronym / Abbreviation)`**: Mặc định bỏ chọn cho từ thông thường. Khi tick chọn, ô nhập **"Từ viết tắt"** được kích hoạt và **đẩy lên vị trí đầu tiên**, ô từ chính ở dưới đóng vai trò là **"Dạng đầy đủ tiếng Anh (Full Form)"**, tự động chọn chủ đề `🔤 Từ viết tắt (Acronym)`.
    - **Giao diện sạch sẽ cho từ vựng thông dụng**: Khi không tick, ẩn hoàn toàn ô Full Form, giúp các từ tiếng Anh thường (ví dụ: `Marketing`, `Attract`, `Consume`, `Include`...) có luồng nhập liệu súc tích, trực quan, không bị phân tâm.
  - **Nâng cấp Hiển thị Thẻ Flashcard chuyên nghiệp cho Từ viết tắt**:
    - **Mặt trước (Front Face)**: Chữ viết tắt viết ở **TRÊN** to rõ (ví dụ: **MHU**), Dạng đầy đủ tiếng Anh viết ở **DƯỚI** (*Media Head Unit*) kèm nút nghe phát âm dạng đầy đủ.
    - **Mặt sau (Back Face)**: Hiển thị nổi bật khối **Phiên âm IPA** (`/ˌem.eɪtʃˈjuː/` kèm nút phát âm), **Nghĩa tiếng Việt** chuyên ngành và câu ví dụ.
    - **Với từ vựng thông thường**: Mặt trước hiển thị từ chính và phiên âm IPA, mặt sau hiển thị nghĩa và câu ví dụ.
  - **Cải tiến Bộ Phân Tích & Bảng Xem Trước Nhập Hàng Loạt (Bulk Import)**:
    - Bổ sung tùy chọn `[ ] Nhập từ viết tắt`: Khi không tick (chế độ từ thông thường), bảng xem trước chỉ hiển thị 5 cột (`#`, `Từ tiếng Anh`, `Phiên âm IPA`, `Nghĩa tiếng Việt`, `Chủ đề`) và **ẩn hoàn toàn cột Full Form**, giải quyết dứt điểm hiện tượng phiên âm bị hiểu nhầm thành Full Form.
    - Bóc tách phiên âm thông minh mọi trường hợp: nhận diện chính xác kể cả khi phiên âm có từ loại đi kèm như `/'mɑ:kɪtɪŋ/ (n)- Ngành tiếp thị...` hay `/ə'trækt/ (v) - Hấp dẫn...`.
  - **Lọc riêng Từ viết tắt trên Flashcard & Danh sách**:
    - Khi chọn bộ lọc chủ đề `🔤 Từ viết tắt (Acronym)`, hệ thống tự động lọc toàn bộ thẻ nhớ Flashcard để người học chỉ ôn luyện riêng danh mục từ viết tắt.
  - **Đồng bộ số hiệu phiên bản v4.7.0 cho toàn bộ hệ sinh thái**:
    - Universe Portal (`/`): `v4.7.0`
    - Sổ tay School (`/school`): `v4.7.0`
    - Sổ tay Water (`/water`): `v4.7.0`
    - Mini Note hỏa tốc (`/mini`): `v4.7.0`
    - School Vocab Pocket (`/school/vocab`): `v4.7.0`
    - Service Worker Cache: `schooldb-v4.7.0`

### 🚀 Phiên bản v4.6.0
* **Bổ sung Trích xuất & Tự động tạo Phiên âm IPA chuẩn Quốc tế cho Chế độ Nhập Hàng Loạt (Bulk Import Phonetics & AI IPA)**:
  - Giải quyết trọn vẹn vấn đề thiếu phiên âm khi dán hàng loạt từ vựng (Quizlet / Excel / Text):
    - **Tự động trích xuất phiên âm trực tiếp từ văn bản**:
      - Nhận diện định dạng gõ phiên âm kèm từ: `Include /ɪnˈkluːd/ - Bao gồm` hoặc `Resilience [rɪˈzɪl.jəns] - Khả năng phục hồi nhanh`.
      - Nhận diện phiên âm đặt ở cột / phần riêng: `MHU - Media Head Unit - /ˌem.eɪtʃˈjuː/ - Đầu phát đa phương tiện` hoặc `Word - /ipa/ - Meaning`.
    - **Offline Letter-by-Letter IPA Generator cho Từ Viết Tắt (Acronyms)**:
      - Tích hợp bảng phát âm chữ cái chuẩn IPA cho mọi từ viết tắt (2-7 ký tự hoa): `MHU` $\rightarrow$ `/ˌem.eɪtʃˈjuː/`, `ECU` $\rightarrow$ `/ˌiː.siːˈjuː/`, `OTA` $\rightarrow$ `/ˌoʊ.tiːˈeɪ/`, `API` $\rightarrow$ `/ˌeɪ.piːˈaɪ/`, `CAN` $\rightarrow$ `/ˌsiː.eɪˈen/`... mà không phụ thuộc mạng hay AI.
    - **Nút "✨ AI Điền Phiên Âm IPA" 1-Click (Gemini Batch Phonetics)**:
      - Tích hợp hàm `generateBatchPhonetics(wordList)` trong `ai-service.js` gọi Gemini AI xử lý hàng loạt theo định dạng JSON chuẩn. Chỉ với 1 click, AI tự tra từ điển và điền phiên âm IPA chuẩn xác cho toàn bộ từ tiếng Anh thường (ví dụ: `Microcontroller`, `Latency`, `Concurrency`...) trên bảng xem trước.
    - **Cột & Huy hiệu Phiên âm IPA trực quan trong bảng xem trước**:
      - Bổ sung cột "Phiên âm IPA" riêng biệt trong bảng xem trước trên Desktop (`app.html`), huy hiệu xanh lá monospace nổi bật trên Pocket Mobile (`vocab.html`).
    - **Tùy chọn tự động tạo IPA bằng AI khi nạp (`[x] Tự tạo IPA bằng AI`)**:
      - Tùy chọn tự động quét và điền phiên âm IPA cho những từ còn thiếu ngay khi người dùng nhấn nút "Nhập vào Kho".
  - **Đồng bộ số hiệu phiên bản v4.6.0 cho toàn bộ hệ sinh thái**:
    - Universe Portal (`/`): `v4.6.0`
    - Sổ tay School (`/school`): `v4.6.0`
    - Sổ tay Water (`/water`): `v4.6.0`
    - Mini Note hỏa tốc (`/mini`): `v4.6.0`
    - School Vocab Pocket (`/school/vocab`): `v4.6.0`
    - Service Worker Cache: `schooldb-v4.6.0`

### 🚀 Phiên bản v4.5.0
* **Bổ sung Tính Năng Nhập Từ Vựng Hàng Loạt (Quizlet / Excel / Word Bulk Import)**:
  - Cho phép người dùng dán toàn bộ danh sách hàng chục, hàng trăm từ vựng cùng lúc vào kho chỉ trong **1 giây**:
    - **Phân tách từ & nghĩa linh hoạt**: Hỗ trợ tự động nhận diện (Auto-detect), dấu gạch nối có khoảng trắng (` - `), phím Tab (`\t` - khi copy từ cột bảng tính Excel/Google Sheets), dấu hai chấm (`:`), hoặc dấu phẩy (`,`).
    - **Hỗ trợ định dạng 3 phần thông minh cho Từ Viết Tắt**: Khi dán dòng dạng `MHU - Media Head Unit - Đầu phát đa phương tiện trên ô tô`, hệ thống tự động tách chính xác: Phần 1 = Từ viết tắt (`MHU`), Phần 2 = Full Form tiếng Anh (`Media Head Unit`), Phần 3 = Nghĩa tiếng Việt, và tự động gắn thẻ `🔤 Từ viết tắt (Acronym)`.
    - **Hỗ trợ định dạng 2 phần thông dụng**: `Word - Meaning` (ví dụ `Microcontroller - Vi điều khiển tích hợp vi xử lý`).
    - **Bảng xem trước trực quan tức thì (Live Preview)**: Hiển thị ngay bảng thống kê số thẻ hợp lệ, preview từ, fullform, nghĩa, và tag tương ứng ngay khi đang gõ/dán.
    - **Cơ chế chống trùng lặp (Duplicate Protection)**: Tự động phát hiện và bỏ qua các từ đã có trong kho dữ liệu, bảo đảm không làm rối kho thẻ nhớ.
    - **Nút "Dán mẫu thử" 1-Click**: Cung cấp dữ liệu mẫu sẵn để người dùng bấm thử nghiệm ngay mà không cần tự soạn thảo.
  - **Tích hợp đồng bộ trên cả 2 nền tảng**:
    - **Sổ tay School NoteBook (`/school`)**: Nút "Nhập hàng loạt (Quizlet)" ở đầu kho từ vựng.
    - **School Vocab Pocket PWA (`/school/vocab`)**: Nút biểu tượng Import `📥` trên thanh tiêu đề và liên kết chuyển nhanh trong popup thêm từ.
  - **Đồng bộ Cloud Firestore & Lưu trữ Offline**: Dữ liệu sau khi nạp được lưu tức thì vào `localStorage` và đẩy đồng loạt lên Firestore qua cơ chế `batch write`.
  - **Đồng bộ số hiệu phiên bản v4.5.0 cho toàn bộ hệ sinh thái**:
    - Universe Portal (`/`): `v4.5.0`
    - Sổ tay School (`/school`): `v4.5.0`
    - Sổ tay Water (`/water`): `v4.5.0`
    - Mini Note hỏa tốc (`/mini`): `v4.5.0`
    - School Vocab Pocket (`/school/vocab`): `v4.5.0`
    - Service Worker Cache: `schooldb-v4.5.0`

### 🚀 Phiên bản v4.4.0
* **Bổ sung Danh mục Từ Viết Tắt (Acronym / Abbreviation) & Hỗ trợ English Full Form**:
  - Hỗ trợ học các từ viết tắt chuyên ngành (ví dụ: `MHU`, `ECU`, `OTA`, `API`, `CAN`, `ADAS`, `RAM`, `CPU`, `HTML`, `IoT`...):
    1. **Từ viết tắt (Acronym)**: Hiển thị nổi bật ở mặt trước thẻ, danh sách và bài kiểm tra (ví dụ: `MHU`).
    2. **Dạng đầy đủ tiếng Anh (English Full Form)**: Hiển thị trong khối badge màu xanh cyan cao cấp ở mặt sau thẻ Flashcard (ví dụ: `MEDIA HEAD UNIT`), kèm nút phát âm riêng để nghe chuẩn ngữ điệu cụm từ đầy đủ.
    3. **Nghĩa tiếng Việt chuyên ngành**: Giải thích nghĩa ngữ cảnh kỹ thuật/ô tô chuẩn xác và súc tích (ví dụ: *Đầu phát đa phương tiện trên ô tô (thiết bị điều khiển màn hình và âm thanh giải trí)*).
    4. **Ngữ cảnh & Ví dụ ứng dụng**: Đưa ra câu ví dụ thực tế trong kỹ thuật kèm bản dịch.
  - **Tích hợp Gemini AI Tra từ 1-Click thông minh**:
    - Khi người dùng nhập từ viết tắt (ví dụ `MHU`, `ECU`), bấm "AI Tra từ" sẽ tự động nhận diện từ viết tắt, tự động điền cụm từ đầy đủ `Media Head Unit` vào ô **Full Form**, tự động gán chủ đề `🔤 Từ viết tắt (Acronym)`, dịch nghĩa tiếng Việt sát ngữ cảnh kỹ thuật ô tô/IT và tạo ví dụ thực tế.
    - Hoạt động mượt mà trên cả Sổ tay chính (`app.html`) lẫn ứng dụng bỏ túi School Vocab (`vocab.html`).
  - **Nâng cấp chế độ Đi Đường Rảnh Tay (Hands-free Walk Mode)**:
    - Khi gặp từ viết tắt, hệ thống thông minh phát âm cả 2 phần: Đọc từ viết tắt (`MHU`) -> Đọc dạng đầy đủ (`Media Head Unit`) -> Tạm dừng để người học nhớ nghĩa -> Lật thẻ xem nghĩa tiếng Việt. Tối ưu cực độ cho người vừa đi đường vừa đeo tai nghe.
  - **Nâng cấp Bài kiểm tra (Quiz) & Tìm kiếm**:
    - Tự động gắn nhãn `🔤 TỪ VIẾT TẮT (ACRONYM)` trong bài trắc nghiệm. Khi trả lời, thông báo phản hồi hiển thị kèm tên đầy đủ tiếng Anh để khắc sâu trí nhớ.
    - Tìm kiếm tức thì trong danh sách hỗ trợ tìm theo cả từ viết tắt lẫn cụm từ đầy đủ tiếng Anh (nhập `Media Head Unit` vẫn tìm thấy `MHU`).
  - **Đồng bộ số hiệu phiên bản v4.4.0 cho toàn bộ hệ sinh thái**:
    - Universe Portal (`/`): `v4.4.0`
    - Sổ tay School (`/school`): `v4.4.0`
    - Sổ tay Water (`/water`): `v4.4.0`
    - Mini Note hỏa tốc (`/mini`): `v4.4.0`
    - School Vocab Pocket (`/school/vocab`): `v4.4.0`
    - Service Worker Cache: `schooldb-v4.4.0`

### 🚀 Phiên bản v4.3.9
* **Khắc phục lỗi thanh Trợ lý AI (Gemini AI Sidebar) đè lên trang ghi chú chính**:
  - Cơ chế **Responsive Side-by-Side**: Khi bật thanh AI trên màn hình máy tính (> 768px), trang chính (`.main-content`) tự động thu lùi sang trái (`margin-right: var(--ai-sidebar-width, 400px)`), co dãn lề đệm phù hợp giúp người dùng vừa đọc/sửa ghi chú vừa trò chuyện với AI cùng lúc mà không bị che khuất bất kỳ nội dung hay nút bấm nào.
  - Bổ sung thanh kéo phân cách **`.ai-sidebar-resizer`** ở cạnh trái bảng AI, cho phép tùy chỉnh độ rộng linh hoạt từ 320px đến 750px với chuyển động mượt mà 60fps và tự động ghi nhớ kích thước đã chọn vào `localStorage`.
  - Trên màn hình di động (<= 768px): Bảng AI mở rộng và trang chính tự động lùi sâu trực quan (`scale(0.96) translateX(-15px) opacity(0.5)`), hỗ trợ chạm vào nền hoặc phím `Escape` để đóng nhanh.
  - Nút AI trên thanh công cụ sáng đèn báo trạng thái đang mở (`body.ai-sidebar-open .topbar-ai-btn`).
* **Đồng bộ số hiệu phiên bản v4.3.9 cho toàn bộ hệ sinh thái**:
  - Universe Portal (`/`): `v4.3.9`
  - Sổ tay School (`/school`): `v4.3.9`
  - Sổ tay Water (`/water`): `v4.3.9`
  - Mini Note hỏa tốc (`/mini`): `v4.3.9`
  - School Vocab Pocket (`/school/vocab`): `v4.3.9`

### 🚀 Phiên bản v4.3.8
* **Sửa dứt điểm lỗi giao diện đè tem Header & Tabs trên iPhone (Dynamic Island / Notch)**:
  - Gom toàn bộ thanh tiêu đề `.top-bar` và thanh tab điều hướng `.mode-nav` vào thẻ bao bọc chung `.app-header-sticky`.
  - Căn đệm chuẩn xác theo tai thỏ `padding-top: env(safe-area-inset-top, 0px)` ở cấp container cha, triệt tiêu hoàn toàn lỗi tabs đè lên tiêu đề và thương hiệu School Vocab trên mọi dòng máy iPhone/iPad.
  - Bỏ dòng cảnh báo âm thanh `ios-audio-hint` theo yêu cầu người dùng sau khi đã xác nhận âm thanh hoạt động hoàn hảo.
* **Đồng bộ số hiệu phiên bản v4.3.8 cho toàn bộ hệ sinh thái**.

### 🚀 Phiên bản v4.3.6 - v4.3.7
* **Khắc phục dứt điểm lỗi âm thanh trên iOS Safari**:
  - Chuyển hoàn toàn sang giọng đọc **Apple Siri/Samantha bản xứ** tích hợp sẵn trong WebKit iOS/macOS.
  - Loại bỏ lỗi **404 Not Found** từ máy chủ Google Translate TTS do chính sách chặn Referer bên ngoài.
  - Thực thi phát âm **ĐỒNG BỘ (Synchronously)** trực tiếp trong cú chạm ngón tay của người dùng, vượt qua chính sách kiểm duyệt Autoplay khắt khe của Safari.
  - Tích hợp `navigator.audioSession.type = 'playback'` mở kênh âm thanh Media trên iOS 15+ và gửi câu mồi rỗng (Audio Primer) ngay khi chạm màn hình lần đầu.
* **Khắc phục lỗi đơ nút đáp án Quiz phản xạ (v4.3.6)**:
  - Chuyển cơ chế truyền tham số sang **Index số học mảng (`checkQuizAnswerByIdx(idx)`)**, triệt tiêu 100% lỗi vỡ cú pháp JavaScript/HTML khi từ vựng chứa dấu nháy kép `"`, nháy đơn `'`, dấu ngoặc hoặc ngắt dòng.
  - Khóa thẻ con `.quiz-btn * { pointer-events: none; }` và thêm `touch-action: manipulation` loại bỏ độ trễ 300ms trên điện thoại.

### 🚀 Phiên bản v4.3.4 - v4.3.5
* **Chuẩn hóa nhận diện thương hiệu School Vocab**:
  - Đổi tên toàn bộ nhánh từ vựng bỏ túi thành **School Vocab Pocket** (`/school/vocab`).
  - Cập nhật manifest PWA độc lập `manifest-vocab.json` cho phép cài đặt riêng ra màn hình chính điện thoại.
  - Cải tiến chế độ Đi Đường Rảnh Tay (Hands-free Walk Mode) tự động xoay vòng Flashcard và phát âm.

### 🚀 Phiên bản v4.3.0 - v4.3.3
* **Cổng điều phối Vũ Trụ (Universe Portal) & Sub-pages Clean URLs**:
  - Tách biệt hai không gian làm việc độc lập: **USER SCHOOL** (`/school`) và **USER WATER** (`/water`).
  - Mini Note hỗ trợ chuyển nhánh nạp nhanh vào Inbox tương ứng.
  - Cách ly dữ liệu Cloud Firestore và tự động di trú an toàn ghi chú cũ sang School.

---
*Tài liệu được cập nhật tự động và lưu trữ trực tiếp trong mã nguồn dự án School NoteBook (Phiên bản v4.7.0).*
