# 📋 BÁO CÁO NÂNG CẤP & HOÀN THIỆN TRÌNH SOẠN THẢO (v3.3)

> **Dự án:** School NoteBook  
> **Thời gian cập nhật:** 08/10/2026  
> **Phiên bản:** v3.3  
> **Trạng thái dữ liệu:** An toàn 100% (bảo lưu toàn bộ ghi chú trên localStorage và Firestore)

---

## 1. Tổng hợp 6 vấn đề phản hồi và Giải pháp xử lý triệt để

| STT | Phản hồi của người dùng | Nguyên nhân kỹ thuật | Giải pháp khắc phục triệt để |
|---|---|---|---|
| 1 | **Chế độ lùi dòng cho các Heading cần được cân nhắc lại** | • Phím Tab cho phép Heading lùi dòng vô tận, làm lệch bố cục tiêu đề<br>• Xuống dòng mới (Enter) dưới Heading kế thừa cấp lùi dòng sâu gây khoảng cách thụt lề sai lệch | • Cố định Heading 1 / Toggle H1 ở cấp indent 0 (`margin-left: 0px !important`), chặn phím Tab thụt lề<br>• Giới hạn Heading 2 / Toggle H2 tối đa 1 cấp (24px)<br>• Giới hạn Heading 3 / Toggle H3 tối đa 2 cấp (48px)<br>• Gõ `# ` tự động nhảy về lề ngoài cùng; `## ` tối đa 1 cấp; `### ` tối đa 2 cấp<br>• Nhấn Enter từ Heading 1 thường tự động đặt lùi dòng về 0 cho dòng kế tiếp |
| 2 | **Màu chữ không có màu đen** | • Bảng màu chữ chỉ có các màu sắc phong cách Notion nhưng thiếu màu Đen (`#000000`) và tùy chọn màu mặc định | • Thêm màu **Đen tuyền** (`#000000`) có viền tương phản thích ứng Dark/Light Mode<br>• Thêm nút **Màu mặc định** (`color-dot-default`) để nhanh chóng reset màu chữ về theme<br>• Thêm công cụ **Chọn màu tùy chỉnh** (`<input type="color">`) cho phép chọn mã màu hex tự do |
| 3 | **Khi bôi đen chuyển từ Heading 3 sang Toggle Heading 3 thì không có option đấy** | • Menu chuyển đổi kiểu khối (Bubble Toolbar) trên `index.html` thiếu danh mục Toggle Headings (H1/H2/H3) và Toggle list | • Bổ sung đầy đủ `toggle-h1`, `toggle-h2`, `toggle-h3`, và `toggle` vào `#nft-type-dropdown`<br>• Khối toggle mới tạo tự động mở sẵn (`.open`) kèm icon xoay<br>• Chuyển từ Toggle về Heading thường tự động unhide toàn bộ khối con phía dưới |
| 4 | **Import ảnh vào vẫn còn thừa nhiều chưa cho chỉnh khung ảnh / Vẫn bị khoảng trắng** | • `object-fit: contain` kết hợp `max-height: 60vh` ép trình duyệt tạo khoảng đệm letterboxing (khoảng trắng giả) trên/dưới ảnh<br>• Khi chọn ảnh, hệ thống bôi xanh cả `.block-wrapper` và `.image-block-container` (chiếm 100% bề rộng trang), tạo thành khung viền kép khổng lồ ôm khoảng trống thừa rộng tới 150px<br>• Khoảng trắng và ký tự `\n` trong template HTML bị thuộc tính `white-space: pre-wrap` hiển thị thành dòng văn bản trống | • **Loại bỏ triệt để letterboxing:** chuyển `note-image` sang `display: block; width: 100%; height: auto; object-fit: initial !important;`, ảnh và khung khít 100% không còn 1 pixel thừa<br>• **Viền chọn bám sát ảnh:** Gỡ bỏ outline và nền xanh trên `.block-wrapper` và `.image-block-container`. Khi click ảnh, chỉ riêng `.image-media-wrapper` được bám viền chọn 2px xanh ôm sát mép ảnh như Notion/Figma<br>• **Khử ký tự ngắt dòng thừa:** Triệt tiêu toàn bộ khoảng trắng trong template HTML và đặt `font-size: 0; line-height: 1; white-space: normal !important;` cho khối ảnh<br>• **Bộ công cụ chỉnh khung Notion:** Bổ sung thanh kéo 2 bên (`.image-resize-handle`), 5 mức kích thước nhanh (Vừa, 25%, 50%, 75%, 100%) và 4 kiểu khung (Chuẩn, Bóng đổ, Bo tròn, Không viền) |
| 5 | **Thêm ít màu chữ nữa** | • Bảng màu chỉ có một số màu cơ bản, thiếu sự phong phú | • Mở rộng lên **12 màu chữ** và **11 màu nền highlight**<br>• Bổ sung 2 picker màu tùy chọn (chọn màu chữ và chọn màu nền bất kỳ) |
| 6 | **Không bôi đen được nhiều dòng để chỉnh màu** | • Mỗi dòng là một container `contenteditable="true"` độc lập, lệnh `document.execCommand` mặc định của trình duyệt không hoạt động khi vùng chọn giao thoa nhiều thẻ editable | • Phát triển hệ thống `applyFormattingToSelection()`:<br>  - Khi bôi đen văn bản xuyên nhiều dòng: tự động tách dải chọn (sub-ranges) cho từng khối và áp dụng lệnh độc lập<br>  - Khi chọn nhiều dòng (Multi-block selection): áp dụng trực tiếp `applyBlockFormat()` lên toàn bộ các khối đã chọn<br>  - Hỗ trợ đổi màu chữ, màu nền, in đậm, in nghiêng, gạch chân, xóa định dạng trên nhiều dòng đồng thời |

