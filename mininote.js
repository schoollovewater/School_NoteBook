#!/usr/bin/env node

/**
 * MINI NOTE CLI TOOL - SIÊU NHẸ (KHÔNG CẦN CÀI ĐẶT THƯ VIỆN)
 * Cách dùng:
 *    node mininote.js "Nội dung ghi chú của bạn"
 * Hoặc:
 *    node mininote.js -t "Tiêu đề" "Nội dung ghi chú"
 */

const { firebaseConfig, USE_FIREBASE } = require('./firebase-config.js');

const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
    console.log("\n❌ Bạn chưa nhập nội dung ghi chú!");
    console.log("👉 Ví dụ: node mininote.js \"Giao thức CAN Bus hoạt động theo cơ chế CSMA/CD\"");
    console.log("👉 Hoặc:  node mininote.js -t \"CAN Bus\" \"Tốc độ tối đa 1 Mbps\"\n");
    process.exit(1);
}

let title = "Ghi chú từ Mini Note";
let content = "";

if (rawArgs[0] === '-t' && rawArgs.length >= 3) {
    title = rawArgs[1];
    content = rawArgs.slice(2).join(' ');
} else {
    content = rawArgs.join(' ');
}

if (!USE_FIREBASE || !firebaseConfig.projectId || firebaseConfig.apiKey.includes("ĐIỀN")) {
    console.log("⚠️ Cảnh báo: Chưa cấu hình Firebase trong firebase-config.js!");
    console.log("=> Nội dung:", content);
    process.exit(0);
}

async function syncNote() {
    console.log("🚀 Đang đồng bộ lên Cloud...");
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/notes?key=${firebaseConfig.apiKey}`;

    const bodyData = {
        fields: {
            title: { stringValue: title },
            content: { stringValue: content },
            tldr: { stringValue: content.length > 60 ? content.substring(0, 60) + '...' : content },
            date: { stringValue: new Date().toISOString() }
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
            console.log("✅ ĐỒNG BỘ THÀNH CÔNG LÊN CLOUD!");
            console.log(`📌 Tiêu đề: ${title}`);
            console.log(`📝 Nội dung: ${content}`);
            console.log("==============================================\n");
            console.log("👉 Mở website EngiHub để xem ghi chú mới xuất hiện tức thì.");
            process.exit(0);
        } else {
            if (data.error && data.error.message.includes("permissions")) {
                console.log("\n⚠️ LỖI QUYỀN TRUY CẬP (PERMISSION_DENIED):");
                console.log("Firestore đang ở chế độ khóa (Production Rules).");
                console.log("Bạn cần vào Firebase Console -> Firestore Database -> Rules -> Đổi thành 'allow read, write: if true;' và bấm Publish.\n");
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
