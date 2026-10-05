#!/usr/bin/env node

/**
 * MINI NOTE CLI TOOL — Ghi chú hỏa tốc từ Terminal vào School NoteBook (Inbox)
 * Cách dùng:
 *    node mininote.js "Nội dung ghi chú của bạn"
 * Hoặc:
 *    node mininote.js -t "Tiêu đề" "Nội dung ghi chú"
 * Hoặc tạo việc cần làm:
 *    node mininote.js --todo -t "Việc hôm nay" "Làm bài tập\nNộp báo cáo\nĐiểm danh"
 */

const { firebaseConfig, USE_FIREBASE } = require('./firebase-config.js');
const NoteSchema = require('./shared/note-schema.js');

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
    console.log("\n📚 School NoteBook — Mini Note CLI");
    console.log("-----------------------------------------");
    console.log("👉 Ghi chú nhanh:  node mininote.js \"Giao thức CAN Bus hoạt động theo CSMA/CD\"");
    console.log("👉 Kèm tiêu đề:    node mininote.js -t \"CAN Bus\" \"Tốc độ tối đa 1 Mbps\"");
    console.log("👉 Danh sách việc: node mininote.js --todo -t \"Hôm nay\" \"Việc 1\\nViệc 2\"\n");
    process.exit(1);
}

let title = "⌨️ Ghi chú từ CLI";
let content = "";
let forceType = undefined;

let args = [...rawArgs];
if (args.includes('--todo')) {
    forceType = 'todo';
    args = args.filter(a => a !== '--todo');
}

if (args[0] === '-t' && args.length >= 3) {
    title = args[1];
    content = args.slice(2).join(' ').replace(/\\n/g, '\n');
} else if (args[0] === '-t' && args.length === 2) {
    title = args[1];
    content = "";
} else {
    content = args.join(' ').replace(/\\n/g, '\n');
}

if (!content.trim() && !title.trim()) {
    console.log("❌ Nội dung ghi chú không được để trống!");
    process.exit(1);
}

const page = NoteSchema.makePage({
    title: title,
    content: content,
    forceType: forceType,
    source: 'cli',
    inbox: true
});

if (!USE_FIREBASE || !firebaseConfig.projectId || firebaseConfig.apiKey.includes("ĐIỀN")) {
    console.log("⚠️ Cảnh báo: Chưa cấu hình Firebase trong firebase-config.js!");
    console.log("=> Nội dung ghi nhận (local ID:", page.id, "):", content);
    process.exit(0);
}

function toFirestoreValue(val) {
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return { integerValue: String(val) };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (val && typeof val === 'object') {
        const fields = {};
        for (const k in val) fields[k] = toFirestoreValue(val[k]);
        return { mapValue: { fields } };
    }
    return { nullValue: null };
}

async function syncNote() {
    console.log("🚀 Đang đồng bộ lên School NoteBook Cloud...");
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/notes?documentId=${page.id}&key=${firebaseConfig.apiKey}`;

    const bodyData = {
        fields: {
            id: { stringValue: page.id },
            title: { stringValue: page.title },
            icon: { stringValue: page.icon },
            cover: { nullValue: null },
            blocks: toFirestoreValue(page.blocks),
            tags: toFirestoreValue(page.tags),
            source: { stringValue: 'cli' },
            inbox: { booleanValue: true },
            createdAt: { stringValue: page.createdAt },
            updatedAt: { timestampValue: new Date().toISOString() }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n==============================================");
            console.log("✅ ĐÃ GỬI VÀO INBOX CỦA SCHOOL NOTEBOOK!");
            console.log(`📌 Tiêu đề:  ${page.title}`);
            console.log(`📝 Số block: ${page.blocks.length} khối`);
            console.log(`🆔 Doc ID:   ${page.id}`);
            console.log("==============================================\n");
            console.log("👉 Mở website School NoteBook để xem ghi chú mới xuất hiện tức thì trong mục 📥 Inbox.");
            process.exit(0);
        } else {
            if (data.error && data.error.message.includes("permissions")) {
                console.log("\n⚠️ LỖI QUYỀN TRUY CẬP (PERMISSION_DENIED):");
                console.log("Firestore đang ở chế độ khóa.");
                console.log("Vào Firebase Console -> Firestore -> Rules để cho phép quyền ghi.\n");
            } else {
                console.error("❌ Lỗi từ Firebase:", data.error ? data.error.message : JSON.stringify(data));
            }
            process.exit(1);
        }
    } catch (e) {
        console.error("❌ Lỗi kết nối mạng:", e.message);
        process.exit(1);
    }
}

syncNote();