---

## 2. Danh sách tệp đã cập nhật

1. **`app.js`**:
   - Ràng buộc indentation constraints cho Heading 1, 2, 3 và Toggle Headings trong `handleBlockKeydown`, `handleBlockInput`, và `setBlockType`.
   - Cập nhật `renderImageBlock` hỗ trợ `frameStyle`, thanh kéo resize 2 bên, badge %, các nút preset kích thước và đổi khung ảnh.
   - Loại bỏ toàn bộ khoảng trắng/ký tự xuống dòng trong template HTML của khối ảnh.
   - Cập nhật `insertImageFromFile`, `applyImageToTarget`, và dán markdown image sang kích thước tự nhiên (`fit-content`).
   - Cập nhật `serializeBlocks` lưu trữ toàn vẹn `frameStyle`, `width`, `align`, `caption`.
   - Bổ sung `applyFormattingToSelection`, `applyInlineCommand`, `applyBlockFormat` cho phép định dạng màu xuyên suốt nhiều dòng / nhiều khối.
   - Bổ sung hỗ trợ đầy đủ `toggle-h1`, `toggle-h2`, `toggle-h3`, `toggle` trong `updateBlockTypeBadge`, `getBlockTypeName`, `convertBlockType`.
2. **`styles.css`**:
   - Khử hoàn toàn khoảng trắng thừa của ảnh: loại bỏ `object-fit: contain` gây letterbox, đặt `line-height: 0; font-size: 0; display: inline-block` ôm sát 100% pixel ảnh.
   - Gỡ bỏ outline và nền xanh khổng lồ ở cấp dòng (`.block-wrapper`), chuyển viền chọn trực tiếp ôm sát mép ảnh (`.image-media-wrapper`).
   - Thêm quy tắc cố định lề cho Heading (`margin-left: 0px !important` cho H1 / Toggle H1).
   - Thiết kế giao diện khung ảnh Notion: `.image-inner-frame`, các class khung `frame-standard`, `frame-shadow`, `frame-rounded`, `frame-clean`.
   - Thiết kế 2 thanh kéo `.image-resize-handle.handle-left` và `.handle-right` cùng huy hiệu `.image-resize-badge`.
   - Gắn cố định `.image-toolbar` vào thẻ chứa ảnh.
   - Mở rộng dropdown màu sắc với lưới hiển thị 7 cột, hiệu ứng hover, nút màu đen, màu mặc định, và picker màu.
3. **`index.html`**:
   - Bổ sung các tùy chọn `toggle-h1`, `toggle-h2`, `toggle-h3`, `toggle` vào `#nft-type-dropdown`.
   - Mở rộng bảng màu chữ (12 màu) và bảng màu nền (11 màu) kèm 2 thẻ input color picker.
   - Cập nhật query cache lên `?v=3.4`.
4. **`sw.js` & `mini.html`**:
   - Nâng cấp `CACHE_NAME` lên `schooldb-v3.4` và cập nhật precache urls để trình duyệt tự động nạp phiên bản mới nhất.
