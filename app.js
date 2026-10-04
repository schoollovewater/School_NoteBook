document.addEventListener('DOMContentLoaded', () => {
    const editorElement = document.getElementById('main-editor');
    const tooltip = document.getElementById('vocab-tooltip');
    const addVocabBtn = document.getElementById('add-vocab-btn');
    const modal = document.getElementById('vocab-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveVocabBtn = document.getElementById('save-vocab-btn');
    const engWordInput = document.getElementById('eng-word');
    
    // Header actions
    const saveNoteBtn = document.getElementById('save-note-btn');
    const titleInput = document.querySelector('.note-title');
    
    // Theme toggle logic
const themeToggleBtn = document.getElementById('theme-toggle');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });
}
// Apply saved theme on load
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
}

// Initialize Editor.js
    let editor;
    if (editorElement) {
        editor = new EditorJS({
            holder: 'main-editor',
            placeholder: 'Viết ghi chú (gõ "/" để sử dụng tính năng mở rộng như Notion)...',
            tools: {
                header: Header,
                list: typeof EditorjsList !== 'undefined' ? EditorjsList : (typeof List !== 'undefined' ? List : null),
                toggle: {
                    class: typeof ToggleBlock !== 'undefined' ? ToggleBlock : null,
                    inlineToolbar: true,
                },
                image: typeof SimpleImage !== 'undefined' ? SimpleImage : null,
                code: typeof CodeTool !== 'undefined' ? CodeTool : null,
                checklist: typeof Checklist !== 'undefined' ? Checklist : null,
                table: typeof Table !== 'undefined' ? Table : null
            }
        });
    }

    const edjsParser = typeof edjsHTML !== 'undefined' ? edjsHTML({
        toggle: function(block) {
            let itemsHtml = '';
            if (block.data.items && Array.isArray(block.data.items)) {
                itemsHtml = block.data.items.map(item => `<p>${item}</p>`).join('');
            }
            return `<details><summary>${block.data.text}</summary><div>${itemsHtml}</div></details>`;
        },
        checklist: function(block) {
            let itemsHtml = '';
            if (block.data.items && Array.isArray(block.data.items)) {
                itemsHtml = block.data.items.map(item => `<div><input type="checkbox" disabled ${item.checked ? 'checked' : ''}> ${item.text}</div>`).join('');
            }
            return `<div>${itemsHtml}</div>`;
        },
        table: function(block) {
            let rowsHtml = '';
            if (block.data.content && Array.isArray(block.data.content)) {
                rowsHtml = block.data.content.map(row => `<tr>${row.map(cell => `<td style="border: 1px solid #334155; padding: 4px;">${cell}</td>`).join('')}</tr>`).join('');
            }
            return `<table style="width: 100%; border-collapse: collapse; margin: 10px 0;">${rowsHtml}</table>`;
        }
    }) : null;
    
    // Tabs
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    
    // Cloud status elements
    const cloudStatusDot = document.getElementById('cloud-status-dot');
    const cloudStatusText = document.getElementById('cloud-status-text');

    let selectedText = '';

    // ==========================================
    // 1. CẤU HÌNH & KẾT NỐI FIREBASE FIRESTORE
    // ==========================================
    let db = null;
    let isFirebaseReady = false;

    function updateCloudStatus(status, text) {
        if (!cloudStatusDot || !cloudStatusText) return;
        const parent = cloudStatusDot.parentElement;
        if (status === 'connected') {
            cloudStatusDot.style.background = '#10b981';
            cloudStatusDot.style.boxShadow = '0 0 8px #10b981';
            cloudStatusText.innerText = text || 'Đồng bộ Cloud';
            if (parent) {
                parent.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                parent.style.background = 'rgba(16, 185, 129, 0.1)';
            }
            cloudStatusText.style.color = '#10b981';
        } else if (status === 'warning') {
            cloudStatusDot.style.background = '#f59e0b';
            cloudStatusDot.style.boxShadow = '0 0 8px #f59e0b';
            cloudStatusText.innerText = text || 'Chưa mở quyền (dùng Local)';
            if (parent) {
                parent.style.borderColor = 'rgba(245, 158, 11, 0.3)';
                parent.style.background = 'rgba(245, 158, 11, 0.1)';
            }
            cloudStatusText.style.color = '#f59e0b';
        } else {
            cloudStatusDot.style.background = '#64748b';
            cloudStatusDot.style.boxShadow = 'none';
            cloudStatusText.innerText = text || 'Chế độ máy cục bộ';
            if (parent) {
                parent.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                parent.style.background = 'rgba(100, 116, 139, 0.1)';
            }
            cloudStatusText.style.color = '#94a3b8';
        }
    }

    if (typeof USE_FIREBASE !== 'undefined' && USE_FIREBASE && window.firebase && window.firebaseConfig && !window.firebaseConfig.apiKey.includes("ĐIỀN")) {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            isFirebaseReady = true;
            updateCloudStatus('connected', 'Cloud sẵn sàng');
            console.log("🔥 Đã kết nối Firebase Cloud Firestore!");
        } catch (err) {
            console.warn("Lỗi khởi tạo Firebase:", err);
            updateCloudStatus('warning', 'Lỗi Cloud (dùng Local)');
        }
    } else {
        updateCloudStatus('offline', 'Chế độ máy cá nhân');
    }

    // ==========================================
    // 2. RENDER VÀ ĐỒNG BỘ DỮ LIỆU
    // ==========================================
    function showToast(message, type = "success") {
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.backgroundColor = type === 'success' ? '#10B981' : '#EF4444';
        toast.style.color = '#fff';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        toast.style.zIndex = '99999';
        toast.style.fontFamily = 'Inter, sans-serif';
        toast.style.fontWeight = '500';
        toast.innerText = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function renderNotes() {
        const notesList = document.getElementById('notes-list');
        if (!notesList) return;
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        
        if (notes.length === 0) {
            notesList.innerHTML = '<p style="color: #94a3b8; grid-column: 1/-1;">Chưa có ghi chú nào. Hãy tạo một ghi chú mới!</p>';
            return;
        }

        notesList.innerHTML = notes.map((note, idx) => `
            <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <h3 style="color: #3b82f6; font-size: 18px; margin: 0; word-break: break-word;">${note.title || 'Không tiêu đề'}</h3>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-note-btn" data-index="${idx}" data-id="${note.id || ''}" style="background: none; border: none; color: #10b981; cursor: pointer; padding: 4px; font-size: 16px;" title="Sửa ghi chú"><i class="ph ph-pencil-simple"></i></button>
                        <button class="delete-note-btn" data-index="${idx}" data-id="${note.id || ''}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; font-size: 16px;" title="Xóa ghi chú"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 12px; word-break: break-word; overflow: hidden; max-height: 150px;">${
                    (typeof note.content === 'object' && note.content !== null && edjsParser) 
                    ? edjsParser.parse(note.content).join('') 
                    : (note.content || '')
                }</div>
                <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b; font-size: 12px; border-top: 1px solid #334155; padding-top: 10px;">
                    <span>${note.date ? new Date(note.date).toLocaleString('vi-VN') : 'Mới tạo'}</span>
                    ${note.id ? '<span style="color: #10b981;">☁️ Cloud</span>' : '<span style="color: #94a3b8;">💾 Local</span>'}
                </div>
            </div>
        `).join('');

        // Gán sự kiện xóa
        document.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-id');
                const noteIndex = parseInt(btn.getAttribute('data-index'));
                
                if (confirm('Bạn có chắc chắn muốn xóa ghi chú này?')) {
                    if (isFirebaseReady && db && noteId) {
                        try {
                            await db.collection("notes").doc(noteId).delete();
                            showToast("Đã xóa ghi chú trên Cloud!");
                        } catch (err) {
                            console.error("Lỗi xóa Cloud:", err);
                        }
                    }
                    
                    let curNotes = JSON.parse(localStorage.getItem('notes') || '[]');
                    curNotes.splice(noteIndex, 1);
                    localStorage.setItem('notes', JSON.stringify(curNotes));
                    renderNotes();
                    showToast("Đã xóa ghi chú!");
                }
            });
        });

        // Gán sự kiện sửa
        document.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const noteIndex = parseInt(btn.getAttribute('data-index'));
                const noteId = btn.getAttribute('data-id');
                const curNotes = JSON.parse(localStorage.getItem('notes') || '[]');
                const note = curNotes[noteIndex];
                
                if (titleInput) titleInput.value = note.title !== 'Không tiêu đề' ? note.title : '';
                
                if (editor) {
                    await editor.isReady;
                    if (typeof note.content === 'object' && note.content !== null) {
                        try {
                            await editor.render(note.content);
                        } catch (err) {
                            console.error("Lỗi render note:", err);
                        }
                    } else if (typeof note.content === 'string') {
                        // Khôi phục ghi chú cũ dạng string bằng cách nhét vào một block văn bản
                        await editor.render({
                            blocks: [{ type: "paragraph", data: { text: note.content } }]
                        });
                    }
                }
                
                // Đổi tab sang Ghi chú mới
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
                document.getElementById('view-new-note').classList.remove('hidden');
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                const newNoteTab = Array.from(document.querySelectorAll('.nav-item')).find(n => n.getAttribute('data-view') === 'view-new-note');
                if (newNoteTab) newNoteTab.classList.add('active');
                
                // Lưu state đang edit
                if (saveNoteBtn) {
                    saveNoteBtn.setAttribute('data-editing-index', noteIndex);
                    saveNoteBtn.setAttribute('data-editing-id', noteId || '');
                    saveNoteBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Cập nhật Ghi Chú';
                }
            });
        });
    }

    function renderVocab() {
        const tbody = document.getElementById('vocab-table-body');
        if (!tbody) return;
        const vocabList = JSON.parse(localStorage.getItem('vocab_list') || '[]');
        
        if (vocabList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #94a3b8;">Chưa có từ vựng nào được lưu.</td></tr>';
            return;
        }

        tbody.innerHTML = vocabList.map((v, idx) => `
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 15px 10px; font-weight: 600; color: #f8fafc;">${v.word}</td>
                <td style="padding: 15px 10px; color: #10b981;">${v.meaning}</td>
                <td style="padding: 15px 10px; color: #94a3b8; font-size: 14px;">${v.context || '-'}</td>
                <td style="padding: 15px 10px; text-align: right;">
                    <button class="delete-vocab-btn" data-index="${idx}" data-id="${v.id || ''}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;" title="Xóa từ vựng"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.delete-vocab-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const vocabId = btn.getAttribute('data-id');
                const vocabIndex = parseInt(btn.getAttribute('data-index'));
                
                if (confirm('Xóa từ vựng này?')) {
                    if (isFirebaseReady && db && vocabId) {
                        try {
                            await db.collection("vocab_list").doc(vocabId).delete();
                        } catch (err) {
                            console.error("Lỗi xóa Cloud:", err);
                        }
                    }
                    let curVocab = JSON.parse(localStorage.getItem('vocab_list') || '[]');
                    curVocab.splice(vocabIndex, 1);
                    localStorage.setItem('vocab_list', JSON.stringify(curVocab));
                    renderVocab();
                    showToast("Đã xóa từ vựng!");
                }
            });
        });
    }

    // Lắng nghe dữ liệu thời gian thực từ Cloud Firestore
    function initRealtimeSync() {
        if (!isFirebaseReady || !db) {
            renderNotes();
            renderVocab();
            return;
        }

        // Đồng bộ Notes
        db.collection("notes").orderBy("date", "desc").onSnapshot((snapshot) => {
            const cloudNotes = [];
            snapshot.forEach(doc => {
                cloudNotes.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('notes', JSON.stringify(cloudNotes));
            updateCloudStatus('connected', 'Cloud: Đã đồng bộ');
            renderNotes();
        }, (error) => {
            console.warn("Lỗi đồng bộ Cloud Notes:", error);
            if (error.code === 'permission-denied') {
                updateCloudStatus('warning', 'Cần mở Rules Cloud');
            } else {
                updateCloudStatus('warning', 'Cloud Ngoại Tuyến');
            }
            renderNotes();
        });

        // Đồng bộ Từ Vựng
        db.collection("vocab_list").orderBy("date", "desc").onSnapshot((snapshot) => {
            const cloudVocab = [];
            snapshot.forEach(doc => {
                cloudVocab.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('vocab_list', JSON.stringify(cloudVocab));
            renderVocab();
        }, (error) => {
            console.warn("Lỗi đồng bộ Cloud Vocab:", error);
            renderVocab();
        });
    }

    // ==========================================
    // 3. GRAPH & FLASHCARD LOGIC
    // ==========================================
    let network = null;
    function renderGraph() {
        const container = document.getElementById('mynetwork');
        if (!container) return;
        
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const nodesData = [];
        const edgesData = [];
        
        nodesData.push({ id: 0, label: 'EngiHub\nTri Thức', shape: 'circle', color: '#3b82f6', font: {color: 'white'} });
        
        notes.forEach((note, index) => {
            const nodeId = index + 1;
            nodesData.push({
                id: nodeId,
                label: note.title ? (note.title.length > 20 ? note.title.substring(0, 20) + '...' : note.title) : 'Ghi chú',
                shape: 'box',
                color: '#1e293b',
                font: {color: '#f8fafc'}
            });
            edgesData.push({ from: 0, to: nodeId, color: {color: '#334155'} });
        });

        const data = {
            nodes: new vis.DataSet(nodesData),
            edges: new vis.DataSet(edgesData)
        };
        const options = {
            nodes: {
                borderWidth: 1,
                borderWidthSelected: 2,
            },
            physics: {
                stabilization: false,
                barnesHut: {
                    gravitationalConstant: -2000,
                    springConstant: 0.04,
                    springLength: 150
                }
            }
        };
        
        if (network) network.destroy();
        network = new vis.Network(container, data, options);
    }

    let currentFcIndex = 0;
    let vocabForFc = [];
    
    function updateFlashcardUI() {
        const fcEmpty = document.getElementById('flashcard-empty');
        const fcArea = document.getElementById('flashcard-area');
        
        if (vocabForFc.length === 0) {
            if (fcEmpty) fcEmpty.style.display = 'block';
            if (fcArea) fcArea.style.display = 'none';
            return;
        }
        
        if (fcEmpty) fcEmpty.style.display = 'none';
        if (fcArea) fcArea.style.display = 'flex';
        
        document.getElementById('fc-counter').innerText = `${currentFcIndex + 1} / ${vocabForFc.length}`;
        document.getElementById('fc-word').innerText = vocabForFc[currentFcIndex].word;
        document.getElementById('fc-meaning').innerText = vocabForFc[currentFcIndex].meaning;
        document.getElementById('fc-context').innerText = vocabForFc[currentFcIndex].context || 'Không có ngữ cảnh';
        
        document.getElementById('flip-card').classList.remove('flipped');
    }

    function renderFlashcards() {
        vocabForFc = JSON.parse(localStorage.getItem('vocab_list') || '[]');
        currentFcIndex = 0;
        updateFlashcardUI();
    }

    const flipCard = document.getElementById('flip-card');
    if (flipCard) {
        flipCard.addEventListener('click', () => {
            flipCard.classList.toggle('flipped');
        });
    }

    const btnNext = document.getElementById('fc-next');
    const btnPrev = document.getElementById('fc-prev');
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentFcIndex < vocabForFc.length - 1) {
                currentFcIndex++;
                updateFlashcardUI();
            }
        });
    }
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentFcIndex > 0) {
                currentFcIndex--;
                updateFlashcardUI();
            }
        });
    }

    // ==========================================
    // 4. EDITOR & SELECTION TOOLTIP
    // ==========================================
    document.addEventListener('selectionchange', () => {
        if (!editorElement) return;
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            if (editorElement.contains(range.commonAncestorContainer)) {
                selectedText = selection.toString().trim();
                if (selectedText.length > 0 && selectedText.length < 50) {
                    const rect = range.getBoundingClientRect();
                    tooltip.style.left = `${rect.left + window.scrollX}px`;
                    tooltip.style.top = `${rect.top + window.scrollY - 40}px`;
                    tooltip.classList.remove('hidden');
                } else {
                    tooltip.classList.add('hidden');
                }
            } else if (!tooltip.contains(selection.anchorNode)) {
                tooltip.classList.add('hidden');
            }
        } else {
            tooltip.classList.add('hidden');
        }
    });
    
    // Autosave title draft
    if (editorElement && titleInput) {
        titleInput.addEventListener('input', () => {
            localStorage.setItem('temp_title', titleInput.value);
        });
    }

    document.addEventListener('mousedown', (e) => {
        if (!tooltip.contains(e.target) && (!editorElement || !editorElement.contains(e.target))) {
            tooltip.classList.add('hidden');
        }
    });

    if (addVocabBtn) {
        addVocabBtn.addEventListener('click', (e) => {
            e.preventDefault();
            engWordInput.value = selectedText;
            modal.classList.remove('hidden');
            tooltip.classList.add('hidden');
            document.getElementById('vn-meaning').focus();
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    // ==========================================
    // 5. LƯU DỮ LIỆU (TỪ VỰNG & GHI CHÚ)
    // ==========================================
    if (saveVocabBtn) {
        saveVocabBtn.addEventListener('click', async () => {
            const vnMeaning = document.getElementById('vn-meaning').value.trim();
            const context = document.getElementById('context-note').value.trim();
            
            if (vnMeaning) {
                const newVocab = {
                    word: selectedText,
                    meaning: vnMeaning,
                    context,
                    date: new Date().toISOString()
                };

                let vocabList = JSON.parse(localStorage.getItem('vocab_list') || '[]');
                vocabList.unshift(newVocab);
                localStorage.setItem('vocab_list', JSON.stringify(vocabList));

                if (isFirebaseReady && db) {
                    try {
                        const docRef = await db.collection("vocab_list").add(newVocab);
                        newVocab.id = docRef.id;
                        showToast(`Đã lưu lên Cloud: ${selectedText}`);
                    } catch (err) {
                        console.error("Lỗi Cloud:", err);
                        showToast(`Đã lưu cục bộ: ${selectedText}`);
                    }
                } else {
                    showToast(`Đã lưu từ vựng: ${selectedText}`);
                }

                modal.classList.add('hidden');
                document.getElementById('vn-meaning').value = '';
                document.getElementById('context-note').value = '';
                if (window.getSelection) { window.getSelection().removeAllRanges(); }
                
                renderVocab();
            } else {
                showToast('Vui lòng nhập nghĩa tiếng Việt!', 'error');
            }
        });
    }

    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', async () => {
            const title = titleInput.value.trim();
            
            let outputData = null;
            if (editor) {
                outputData = await editor.save();
            }

            if (!title && (!outputData || outputData.blocks.length === 0)) {
                showToast('Ghi chú đang trống!', 'error');
                return;
            }

            const editingIndex = saveNoteBtn.getAttribute('data-editing-index');
            const editingId = saveNoteBtn.getAttribute('data-editing-id');

            const newNote = {
                title: title || 'Không tiêu đề',
                content: outputData,
                date: new Date().toISOString()
            };

            let notes = JSON.parse(localStorage.getItem('notes') || '[]');

            if (editingIndex !== null && editingIndex !== '') {
                const idx = parseInt(editingIndex);
                newNote.id = editingId || notes[idx].id;
                notes[idx] = newNote;
                localStorage.setItem('notes', JSON.stringify(notes));

                if (isFirebaseReady && db && newNote.id) {
                    try {
                        await db.collection("notes").doc(newNote.id).update({
                            title: newNote.title,
                            content: newNote.content,
                            date: newNote.date
                        });
                        showToast('Đã cập nhật ghi chú lên Cloud!');
                    } catch (err) {
                        console.error("Lỗi Cloud:", err);
                        showToast('Đã cập nhật cục bộ (Lỗi Cloud)', 'warning');
                    }
                } else {
                    showToast('Đã cập nhật ghi chú cục bộ!');
                }

                saveNoteBtn.removeAttribute('data-editing-index');
                saveNoteBtn.removeAttribute('data-editing-id');
                saveNoteBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Lưu Ghi Chú';
            } else {
                notes.unshift(newNote);
                localStorage.setItem('notes', JSON.stringify(notes));

                if (isFirebaseReady && db) {
                    try {
                        const docRef = await db.collection("notes").add(newNote);
                        newNote.id = docRef.id;
                        notes[0] = newNote; // Cập nhật lại ID
                        localStorage.setItem('notes', JSON.stringify(notes));
                        showToast('Đã lưu ghi chú lên Cloud!');
                    } catch (err) {
                        console.error("Lỗi Cloud:", err);
                        showToast('Đã lưu cục bộ (Chưa lên Cloud)', 'warning');
                    }
                } else {
                    showToast('Đã lưu ghi chú thành công!');
                }
            }
            
            // Xóa bản nháp
            localStorage.removeItem('temp_title');

            titleInput.value = '';
            if (editor) {
                try {
                    if (editor.blocks && editor.blocks.getBlocksCount() > 0) {
                        editor.blocks.clear();
                    } else if (typeof editor.clear === 'function') {
                        editor.clear();
                    }
                } catch(e) {}
            }
            
            renderNotes();
        });
    }

    // ==========================================
    // 6. CHUYỂN TAB & KHỞI TẠO BAN ĐẦU
    // ==========================================
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            viewSections.forEach(section => {
                section.classList.add('hidden');
            });
            
            const targetId = item.getAttribute('data-view');
            if (targetId) {
                const targetView = document.getElementById(targetId);
                if (targetView) {
                    targetView.classList.remove('hidden');
                }
                
                if (targetId === 'view-all-notes') renderNotes();
                if (targetId === 'view-vocab') renderVocab();
                if (targetId === 'view-graph') setTimeout(renderGraph, 100);
                if (targetId === 'view-flashcard') renderFlashcards();
            }
        });
    });

    // Khôi phục nháp
    if (editor) {
        const savedTitle = localStorage.getItem('temp_title');
        if (savedTitle && titleInput) titleInput.value = savedTitle;
    }

    // Bắt đầu đồng bộ
    initRealtimeSync();
});
