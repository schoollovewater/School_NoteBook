// --- CONFIG & STATE ---
const APP_VERSION = 'v3.9';
const appState = {
    theme: localStorage.getItem('theme') || 'dark',
    activePageId: null,
    pages: {} // In-memory cache
};

// --- DOM ELEMENTS ---
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    pageTitleInput: document.getElementById('page-title'),
    blockEditor: document.getElementById('block-editor'),
    slashMenu: document.getElementById('slash-menu'),
    pageList: document.getElementById('page-list'),
    breadcrumb: document.getElementById('breadcrumb'),
    saveStatus: document.getElementById('save-status'),
    vocabContainer: document.getElementById('vocab-container'),
    editorContainer: document.getElementById('editor-container')
};

// --- FIREBASE SYNC ---
let db;
let firebaseSyncTimeout;
let vocabSyncTimeout;

if (typeof window.USE_FIREBASE !== 'undefined' && window.USE_FIREBASE) {
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    db = firebase.firestore();
    try {
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore multi-tab persistence: active in another tab');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not supported in this browser');
            }
        });
    } catch (e) {
        console.warn('Firestore persistence init warning:', e);
    }
}

function broadcastLocalChange(type, payload) {
    if ('BroadcastChannel' in window) {
        try {
            const ch = new BroadcastChannel(NoteSchema.CHANNEL);
            ch.postMessage(Object.assign({ type: type }, payload || {}));
        } catch (e) {}
    }
}

function updateSyncStatusUI(status, customMsg) {
    const el = (typeof elements !== 'undefined' && elements.saveStatus) || document.getElementById('save-status');
    if (!el) return;
    
    el.className = 'save-status ' + (status || '');
    let icon = 'ri-cloud-line';
    let text = 'Đã lưu';

    switch (status) {
        case 'saving':
            icon = 'ri-loader-4-line ri-spin';
            text = customMsg || 'Đang lưu...';
            break;
        case 'syncing':
            icon = 'ri-refresh-line ri-spin';
            text = customMsg || 'Đang đồng bộ...';
            break;
        case 'synced':
            icon = 'ri-checkbox-circle-line';
            text = customMsg || 'Đã đồng bộ';
            break;
        case 'offline':
            icon = 'ri-wifi-off-line';
            text = customMsg || 'Offline (Lưu máy)';
            break;
        case 'error':
            icon = 'ri-error-warning-line';
            text = customMsg || 'Lỗi Cloud';
            break;
        case 'local-only':
            icon = 'ri-save-line';
            text = customMsg || 'Đã lưu máy';
            break;
        default:
            icon = 'ri-checkbox-circle-line';
            text = customMsg || 'Đã đồng bộ';
    }

    el.innerHTML = `<i class="${icon}"></i> <span class="save-status-text">${text}</span>`;
}

// --- INITIALIZATION ---
function initApp() {
    applyTheme(appState.theme);
    initSortable();
    
    elements.themeToggle.addEventListener('click', () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', appState.theme);
        applyTheme(appState.theme);
    });

    elements.pageTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            focusFirstBlockOrCreate();
        }
    });
    
    elements.pageTitleInput.addEventListener('input', () => {
        updatePageTitle(elements.pageTitleInput.value);
        triggerSave();
    });

    elements.pageTitleInput.addEventListener('paste', (e) => {
        let text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        text = (text || '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
        if (text.includes('\n')) {
            e.preventDefault();
            const lines = text.split('\n');
            elements.pageTitleInput.value = lines[0].trim();
            updatePageTitle(elements.pageTitleInput.value);

            const remainingLines = lines.slice(1);
            let firstBlock = elements.blockEditor.querySelector('.block-wrapper');
            let insertAfter = null;

            remainingLines.forEach(line => {
                if (!line.trim() && !insertAfter) return;
                const newWrapper = createBlockElement('text', escapeHtml(line), generateId(), 0);
                if (!insertAfter) {
                    if (firstBlock) {
                        elements.blockEditor.insertBefore(newWrapper, firstBlock);
                    } else {
                        elements.blockEditor.appendChild(newWrapper);
                    }
                } else {
                    insertAfter.parentNode.insertBefore(newWrapper, insertAfter.nextSibling);
                }
                insertAfter = newWrapper;
            });
            updateNumberPrefixes();
            triggerSave();
        }
    });

    document.getElementById('new-page-btn').addEventListener('click', createNewPage);
    const sidebarNewBtn = document.getElementById('sidebar-new-page-btn');
    if (sidebarNewBtn) sidebarNewBtn.addEventListener('click', createNewPage);

    // Header Actions
    document.getElementById('add-cover-btn').addEventListener('click', addCover);
    document.getElementById('add-icon-btn').addEventListener('click', changeIcon);
    document.querySelector('.change-cover-btn').addEventListener('click', changeCover);
    document.getElementById('page-icon').addEventListener('click', changeIcon);
    
    // Sidebar Actions
    document.getElementById('search-btn').addEventListener('click', openSearchModal);
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-modal').style.display = 'flex';
        document.getElementById('setting-workspace-name').value = localStorage.getItem('schooldb_workspace') || 'School NoteBook';
        const settingVer = document.getElementById('setting-app-version');
        if (settingVer) settingVer.textContent = APP_VERSION;
    });
    
    // Settings Save
    document.getElementById('setting-workspace-name').addEventListener('input', (e) => {
        const newName = e.target.value;
        localStorage.setItem('schooldb_workspace', newName);
        document.querySelector('.workspace-name').textContent = newName || 'School NoteBook';
        updatePageTitle(elements.pageTitleInput.value);
    });

    // Force Update / Clear Cache & Reload
    const forceUpdateBtn = document.getElementById('btn-force-update');
    if (forceUpdateBtn) {
        forceUpdateBtn.addEventListener('click', async () => {
            forceUpdateBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Đang làm mới...';
            try {
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (let reg of regs) {
                        await reg.unregister();
                    }
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    for (let key of keys) {
                        await caches.delete(key);
                    }
                }
                showToast('🔄 Đã dọn dẹp cache, đang nạp bản mới nhất...');
                setTimeout(() => {
                    window.location.reload(true);
                }, 500);
            } catch (err) {
                console.error('Lỗi khi làm mới cache:', err);
                window.location.reload(true);
            }
        });
    }
    
    // Topbar Actions (Share & More)
    const shareBtn = document.getElementById('topbar-share-btn');
    const moreBtn = document.getElementById('topbar-more-btn');
    const sharePopover = document.getElementById('share-popover');
    const morePopover = document.getElementById('more-popover');
    
    if (shareBtn && sharePopover) {
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (morePopover) morePopover.style.display = 'none';
            const isVisible = sharePopover.style.display === 'block';
            if (isVisible) {
                sharePopover.style.display = 'none';
                return;
            }
            const rect = shareBtn.getBoundingClientRect();
            sharePopover.style.display = 'block';
            sharePopover.style.top = `${rect.bottom + 8}px`;
            sharePopover.style.right = `${Math.max(16, window.innerWidth - rect.right)}px`;
        });
    }

    if (moreBtn && morePopover) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sharePopover) sharePopover.style.display = 'none';
            const isVisible = morePopover.style.display === 'block';
            if (isVisible) {
                morePopover.style.display = 'none';
                return;
            }
            const rect = moreBtn.getBoundingClientRect();
            morePopover.style.display = 'block';
            morePopover.style.top = `${rect.bottom + 8}px`;
            morePopover.style.right = '16px';
            
            // Sync states with active page
            const page = appState.pages[appState.activePageId];
            if (page) {
                const font = page.font || 'default';
                morePopover.querySelectorAll('.font-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-font') === font);
                });
                const switchSmall = document.getElementById('switch-small-text');
                if (switchSmall) switchSmall.checked = !!page.smallText;
                const switchFull = document.getElementById('switch-full-width');
                if (switchFull) switchFull.checked = !!page.fullWidth;
                const switchLock = document.getElementById('switch-lock-page');
                if (switchLock) switchLock.checked = !!page.locked;
            }
        });
    }

    // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+K, Ctrl+B, Ctrl+I, Ctrl+D, Ctrl+L, Ctrl+N)
    document.addEventListener('keydown', (e) => {
        const isStandardInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.target.id !== 'page-title-input';
        if (isStandardInput) return;

        // Undo: Ctrl+Z (Cmd+Z)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            EditorHistory.undo();
            return;
        }
        // Redo: Ctrl+Y (Cmd+Y) or Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
            e.preventDefault();
            EditorHistory.redo();
            return;
        }
        // Delete current line / selected block: Ctrl+Shift+K (hoặc khi chọn khối nhấn Backspace/Delete)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const activeEl = document.activeElement;
            const currentWrapper = (typeof selectedBlockWrappers !== 'undefined' && selectedBlockWrappers && selectedBlockWrappers.length > 0)
                ? selectedBlockWrappers[0]
                : (activeEl ? activeEl.closest('.block-wrapper') : null);
            if (currentWrapper && elements.blockEditor && elements.blockEditor.contains(currentWrapper)) {
                EditorHistory.recordBeforeAction();
                const prev = currentWrapper.previousElementSibling || currentWrapper.nextElementSibling;
                if (typeof selectedBlockWrappers !== 'undefined' && selectedBlockWrappers && selectedBlockWrappers.length > 0) {
                    selectedBlockWrappers.forEach(w => w.remove());
                    clearBlockSelection();
                } else {
                    currentWrapper.remove();
                }
                if (prev) {
                    const nextContent = prev.querySelector('.block-content');
                    if (nextContent && nextContent.contentEditable !== 'false') setCaretAtStart(nextContent);
                } else {
                    focusFirstBlockOrCreate();
                }
                updateNumberPrefixes();
                triggerSave();
                EditorHistory.updateLastSnapshot();
                showToast('🗑️ Đã xóa dòng');
                return;
            }
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearchModal();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            app.duplicateCurrentPage();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            app.copyPageLink();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            document.execCommand('bold', false, null);
            e.preventDefault();
            triggerSave();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
            document.execCommand('italic', false, null);
            e.preventDefault();
            triggerSave();
        }
    });

    // Modal Close Logic
    document.getElementById('search-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('search-modal')) {
            document.getElementById('search-modal').style.display = 'none';
        }
    });

    // Click outside slash menu and popovers to close
    document.addEventListener('click', (e) => {
        if (!elements.slashMenu.contains(e.target)) {
            closeSlashMenu();
        }
        
        // Close popovers if clicked outside
        const emojiPicker = document.getElementById('emoji-picker');
        const coverPicker = document.getElementById('cover-picker');
        const morePopover = document.getElementById('more-popover');
        const sharePopover = document.getElementById('share-popover');
        if (emojiPicker && !emojiPicker.contains(e.target) && !e.target.closest('#add-icon-btn') && !e.target.closest('#page-icon')) {
            emojiPicker.style.display = 'none';
        }
        if (coverPicker && !coverPicker.contains(e.target) && !e.target.closest('#add-cover-btn') && !e.target.closest('.change-cover-btn')) {
            coverPicker.style.display = 'none';
        }
        if (sharePopover && !sharePopover.contains(e.target) && !e.target.closest('#topbar-share-btn')) {
            sharePopover.style.display = 'none';
        }
        if (morePopover && !morePopover.contains(e.target) && !e.target.closest('#topbar-more-btn')) {
            morePopover.style.display = 'none';
        }
    });

    initPopovers();
    initSidebarResizer();
    initMultiBlockSelection();
    // Initialize Slash menu clicks
    document.querySelectorAll('.slash-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const type = item.getAttribute('data-type');
            applySlashCommand(type);
        });
    });

    initFloatingToolbar();
    vocab.initVocab();
    initImageModal();
    initImageLightbox();
    initEditorDragDrop();

    // Flashcard Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const flashcardView = document.getElementById('vocab-flashcard-view');
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        if (flashcardView && flashcardView.style.display !== 'none' && !isTyping) {
            if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                vocab.flipCurrentCard();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                vocab.prevCard();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                vocab.nextCard();
            } else if (e.key === '1') {
                vocab.markCard(false);
            } else if (e.key === '2') {
                vocab.markCard(true);
            }
        }
    });

    // Load initial data
    loadPages();
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    elements.themeToggle.innerHTML = theme === 'dark' ? '<i class="ri-moon-line"></i>' : '<i class="ri-sun-line"></i>';
}

// --- DATA MANAGEMENT ---
// Fake ID generator
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function createNewPage() {
    const id = generateId();
    appState.pages[id] = {
        id: id,
        title: '',
        icon: '📄',
        blocks: [{ id: generateId(), type: 'text', content: '' }]
    };
    openPage(id);
    saveToStorage();
    renderSidebar();
}

function showCloudLoadingPlaceholder() {
    if (elements.pageTitleInput) elements.pageTitleInput.value = '';
    if (elements.blockEditor) {
        elements.blockEditor.innerHTML = `
            <div class="cloud-loading-banner" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <i class="ri-refresh-line ri-spin" style="font-size: 36px; display: block; margin-bottom: 12px; color: var(--accent-color);"></i>
                <div style="font-size: 16px; font-weight: 500;">Đang kết nối và tải ghi chú từ Cloud...</div>
                <div style="font-size: 13px; margin-top: 6px; opacity: 0.7;">Dữ liệu sẽ hiển thị ngay khi đồng bộ xong</div>
            </div>
        `;
    }
}

function createDefaultWelcomePage() {
    const defaultId = generateId();
    appState.pages[defaultId] = {
        id: defaultId,
        title: 'Welcome to School NoteBook',
        icon: '👋',
        blocks: [
            { id: generateId(), type: 'h1', content: 'Chào mừng bạn!' },
            { id: generateId(), type: 'text', content: 'Gõ / để mở menu lệnh.' }
        ]
    };
    saveToStorage();
    renderSidebar();
    openPage(defaultId);
}

function loadPages() {
    const stored = localStorage.getItem('schooldb_pages');
    let hasLocalPages = false;
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                appState.pages = parsed;
                hasLocalPages = true;
                renderSidebar();
                const firstPageId = Object.keys(appState.pages)[0];
                if (firstPageId) openPage(firstPageId);
            }
        } catch (e) {
            console.warn('Lỗi đọc local pages:', e);
        }
    }

    if (!hasLocalPages) {
        if (!db) {
            createDefaultWelcomePage();
        } else {
            showCloudLoadingPlaceholder();
        }
    }

    const workspaceName = localStorage.getItem('schooldb_workspace');
    if (workspaceName) {
        const wsEl = document.querySelector('.workspace-name');
        if (wsEl) wsEl.textContent = workspaceName;
    }
    
    // Realtime sync from cloud + cross-tab sync (Mini Note on same device)
    startCloudSync();
    startLocalSync();
    setupNetworkSyncListeners();
}

// --- REALTIME SYNC ---
// Nhận ghi chú từ Firestore theo thời gian thực. Ghi chú định dạng cũ ({title, content})
// do Mini Note / CLI cũ gửi lên sẽ được chuyển sang blocks và ghi đè lại lên Cloud.
function isEditingActivePage() {
    const ae = document.activeElement;
    return !!ae && (ae === elements.pageTitleInput || (elements.blockEditor && elements.blockEditor.contains(ae)));
}

function startCloudSync() {
    if (!db) {
        updateSyncStatusUI('local-only');
        return;
    }

    updateSyncStatusUI(navigator.onLine ? 'syncing' : 'offline', navigator.onLine ? 'Đang kết nối Cloud...' : 'Offline (Lưu máy)');

    // 1. Sync ghi chú (notes)
    db.collection('notes').onSnapshot(snapshot => {
        let sidebarDirty = false;
        let activeDirty = false;
        let newInbox = 0;

        if (snapshot.empty && Object.keys(appState.pages).length === 0) {
            createDefaultWelcomePage();
            updateSyncStatusUI('synced');
            return;
        }

        snapshot.docChanges().forEach(change => {
            const doc = change.doc;
            if (doc.metadata.hasPendingWrites) return; // echo of our own local write

            if (change.type === 'removed') {
                if (appState.pages[doc.id]) {
                    delete appState.pages[doc.id];
                    sidebarDirty = true;
                    if (doc.id === appState.activePageId) activeDirty = true;
                }
                return;
            }

            const result = NoteSchema.normalizeRemoteNote(doc.id, doc.data());
            if (!result) return;
            const page = result.page;
            const existed = !!appState.pages[page.id];

            if (result.migrated) {
                db.collection('notes').doc(doc.id).set(pageToCloud(page))
                    .catch(err => console.warn('Migration write failed:', err));
            }

            // Không ghi đè trang đang được gõ dở
            if (page.id === appState.activePageId && isEditingActivePage()) return;

            appState.pages[page.id] = Object.assign({}, appState.pages[page.id] || {}, page);
            sidebarDirty = true;
            
            // Cập nhật trang đang mở: nếu trùng activePageId, hoặc chưa mở trang nào hợp lệ
            if (page.id === appState.activePageId || !appState.activePageId || !appState.pages[appState.activePageId]) {
                activeDirty = true;
                if (!appState.activePageId || !appState.pages[appState.activePageId]) {
                    appState.activePageId = page.id;
                }
            }
            if (!existed && page.inbox && change.type === 'added' && cloudSyncReady) newInbox++;
        });

        if (sidebarDirty) {
            localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
            renderSidebar();
        }
        if (activeDirty) {
            if (appState.pages[appState.activePageId]) openPage(appState.activePageId);
            else openFirstPageOrCreate();
        }
        if (newInbox > 0) showToast(`📥 ${newInbox} ghi chú mới từ Mini Note`);
        
        // Đẩy bất kỳ trang local nào chưa có trên Cloud lên (initial push nếu app 1 có trang cũ)
        if (!cloudSyncReady) {
            pushLocalMissingPagesToCloud();
        }
        cloudSyncReady = true;
        updateSyncStatusUI(navigator.onLine ? 'synced' : 'offline');
    }, err => {
        console.error('Firebase realtime error:', err);
        updateSyncStatusUI('error');
    });

    // 2. Đồng bộ Kho từ vựng hai chiều (vocab_items)
    db.collection('vocab_items').onSnapshot(snapshot => {
        let vocabDirty = false;
        snapshot.docChanges().forEach(change => {
            if (change.doc.metadata.hasPendingWrites) return;
            const id = change.doc.id;
            const data = change.doc.data();
            if (change.type === 'removed') {
                const idx = vocab.items.findIndex(i => i.id === id);
                if (idx !== -1) {
                    vocab.items.splice(idx, 1);
                    vocabDirty = true;
                }
            } else if (change.type === 'added' || change.type === 'modified') {
                if (data && data.word) {
                    const existingIdx = vocab.items.findIndex(i => i.id === id);
                    if (existingIdx !== -1) {
                        vocab.items[existingIdx] = Object.assign({}, vocab.items[existingIdx], data);
                    } else {
                        vocab.items.unshift(data);
                    }
                    vocabDirty = true;
                }
            }
        });
        if (vocabDirty) {
            localStorage.setItem('schooldb_vocab_items', JSON.stringify(vocab.items));
            vocab.renderStats();
            vocab.renderGrid();
            if (vocab.currentView === 'flashcard') vocab.initDeck();
        }
    }, err => console.warn('vocab_items sync warning:', err));

    // 3. Từ vựng gửi từ Mini Note ở thiết bị khác (vocab_inbox trung chuyển)
    db.collection('vocab_inbox').onSnapshot(snapshot => {
        let added = 0;
        snapshot.docChanges().forEach(change => {
            if (change.type !== 'added' || change.doc.metadata.hasPendingWrites) return;
            const data = change.doc.data();
            if (data && data.word && !vocab.items.some(i => i.id === data.id)) {
                const item = Object.assign(NoteSchema.makeVocabItem(data), data.id ? { id: data.id } : {});
                vocab.items.unshift(item);
                added++;
                db.collection('vocab_items').doc(item.id).set(item).catch(() => {});
            }
            change.doc.ref.delete().catch(() => {});
        });
        if (added) {
            vocab.save();
            vocab.renderGrid();
            vocab.initDeck();
            showToast(`📚 Đã nhận ${added} từ vựng mới từ Mini Note`);
        }
    }, err => console.warn('vocab_inbox sync error:', err));
}

async function pushLocalMissingPagesToCloud() {
    if (!db || !navigator.onLine) return;
    try {
        const localPageIds = Object.keys(appState.pages);
        if (localPageIds.length === 0) return;
        
        const batch = db.batch();
        let batchCount = 0;
        for (const id of localPageIds) {
            const page = appState.pages[id];
            if (page) {
                batch.set(db.collection('notes').doc(id), pageToCloud(page), { merge: true });
                batchCount++;
                if (batchCount >= 400) break;
            }
        }
        if (batchCount > 0) {
            await batch.commit();
        }

        if (vocab && Array.isArray(vocab.items) && vocab.items.length > 0) {
            const vBatch = db.batch();
            let vCount = 0;
            vocab.items.forEach(item => {
                if (item && item.id && item.word) {
                    vBatch.set(db.collection('vocab_items').doc(item.id), item, { merge: true });
                    vCount++;
                    if (vCount >= 400) return;
                }
            });
            if (vCount > 0) {
                await vBatch.commit();
            }
        }
    } catch (e) {
        console.warn('pushLocalMissingPagesToCloud warning:', e);
    }
}

async function syncAllToCloud(silent = false) {
    if (!db) {
        if (!silent) showToast('⚠️ Chưa cấu hình Firebase Cloud');
        return;
    }
    if (!navigator.onLine) {
        if (!silent) showToast('📡 Đang ngoại tuyến. Dữ liệu đã lưu an toàn trên máy.');
        updateSyncStatusUI('offline');
        return;
    }

    updateSyncStatusUI('syncing', 'Đang đồng bộ...');
    try {
        if (appState.activePageId && appState.pages[appState.activePageId]) {
            appState.pages[appState.activePageId].title = elements.pageTitleInput.value;
            appState.pages[appState.activePageId].blocks = serializeBlocks();
            localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
        }

        const pageIds = Object.keys(appState.pages);
        const batch = db.batch();
        let count = 0;
        for (const id of pageIds) {
            const page = appState.pages[id];
            if (page) {
                batch.set(db.collection('notes').doc(id), pageToCloud(page), { merge: true });
                count++;
                if (count >= 400) break;
            }
        }

        if (vocab && Array.isArray(vocab.items)) {
            vocab.items.forEach(item => {
                if (item && item.id && item.word) {
                    batch.set(db.collection('vocab_items').doc(item.id), item, { merge: true });
                }
            });
        }

        await batch.commit();
        updateSyncStatusUI('synced');
        broadcastLocalChange('pages-updated', { count });
        broadcastLocalChange('vocab-updated');
        if (!silent) {
            showToast(`☁️ Đã đồng bộ ${count} ghi chú & ${vocab.items.length} từ vựng lên Cloud!`);
        }
    } catch (err) {
        console.error('Manual sync error:', err);
        updateSyncStatusUI('error');
        if (!silent) showToast('❌ Lỗi đồng bộ: ' + (err.message || 'Thử lại'));
    }
}

function setupNetworkSyncListeners() {
    window.addEventListener('online', () => {
        console.log('Network connected. Resuming cloud sync...');
        showToast('🌐 Đã có mạng trở lại! Đang tự động đồng bộ...');
        updateSyncStatusUI('syncing', 'Đang đồng bộ...');
        if (db && typeof db.enableNetwork === 'function') {
            db.enableNetwork().catch(() => {});
        }
        syncAllToCloud(true);
    });

    window.addEventListener('offline', () => {
        console.log('Network disconnected.');
        showToast('📡 Đang ngoại tuyến. Dữ liệu sẽ lưu trên máy và đồng bộ khi có mạng.');
        updateSyncStatusUI('offline');
    });
}
let cloudSyncReady = false;

// Mini Note mở cùng trình duyệt ghi thẳng vào localStorage → cập nhật ngay, kể cả khi offline
function startLocalSync() {
    const reloadPagesFromStorage = () => {
        try {
            const stored = JSON.parse(localStorage.getItem('schooldb_pages') || '{}');
            const activeId = appState.activePageId;
            const editing = isEditingActivePage();
            const activeCopy = appState.pages[activeId];
            appState.pages = stored;
            if (editing && activeCopy) appState.pages[activeId] = activeCopy;
            renderSidebar();
            if (!editing) {
                if (appState.pages[activeId]) openPage(activeId);
                else openFirstPageOrCreate();
            }
        } catch (e) { console.warn('Local sync failed:', e); }
    };
    const reloadVocab = () => {
        vocab.initVocab();
    };

    window.addEventListener('storage', (e) => {
        if (e.key === 'schooldb_pages') reloadPagesFromStorage();
        if (e.key === 'schooldb_vocab_items') reloadVocab();
        if (e.key === 'theme' && e.newValue) {
            appState.theme = e.newValue;
            applyTheme(appState.theme);
        }
    });

    if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel(NoteSchema.CHANNEL);
        ch.onmessage = (e) => {
            if (!e.data) return;
            if (e.data.type === 'pages-updated') {
                reloadPagesFromStorage();
                if (e.data.count) showToast(`📥 ${e.data.count} ghi chú mới từ Mini Note`);
            }
            if (e.data.type === 'vocab-updated') {
                reloadVocab();
                if (e.data.count) showToast(`📚 Đã thêm ${e.data.count} từ vựng từ Mini Note`);
            }
        };
    }
}

function openFirstPageOrCreate() {
    const firstId = Object.keys(appState.pages)[0];
    if (firstId) openPage(firstId);
    else createNewPage();
}

function pageToCloud(pageData) {
    return {
        id: pageData.id,
        title: pageData.title || '',
        icon: pageData.icon || '📄',
        cover: pageData.cover || null,
        blocks: pageData.blocks || [],
        tags: pageData.tags || [],
        source: pageData.source || 'app',
        inbox: !!pageData.inbox,
        createdAt: pageData.createdAt || new Date().toISOString(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

// --- EDITOR HISTORY (UNDO / REDO SYSTEM) ---
const EditorHistory = {
    undoStack: [],
    redoStack: [],
    maxHistory: 60,
    isApplying: false,
    lastTypingTime: 0,
    lastTypingBlockId: null,
    lastSavedSnapshot: null,
    saveSnapTimeout: null,

    createSnapshot() {
        if (!appState.activePageId) return null;
        return {
            pageId: appState.activePageId,
            title: elements.pageTitleInput ? elements.pageTitleInput.value : '',
            blocks: serializeBlocks(),
            activeBlockId: activeBlockId || null
        };
    },

    init() {
        this.undoStack = [];
        this.redoStack = [];
        this.lastTypingTime = 0;
        this.lastTypingBlockId = null;
        this.lastSavedSnapshot = this.createSnapshot();
    },

    recordBeforeAction() {
        if (this.isApplying) return;
        if (!this.lastSavedSnapshot) {
            this.lastSavedSnapshot = this.createSnapshot();
        }
        if (this.lastSavedSnapshot && this.lastSavedSnapshot.blocks) {
            const last = this.undoStack[this.undoStack.length - 1];
            const isDup = last && 
                last.pageId === this.lastSavedSnapshot.pageId && 
                last.title === this.lastSavedSnapshot.title && 
                JSON.stringify(last.blocks) === JSON.stringify(this.lastSavedSnapshot.blocks);
            if (!isDup) {
                this.undoStack.push(this.lastSavedSnapshot);
                if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            }
        }
        this.redoStack = [];
    },

    updateLastSnapshot() {
        if (this.isApplying) return;
        this.lastSavedSnapshot = this.createSnapshot();
    },

    recordTyping(e) {
        if (this.isApplying) return;
        const now = Date.now();
        const data = e && e.data;
        const isWordBoundary = (data === ' ' || data === '.' || data === ',' || data === '!' || data === '?');
        const isNewBurst = isWordBoundary || (now - this.lastTypingTime > 600) || (this.lastTypingBlockId !== activeBlockId);
        if (isNewBurst) {
            this.recordBeforeAction();
        }
        this.lastTypingTime = now;
        this.lastTypingBlockId = activeBlockId;
        clearTimeout(this.saveSnapTimeout);
        this.saveSnapTimeout = setTimeout(() => {
            this.updateLastSnapshot();
        }, 300);
    },

    record(force = false, e = null) {
        if (force) {
            this.recordBeforeAction();
            setTimeout(() => this.updateLastSnapshot(), 0);
        } else {
            this.recordTyping(e);
        }
    },

    applyState(state) {
        if (!state || state.pageId !== appState.activePageId) return;
        this.isApplying = true;
        try {
            if (elements.pageTitleInput) {
                elements.pageTitleInput.value = state.title || '';
                updatePageTitle(state.title);
            }
            renderBlocks(state.blocks || []);
            if (appState.pages[appState.activePageId]) {
                appState.pages[appState.activePageId].title = state.title || '';
                appState.pages[appState.activePageId].blocks = state.blocks || [];
            }
            clearBlockSelection();
            updateNumberPrefixes();
            saveToStorage();

            if (state.activeBlockId) {
                const targetWrapper = document.querySelector(`.block-wrapper[data-id="${state.activeBlockId}"]`);
                if (targetWrapper) {
                    const contentEl = targetWrapper.querySelector('.block-content');
                    if (contentEl && contentEl.contentEditable !== 'false') {
                        setCaretAtEnd(contentEl);
                    }
                }
            }
            this.lastSavedSnapshot = state;
        } finally {
            this.isApplying = false;
        }
    },

    undo() {
        if (this.undoStack.length === 0) {
            showToast('ℹ️ Không có thao tác trước đó để hoàn tác');
            return;
        }
        const current = this.createSnapshot();
        if (current) this.redoStack.push(current);

        const prev = this.undoStack.pop();
        if (prev) {
            this.applyState(prev);
            showToast('↩️ Đã hoàn tác (Ctrl+Z)');
        }
    },

    redo() {
        if (this.redoStack.length === 0) {
            showToast('ℹ️ Không có thao tác nào để làm lại');
            return;
        }
        const current = this.createSnapshot();
        if (current) this.undoStack.push(current);

        const next = this.redoStack.pop();
        if (next) {
            this.applyState(next);
            showToast('↪️ Đã làm lại (Ctrl+Y)');
        }
    }
};

let saveTimeout;
function triggerSave() {
    updateSyncStatusUI('saving');
    clearTimeout(saveTimeout);
    
    // Update active page state from DOM
    if (appState.activePageId && appState.pages[appState.activePageId]) {
        appState.pages[appState.activePageId].title = elements.pageTitleInput.value;
        appState.pages[appState.activePageId].blocks = serializeBlocks();
    }

    refreshToc();

    saveTimeout = setTimeout(() => {
        saveToStorage();
    }, 400);
}

function saveToStorage() {
    // 1. Save locally immediately
    localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
    
    // Broadcast to other open tabs on same device
    broadcastLocalChange('pages-updated', { activeId: appState.activePageId });

    // 2. Sync to Firebase (Debounced)
    if (db) {
        clearTimeout(firebaseSyncTimeout);
        updateSyncStatusUI('syncing');
        firebaseSyncTimeout = setTimeout(() => {
            // Sync active page
            if (appState.activePageId && appState.pages[appState.activePageId]) {
                const pageData = appState.pages[appState.activePageId];
                db.collection('notes').doc(appState.activePageId).set(pageToCloud(pageData), { merge: true })
                .then(() => {
                    updateSyncStatusUI(navigator.onLine ? 'synced' : 'offline');
                })
                .catch(err => {
                    console.error("Firebase sync error:", err);
                    updateSyncStatusUI('error');
                });
            } else {
                updateSyncStatusUI(navigator.onLine ? 'synced' : 'offline');
            }
        }, 800);
    } else {
        updateSyncStatusUI('local-only');
    }
}

function showToast(msg) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.textContent = msg;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- UI UPDATES ---
function renderSidebar() {
    elements.pageList.innerHTML = '';
    const inboxList = document.getElementById('inbox-list');
    const inboxSection = document.getElementById('inbox-section');
    const inboxCount = document.getElementById('inbox-count');
    if (inboxList) inboxList.innerHTML = '';

    const pages = Object.values(appState.pages);
    const inboxPages = pages
        .filter(p => p.inbox)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const makeItem = (page) => {
        const li = document.createElement('li');
        li.className = `page-item ${page.id === appState.activePageId ? 'active' : ''}`;
        li.innerHTML = `
            <div class="page-item-content">
                <span class="page-icon">${escapeHtml(page.icon || '📄')}</span>
                <span class="page-title">${escapeHtml(page.title || 'Untitled')}</span>
            </div>
            <div class="page-item-actions">
                <button class="page-item-action-btn delete-btn" title="Xóa trang này" type="button">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;
        li.onclick = () => { openPage(page.id); closeMobileSidebar(); };
        const delBtn = li.querySelector('.delete-btn');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deletePage(page.id);
            };
        }
        return li;
    };

    pages.filter(p => !p.inbox || !inboxList).forEach(page => elements.pageList.appendChild(makeItem(page)));
    if (inboxList) inboxPages.forEach(page => inboxList.appendChild(makeItem(page)));
    if (inboxSection) inboxSection.style.display = inboxPages.length ? '' : 'none';
    if (inboxCount) inboxCount.textContent = inboxPages.length;
    const navBadge = document.getElementById('mobile-inbox-badge');
    if (navBadge) {
        navBadge.textContent = inboxPages.length;
        navBadge.style.display = inboxPages.length ? '' : 'none';
    }
}

function deletePage(pageId) {
    if (!pageId) return;
    const page = appState.pages[pageId];
    const pageTitle = page ? (page.title || 'Untitled') : 'trang này';
    if (!confirm(`Bạn có chắc chắn muốn xóa trang "${pageTitle}" không?`)) {
        return;
    }
    delete appState.pages[pageId];
    if (db) {
        db.collection('notes').doc(pageId).delete().catch(err => console.warn('Cloud delete error:', err));
    }
    localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
    broadcastLocalChange('pages-updated', { deletedId: pageId });
    renderSidebar();
    showToast(`Đã xóa trang "${pageTitle}"`);
    if (pageId === appState.activePageId) {
        const remainingIds = Object.keys(appState.pages);
        if (remainingIds.length > 0) {
            openPage(remainingIds[0]);
        } else {
            createNewPage();
        }
    }
}

function toggleSidebarSection(secName) {
    const sec = document.getElementById(`${secName}-section`);
    if (!sec) return;
    sec.classList.toggle('is-collapsed');
    const isCollapsed = sec.classList.contains('is-collapsed');
    localStorage.setItem(`schooldb_section_collapsed_${secName}`, isCollapsed ? '1' : '0');
}

function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    const savedWidth = localStorage.getItem('schooldb_sidebar_width');
    if (savedWidth) {
        sidebar.style.width = `${savedWidth}px`;
    }

    // Restore section collapse states
    ['inbox', 'private', 'tools'].forEach(secName => {
        if (localStorage.getItem(`schooldb_section_collapsed_${secName}`) === '1') {
            const sec = document.getElementById(`${secName}-section`);
            if (sec) sec.classList.add('is-collapsed');
        }
    });

    let isResizing = false;
    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        resizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 500) newWidth = 500;
        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const finalWidth = parseInt(sidebar.style.width, 10);
            if (!isNaN(finalWidth)) {
                localStorage.setItem('schooldb_sidebar_width', finalWidth);
            }
        }
    });
}

function updatePageTitle(title) {
    const pageItem = document.querySelector(`.page-item.active .page-title`);
    if (pageItem) pageItem.textContent = title || 'Untitled';
    const page = appState.pages[appState.activePageId];
    const icon = page ? (page.icon || '📄') : '📄';
    const workspaceName = localStorage.getItem('schooldb_workspace') || 'School NoteBook';
    elements.breadcrumb.innerHTML = `
        <span class="bc-workspace" style="cursor:pointer;" onclick="elements.vocabContainer.style.display='none';elements.editorContainer.style.display='block';"><i class="ri-book-2-line" style="margin-right:4px;"></i>${workspaceName}</span>
        <span style="opacity:0.4; margin:0 6px;">/</span>
        <span class="bc-page" style="color:var(--text-primary); font-weight:500;">
            <span style="margin-right:4px;">${icon}</span>
            <span>${title || 'Untitled'}</span>
        </span>
    `;
}

function applyLockState(locked) {
    const content = document.querySelector('.page-content');
    if (content) content.classList.toggle('is-locked', locked);
    elements.pageTitleInput.readOnly = locked;
    document.querySelectorAll('.block-content').forEach(el => {
        const type = el.getAttribute('data-type');
        if (type !== 'divider' && type !== 'image' && type !== 'toc') {
            el.contentEditable = !locked;
        }
    });
    document.querySelectorAll('.block-handle').forEach(h => {
        h.style.display = locked ? 'none' : '';
    });
    const addCoverBtn = document.getElementById('add-cover-btn');
    const addIconBtn = document.getElementById('add-icon-btn');
    if (addCoverBtn) addCoverBtn.style.display = locked ? 'none' : '';
    if (addIconBtn) addIconBtn.style.display = locked ? 'none' : '';
}

function openPage(id) {
    if (!appState.pages[id]) return;
    appState.activePageId = id;
    
    // Toggle UI
    elements.editorContainer.style.display = 'block';
    elements.vocabContainer.style.display = 'none';

    const page = appState.pages[id];
    elements.pageTitleInput.value = page.title;
    document.getElementById('page-icon').textContent = page.icon || '📄';
    
    const coverEl = document.getElementById('page-cover');
    if (page.cover) {
        coverEl.style.display = 'block';
        coverEl.querySelector('img').src = page.cover;
    } else {
        coverEl.style.display = 'none';
    }

    // Apply font
    const font = page.font || 'default';
    elements.editorContainer.setAttribute('data-font', font);
    
    // Apply small text
    const isSmall = !!page.smallText;
    document.querySelector('.page-content').classList.toggle('small-text', isSmall);
    
    // Apply full width
    const isFull = !!page.fullWidth;
    document.querySelector('.page-content').classList.toggle('full-width', isFull);

    updatePageTitle(page.title);

    // Inbox banner (ghi chú từ Mini Note / CLI / chia sẻ)
    const banner = document.getElementById('inbox-banner');
    if (banner) {
        banner.style.display = page.inbox ? 'flex' : 'none';
        const srcLabel = { mini: 'Mini Note', cli: 'CLI', share: 'chia sẻ' }[page.source] || 'ghi nhanh';
        const label = banner.querySelector('.inbox-banner-text');
        if (label) {
            const tags = (page.tags || []).map(t => `<span class="inbox-tag">#${escapeHtml(t)}</span>`).join(' ');
            label.innerHTML = `📥 Ghi chú từ <b>${srcLabel}</b> đang nằm trong Inbox ${tags}`;
        }
    }
    
    renderBlocks(page.blocks);
    EditorHistory.init();
    
    // Apply lock state
    applyLockState(!!page.locked);
    
    renderSidebar(); // Update active state
}

// --- PAGE HEADER ACTIONS (ICON & COVER) ---
const curatedCovers = [
    // Tech & Coding
    {
        cat: 'tech',
        title: 'Cyber Code Matrix',
        url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80'
    },
    {
        cat: 'tech',
        title: 'Minimalist Workspace',
        url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80'
    },
    {
        cat: 'tech',
        title: 'Cyber Security Grid',
        url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80'
    },
    {
        cat: 'tech',
        title: 'Processor Chipset',
        url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80'
    },
    {
        cat: 'tech',
        title: 'Developer Keyboard',
        url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1200&q=80'
    },

    // Study & Learning
    {
        cat: 'study',
        title: 'Classic Library',
        url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80'
    },
    {
        cat: 'study',
        title: 'Study Desk & Coffee',
        url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&q=80'
    },
    {
        cat: 'study',
        title: 'Stationery & Notes',
        url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&q=80'
    },
    {
        cat: 'study',
        title: 'Campus Architecture',
        url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80'
    },
    {
        cat: 'study',
        title: 'Open Journal Notebook',
        url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80'
    },

    // Nature & Calm
    {
        cat: 'nature',
        title: 'Misty Pine Forest',
        url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=1200&q=80'
    },
    {
        cat: 'nature',
        title: 'Sunset Ocean Horizon',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80'
    },
    {
        cat: 'nature',
        title: 'Emerald Green Forest',
        url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80'
    },
    {
        cat: 'nature',
        title: 'Milky Way & Starry Night',
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80'
    },
    {
        cat: 'nature',
        title: 'Spring Sakura Blossom',
        url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200&q=80'
    },

    // Modern Gradient & Abstract
    {
        cat: 'gradient',
        title: 'Holographic Pastel',
        url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80'
    },
    {
        cat: 'gradient',
        title: 'Deep Purple Aurora',
        url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&q=80'
    },
    {
        cat: 'gradient',
        title: 'Sunset Coral Mesh',
        url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80'
    },
    {
        cat: 'gradient',
        title: 'Neon Fluid 3D Wave',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80'
    },
    {
        cat: 'gradient',
        title: 'Warm Peach Glow',
        url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200&q=80'
    }
];

const emojiData = [
    // Study & Learning (Học tập)
    { emoji: '📚', cat: 'study', kw: 'sach book doc read study giao trinh' },
    { emoji: '📖', cat: 'study', kw: 'sach mo open book study doc' },
    { emoji: '✏️', cat: 'study', kw: 'but chi pencil write viet ghi chep' },
    { emoji: '📝', cat: 'study', kw: 'ghi chu note memo paper bai tap' },
    { emoji: '🎓', cat: 'study', kw: 'tot nghiep graduate university cap hoc dai hoc' },
    { emoji: '🔬', cat: 'study', kw: 'kinh hien vi microscope science khoa hoc lab' },
    { emoji: '🧪', cat: 'study', kw: 'ong nghiem test tube chemistry hoa hoc thi nghiem' },
    { emoji: '📐', cat: 'study', kw: 'thuoc ke ruler math toan hinh hoc' },
    { emoji: '🔭', cat: 'study', kw: 'kinh thien van telescope astronomy vu tru sao' },
    { emoji: '💡', cat: 'study', kw: 'bong den idea sang tao light bulb y tuong' },
    { emoji: '🧠', cat: 'study', kw: 'nao bo brain tu duy mind think tri tue' },
    { emoji: '📊', cat: 'study', kw: 'bieu do chart analytics data thong ke cot' },
    { emoji: '📈', cat: 'study', kw: 'tang truong chart growth trend up phat trien' },
    { emoji: '📌', cat: 'study', kw: 'dinh ghim pin ghim attach quan trong' },
    { emoji: '📋', cat: 'study', kw: 'clipboard bang ghi chep ke hoach plan danh sach' },
    { emoji: '🔖', cat: 'study', kw: 'bookmark the danh dau doc sach luu lai' },

    // Tech & Coding (Công nghệ)
    { emoji: '💻', cat: 'tech', kw: 'may tinh laptop computer code lap trinh dev' },
    { emoji: '🖥️', cat: 'tech', kw: 'man hinh monitor desktop pc display may tinh ban' },
    { emoji: '⌨️', cat: 'tech', kw: 'ban phim keyboard go phim typing go' },
    { emoji: '🖱️', cat: 'tech', kw: 'chuot mouse click chuot may tinh' },
    { emoji: '📱', cat: 'tech', kw: 'dien thoai phone mobile smartphone app' },
    { emoji: '⚙️', cat: 'tech', kw: 'cai dat gear setting config tool thiet lap' },
    { emoji: '🔧', cat: 'tech', kw: 'co le wrench tool fix sua chua debug' },
    { emoji: '🔨', cat: 'tech', kw: 'bua hammer build xay dung cong cu' },
    { emoji: '🚀', cat: 'tech', kw: 'ten lua rocket launch deploy khoi nghiep toc do' },
    { emoji: '🤖', cat: 'tech', kw: 'robot ai bot automation tri tue nhan tao tu dong' },
    { emoji: '🌐', cat: 'tech', kw: 'web internet network mang toan cau website' },
    { emoji: '🔒', cat: 'tech', kw: 'khoa lock security bao mat password mat khau' },
    { emoji: '📡', cat: 'tech', kw: 've tinh satellite antenna tin hieu signal song' },
    { emoji: '🔋', cat: 'tech', kw: 'pin battery power nang luong nap pin' },
    { emoji: '💾', cat: 'tech', kw: 'dia mem floppy disk save luu tru storage disk' },
    { emoji: '⚡', cat: 'tech', kw: 'tia chop lightning fast speed nhanh hieu qua' },

    // Emotion & Vibe (Cảm xúc & Tương tác)
    { emoji: '😀', cat: 'emotion', kw: 'vui cuoi happy smile face mat cuoi' },
    { emoji: '😎', cat: 'emotion', kw: 'ngau cool sunglasses pro kinh ram xin' },
    { emoji: '🤔', cat: 'emotion', kw: 'suy nghi think wonder question thac mac' },
    { emoji: '🥳', cat: 'emotion', kw: 'an mung party celebrate happy tiec party hat' },
    { emoji: '🤩', cat: 'emotion', kw: 'ngoi sao mat star struck wow amazed phan khich' },
    { emoji: '✨', cat: 'emotion', kw: 'lap lanh sparkle star magic toa sang lung linh' },
    { emoji: '🔥', cat: 'emotion', kw: 'lua fire hot trending chay nhiet huyet xuan hoa' },
    { emoji: '⭐', cat: 'emotion', kw: 'ngoi sao star favorite danh gia uu tien' },
    { emoji: '💯', cat: 'emotion', kw: 'tram diem 100 perfect diem muoi xuat sac' },
    { emoji: '🎯', cat: 'emotion', kw: 'muc tieu target goal focus chinh xac dung dich' },
    { emoji: '💖', cat: 'emotion', kw: 'trai tim heart love yeu thich quan tam' },
    { emoji: '👏', cat: 'emotion', kw: 'vo tay clap cheer hoan ho khen ngoi' },
    { emoji: '🙌', cat: 'emotion', kw: 'hai tay celebrating praise hoan ho yeah' },
    { emoji: '✌️', cat: 'emotion', kw: 'peace hoa binh victory chien thang hai ngon tay' },
    { emoji: '🎉', cat: 'emotion', kw: 'phao hoa tada party celebration chuc mung' },
    { emoji: '☕', cat: 'emotion', kw: 'ca phe coffee chill relax nghi ngoi sang' },

    // Life & Nature (Đời sống & Thiên nhiên)
    { emoji: '🌿', cat: 'life', kw: 'la cay herb leaf nature cay coi moi truong xanh' },
    { emoji: '🌸', cat: 'life', kw: 'hoa anh dao sakura flower hoa blossom mua xuan' },
    { emoji: '🍀', cat: 'life', kw: 'co bon la clover lucky may man co xanh' },
    { emoji: '🌞', cat: 'life', kw: 'mat troi sun morning sang am ap nang' },
    { emoji: '🌙', cat: 'life', kw: 'mat trang moon night dem toi trua dem' },
    { emoji: '🌈', cat: 'life', kw: 'cau vong rainbow hy vong mau sac troi mua' },
    { emoji: '🐱', cat: 'life', kw: 'meo cat pet thu cung de thuong dong vat' },
    { emoji: '🍕', cat: 'life', kw: 'pizza food thuc an do an an trua' },
    { emoji: '🍔', cat: 'life', kw: 'burger hamburger fast food banh mi' },
    { emoji: '⚽', cat: 'life', kw: 'bong da soccer football sport the thao banh' },
    { emoji: '🎮', cat: 'life', kw: 'tay cam tro choi game gaming play giai tri' },
    { emoji: '🎧', cat: 'life', kw: 'tai nghe headphone music am nhac nghe nhac' },
    { emoji: '🚲', cat: 'life', kw: 'xe dap bike bicycle ride di chuyen the duc' },
    { emoji: '✈️', cat: 'life', kw: 'may bay airplane fly travel du lich chuyen di' },
    { emoji: '🏕️', cat: 'life', kw: 'cam trai camping camp nature da ngoai rung leu' },
    { emoji: '🎨', cat: 'life', kw: 'bang mau art paint ve hoi hoa sang tao mau' },

    // Office & Organization (Quản lý)
    { emoji: '📂', cat: 'office', kw: 'thu muc open folder file doc tai lieu mo' },
    { emoji: '📁', cat: 'office', kw: 'thu muc folder file luu tru ho so' },
    { emoji: '📄', cat: 'office', kw: 'trang giay page document van ban giay to' },
    { emoji: '🗓️', cat: 'office', kw: 'lich calendar schedule lich trinh thoi gian bieu' },
    { emoji: '📅', cat: 'office', kw: 'ngay thang calendar date event su kien' },
    { emoji: '⏰', cat: 'office', kw: 'dong ho bao thuc clock alarm time thoi gian gio' },
    { emoji: '⏳', cat: 'office', kw: 'dong ho cat hourglass wait cho deadline sap het gio' },
    { emoji: '🏷️', cat: 'office', kw: 'the tag label phan loai nhan mac' },
    { emoji: '💼', cat: 'office', kw: 'cap tai lieu briefcase work cong viec di lam' },
    { emoji: '🗂️', cat: 'office', kw: 'phan chia tab dividers sort phan muc' },
    { emoji: '🗃️', cat: 'office', kw: 'hop ho so file box archive luu tru ho so' },
    { emoji: '📉', cat: 'office', kw: 'giam sut chart decline trend down ha nhiet' },
    { emoji: '✉️', cat: 'office', kw: 'thu email envelope mail tin nhan thu tu' },
    { emoji: '📦', cat: 'office', kw: 'hop package delivery kien hang box giao hang' },
    { emoji: '🔔', cat: 'office', kw: 'chuong thong bao bell notification nhac nho' },
    { emoji: '🔑', cat: 'office', kw: 'chia khoa key access mat ma khoa mo' }
];

let currentEmojiCategory = 'all';
let currentCoverCategory = 'all';

function renderEmojiGrid(category = 'all', query = '') {
    const grid = document.getElementById('emoji-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const q = (query || '').toLowerCase().trim();
    const filtered = emojiData.filter(item => {
        const matchesCategory = (category === 'all' || item.cat === category);
        const matchesQuery = !q || item.emoji.includes(q) || item.kw.toLowerCase().includes(q);
        return matchesCategory && matchesQuery;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-placeholder); font-size: 13px;">Không tìm thấy icon nào phù hợp với từ khóa</div>';
        return;
    }

    filtered.forEach(item => {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = item.emoji;
        span.title = item.kw.split(' ')[0] || '';
        span.onclick = () => {
            applyIcon(item.emoji);
            document.getElementById('emoji-picker').style.display = 'none';
        };
        grid.appendChild(span);
    });
}

function selectEmojiCategory(cat, btn) {
    currentEmojiCategory = cat;
    document.querySelectorAll('.emoji-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    const searchVal = document.getElementById('emoji-search-input')?.value || '';
    renderEmojiGrid(cat, searchVal);
}

function filterEmojis(val) {
    renderEmojiGrid(currentEmojiCategory, val);
}

function applyCustomEmoji() {
    const input = document.getElementById('custom-emoji-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showToast('⚠️ Hãy nhập ký tự hoặc emoji!');
        return;
    }
    applyIcon(val);
    input.value = '';
    document.getElementById('emoji-picker').style.display = 'none';
    showToast('✨ Đã cập nhật icon trang!');
}

function removeIcon() {
    const page = appState.pages[appState.activePageId];
    if (page) {
        page.icon = '📄';
        document.getElementById('page-icon').textContent = '📄';
        triggerSave();
        renderSidebar();
        document.getElementById('emoji-picker').style.display = 'none';
        showToast('🗑️ Đã đặt lại biểu tượng mặc định');
    }
}

function renderCoverGrid(category = 'all') {
    const grid = document.getElementById('cover-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const filtered = (category === 'all') 
        ? curatedCovers 
        : curatedCovers.filter(c => c.cat === category);

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cover-item';
        div.style.backgroundImage = `url(${item.url})`;
        div.title = item.title;
        div.onclick = () => {
            applyCover(item.url);
            document.getElementById('cover-picker').style.display = 'none';
            showToast(`🖼️ Đã đổi ảnh bìa: ${item.title}`);
        };
        grid.appendChild(div);
    });
}

function filterCoverGallery(cat, btn) {
    currentCoverCategory = cat;
    document.querySelectorAll('.cover-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderCoverGrid(cat);
}

function switchCoverTab(tabName) {
    const tabGallery = document.getElementById('cover-tab-gallery');
    const tabUpload = document.getElementById('cover-tab-upload');
    const tabLink = document.getElementById('cover-tab-link');
    
    const btnGallery = document.getElementById('tab-cover-gallery-btn');
    const btnUpload = document.getElementById('tab-cover-upload-btn');
    const btnLink = document.getElementById('tab-cover-link-btn');

    if (tabGallery) tabGallery.style.display = (tabName === 'gallery') ? 'block' : 'none';
    if (tabUpload) tabUpload.style.display = (tabName === 'upload') ? 'block' : 'none';
    if (tabLink) tabLink.style.display = (tabName === 'link') ? 'block' : 'none';

    if (btnGallery) btnGallery.classList.toggle('active', tabName === 'gallery');
    if (btnUpload) btnUpload.classList.toggle('active', tabName === 'upload');
    if (btnLink) btnLink.classList.toggle('active', tabName === 'link');
}

function handleCoverFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
        processCoverFile(file);
    }
    event.target.value = '';
}

function processCoverFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('⚠️ Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP)!');
        return;
    }

    showToast('⏳ Đang tối ưu hóa dung lượng ảnh...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Downscale & compress with canvas to keep localStorage safe
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxW = 1400;
                const maxH = 600;

                if (width > maxW || height > maxH) {
                    const ratio = Math.min(maxW / width, maxH / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                applyCover(compressedDataUrl);
                document.getElementById('cover-picker').style.display = 'none';
                showToast('🖼️ Đã tải và áp dụng ảnh bìa từ máy tính!');
            } catch (err) {
                console.error('Lỗi nén ảnh:', err);
                if (e.target.result.length < 2 * 1024 * 1024) {
                    applyCover(e.target.result);
                    document.getElementById('cover-picker').style.display = 'none';
                    showToast('🖼️ Đã áp dụng ảnh bìa từ máy tính!');
                } else {
                    showToast('⚠️ Ảnh quá lớn, vui lòng chọn ảnh có kích thước nhẹ hơn!');
                }
            }
        };
        img.onerror = () => {
            showToast('⚠️ Không thể tải dữ liệu ảnh!');
        };
        img.src = e.target.result;
    };
    reader.onerror = () => {
        showToast('⚠️ Đọc tệp thất bại!');
    };
    reader.readAsDataURL(file);
}

function setupCoverDropzone() {
    const dropzone = document.querySelector('.cover-upload-dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processCoverFile(files[0]);
        }
    }, false);
}

function applyCustomLinkCover() {
    const input = document.getElementById('custom-cover-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
        showToast('⚠️ Vui lòng nhập link ảnh hợp lệ!');
        return;
    }
    applyCover(val);
    document.getElementById('cover-picker').style.display = 'none';
    showToast('🌐 Đã áp dụng ảnh bìa từ link bên ngoài!');
}

function removeCover() {
    const page = appState.pages[appState.activePageId];
    if (page) {
        page.cover = null;
        const coverEl = document.getElementById('page-cover');
        if (coverEl) {
            coverEl.style.display = 'none';
            const img = coverEl.querySelector('img');
            if (img) img.src = '';
        }
        triggerSave();
        document.getElementById('cover-picker').style.display = 'none';
        showToast('🗑️ Đã xóa ảnh bìa khỏi trang');
    }
}

function initPopovers() {
    // Populate emoji grid and cover gallery
    renderEmojiGrid('all');
    renderCoverGrid('all');
    setupCoverDropzone();

    // Link URL input handling
    const customBtn = document.getElementById('custom-cover-btn');
    if (customBtn) {
        customBtn.onclick = applyCustomLinkCover;
    }

    const customInput = document.getElementById('custom-cover-input');
    const previewContainer = document.getElementById('cover-link-preview');
    const previewImg = document.getElementById('cover-preview-img');
    if (customInput && previewContainer && previewImg) {
        customInput.addEventListener('input', () => {
            const url = customInput.value.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'))) {
                previewImg.src = url;
                previewContainer.style.display = 'block';
            } else {
                previewContainer.style.display = 'none';
            }
        });
        customInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomLinkCover();
            }
        });
    }

    const customEmojiInput = document.getElementById('custom-emoji-input');
    if (customEmojiInput) {
        customEmojiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCustomEmoji();
            }
        });
    }
}

function applyIcon(iconStr) {
    const page = appState.pages[appState.activePageId];
    if (page) {
        page.icon = iconStr;
        document.getElementById('page-icon').textContent = iconStr;
        triggerSave();
        renderSidebar();
    }
}

function applyCover(coverUrl) {
    const page = appState.pages[appState.activePageId];
    if (page) {
        page.cover = coverUrl;
        const coverEl = document.getElementById('page-cover');
        coverEl.style.display = 'block';
        coverEl.querySelector('img').src = page.cover;
        triggerSave();
    }
}

function addCover(e) {
    showCoverPicker(e.target);
}

function changeCover(e) {
    showCoverPicker(e.target);
}

function changeIcon(e) {
    showEmojiPicker(e.target);
}

function showEmojiPicker(target) {
    const picker = document.getElementById('emoji-picker');
    const rect = target.getBoundingClientRect();
    picker.style.display = 'block';
    
    // Position below target, keeping inside viewport
    const top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX;
    if (left + 390 > window.innerWidth) {
        left = window.innerWidth - 400;
    }
    if (left < 10) left = 10;
    
    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
    picker.style.right = 'auto';

    // Auto-focus search input
    const searchInput = document.getElementById('emoji-search-input');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(() => searchInput.focus(), 60);
        filterEmojis('');
    }
}

function showCoverPicker(target) {
    const picker = document.getElementById('cover-picker');
    const rect = target.getBoundingClientRect();
    picker.style.display = 'block';
    
    const top = rect.bottom + window.scrollY + 6;
    picker.style.top = `${top}px`;
    picker.style.right = '32px';
    picker.style.left = 'auto';

    switchCoverTab('gallery');
}

// Global window bindings for HTML inline onclick handlers
window.renderEmojiGrid = renderEmojiGrid;
window.selectEmojiCategory = selectEmojiCategory;
window.filterEmojis = filterEmojis;
window.applyCustomEmoji = applyCustomEmoji;
window.removeIcon = removeIcon;
window.renderCoverGrid = renderCoverGrid;
window.filterCoverGallery = filterCoverGallery;
window.switchCoverTab = switchCoverTab;
window.handleCoverFileUpload = handleCoverFileUpload;
window.applyCustomLinkCover = applyCustomLinkCover;
window.removeCover = removeCover;
window.addCover = addCover;
window.changeCover = changeCover;
window.changeIcon = changeIcon;
window.showEmojiPicker = showEmojiPicker;
window.showCoverPicker = showCoverPicker;

const app = {
    createNewPage,
    manualSync: () => syncAllToCloud(false),
    showVocab: () => {
        elements.editorContainer.style.display = 'none';
        elements.vocabContainer.style.display = 'block';
        document.querySelectorAll('.page-item').forEach(el => el.classList.remove('active'));
        const workspaceName = localStorage.getItem('schooldb_workspace') || 'School NoteBook';
        elements.breadcrumb.innerHTML = `
            <span class="bc-workspace" style="cursor:pointer;" onclick="elements.vocabContainer.style.display='none';elements.editorContainer.style.display='block';"><i class="ri-book-2-line" style="margin-right:4px;"></i>${workspaceName}</span>
            <span style="opacity:0.4; margin:0 6px;">/</span>
            <span class="bc-page" style="color:var(--text-primary); font-weight:600;">
                <span style="margin-right:4px;">📚</span>
                <span>Kho từ vựng & Flashcard</span>
            </span>
        `;
        vocab.initVocab();
    },
    setPageFont: (fontName) => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        page.font = fontName;
        elements.editorContainer.setAttribute('data-font', fontName);
        document.querySelectorAll('.font-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-font') === fontName);
        });
        triggerSave();
    },
    toggleSmallText: (enabled) => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        page.smallText = enabled;
        document.querySelector('.page-content').classList.toggle('small-text', enabled);
        triggerSave();
    },
    toggleFullWidth: (enabled) => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        page.fullWidth = enabled;
        document.querySelector('.page-content').classList.toggle('full-width', enabled);
        triggerSave();
    },
    toggleLockPage: (enabled) => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        page.locked = enabled;
        applyLockState(enabled);
        showToast(enabled ? '🔒 Đã khóa trang (chỉ đọc)' : '🔓 Đã mở khóa trang');
        triggerSave();
    },
    duplicateCurrentPage: () => {
        const curPage = appState.pages[appState.activePageId];
        if (!curPage) return;
        const newId = generateId();
        const curBlocks = serializeBlocks();
        const clonedBlocks = JSON.parse(JSON.stringify(curBlocks)).map(b => ({
            ...b,
            id: generateId()
        }));
        appState.pages[newId] = {
            ...JSON.parse(JSON.stringify(curPage)),
            id: newId,
            title: (curPage.title || 'Untitled') + ' (Copy)',
            blocks: clonedBlocks
        };
        saveToStorage();
        renderSidebar();
        openPage(newId);
        showToast('Đã nhân bản trang!');
        const pop = document.getElementById('more-popover');
        if (pop) pop.style.display = 'none';
    },
    copyPageLink: () => {
        const link = window.location.origin + window.location.pathname + '#' + appState.activePageId;
        navigator.clipboard.writeText(link).then(() => {
            showToast('Đã copy link trang!');
        });
        const pop = document.getElementById('more-popover');
        if (pop) pop.style.display = 'none';
    },
    copyPageContents: () => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        let text = `# ${page.title || 'Untitled'}\n\n`;
        page.blocks.forEach(b => {
            const indentStr = '  '.repeat(b.indent || 0);
            text += `${indentStr}${b.content}\n`;
        });
        navigator.clipboard.writeText(text).then(() => {
            showToast('Đã copy toàn bộ nội dung trang!');
        });
        const pop = document.getElementById('more-popover');
        if (pop) pop.style.display = 'none';
    },
    showWordCount: () => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        let text = page.blocks.map(b => b.content).join(' ');
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;
        alert(`Thống kê trang:\n- Số từ: ${words}\n- Số ký tự: ${chars}\n- Thời gian đọc ước tính: ~${Math.ceil(words / 200)} phút`);
        document.getElementById('more-popover').style.display = 'none';
    },
    exportToTxt: () => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        let text = `# ${page.title || 'Untitled'}\n\n`;
        page.blocks.forEach(b => {
            if (b.type === 'table') {
                try {
                    const parsed = JSON.parse(b.content);
                    if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
                        const numCols = parsed.rows[0].length;
                        text += '\n| ' + parsed.rows[0].map(c => String(c).replace(/<[^>]*>/g, '').trim()).join(' | ') + ' |\n';
                        text += '| ' + new Array(numCols).fill('---').join(' | ') + ' |\n';
                        for (let i = 1; i < parsed.rows.length; i++) {
                            text += '| ' + parsed.rows[i].map(c => String(c).replace(/<[^>]*>/g, '').trim()).join(' | ') + ' |\n';
                        }
                        text += '\n';
                        return;
                    }
                } catch (e) {}
            }
            text += b.content + '\n';
        });
        
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${page.title || 'Export'}.txt`;
        a.click();
        document.getElementById('more-popover').style.display = 'none';
    },
    deleteCurrentPage: () => {
        deletePage(appState.activePageId);
        const pop = document.getElementById('more-popover');
        if (pop) pop.style.display = 'none';
    },
    deletePage: (id) => deletePage(id),
    toggleSidebarSection: (sec) => toggleSidebarSection(sec),
    shareWeb: () => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        const title = page.title || 'Untitled';
        const text = page.blocks ? page.blocks.map(b => b.content).join('\n') : '';
        if (navigator.share) {
            navigator.share({
                title: title,
                text: text,
                url: window.location.href
            }).catch(() => {});
        } else {
            app.copyPageContents();
        }
        const pop = document.getElementById('share-popover');
        if (pop) pop.style.display = 'none';
    },
    // Chuyển ghi chú từ Inbox vào sổ tay chính
    moveToNotebook: () => {
        const page = appState.pages[appState.activePageId];
        if (!page) return;
        page.inbox = false;
        if (!page.icon || page.icon === '⚡') page.icon = '📄';
        saveToStorage();
        renderSidebar();
        openPage(page.id);
        showToast('✅ Đã chuyển vào sổ tay');
    },
    openMiniNote: () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone || window.innerWidth < 768) {
            window.location.href = 'mini.html';
        } else {
            window.open('mini.html', 'mininote', 'width=460,height=720');
        }
    },
    openSidebar: () => openMobileSidebar(),
    showPages: () => {
        elements.vocabContainer.style.display = 'none';
        elements.editorContainer.style.display = 'block';
        openMobileSidebar();
    }
};

// --- CUSTOM BLOCK EDITOR LOGIC ---
let activeBlockElement = null;
let activeBlockId = null;

function renderBlocks(blocks) {
    elements.blockEditor.innerHTML = '';
    if (!blocks || blocks.length === 0) {
        blocks = [{ id: generateId(), type: 'text', content: '', indent: 0 }];
    }
    blocks.forEach(block => {
        const blockEl = createBlockElement(
            block.type, 
            block.content, 
            block.id, 
            block.indent || 0,
            block.color || null,
            block.bgColor || null,
            block.collapsed || false
        );
        elements.blockEditor.appendChild(blockEl);
    });

    // Cập nhật trạng thái ẩn/hiện ban đầu cho các khối con của Toggle đang đóng
    let hideIndentThreshold = null;
    const allWrappers = Array.from(elements.blockEditor.querySelectorAll('.block-wrapper'));
    allWrappers.forEach(w => {
        const myIndent = parseInt(w.getAttribute('data-indent') || '0', 10);
        if (hideIndentThreshold !== null) {
            if (myIndent > hideIndentThreshold) {
                w.style.display = 'none';
            } else {
                hideIndentThreshold = null;
            }
        }
        const isCollapsed = w.getAttribute('data-collapsed') === 'true';
        const wType = w.getAttribute('data-type') || '';
        if (isCollapsed && (wType === 'toggle' || wType.startsWith('toggle-'))) {
            const icon = w.querySelector('.toggle-icon');
            if (icon) icon.classList.remove('open');
            if (hideIndentThreshold === null) {
                hideIndentThreshold = myIndent;
            }
        }
    });

    initSortable();
}

let sortableInstance = null;
function initSortable() {
    if (typeof Sortable !== 'undefined' && elements.blockEditor) {
        if (sortableInstance) {
            sortableInstance.destroy();
        }
        sortableInstance = new Sortable(elements.blockEditor, {
            handle: '.block-handle',
            animation: 180,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            fallbackClass: 'sortable-fallback',
            forceFallback: true,        // Critical: fixes HTML5 drag coordinate jump on Windows Chrome/Edge
            fallbackOnBody: false,      // Critical: keeps clone in editor container
            fallbackTolerance: 3,
            swapThreshold: 0.65,
            invertSwap: true,
            delay: 220,                 // Mobile: long-press to drag so normal scrolling isn't hijacked
            delayOnTouchOnly: true,
            touchStartThreshold: 4,
            scroll: document.getElementById('editor-container'),
            scrollSensitivity: 70,
            scrollSpeed: 14,
            bubbleScroll: true,
            onStart: () => {
                document.body.classList.add('is-dragging');
            },
            onEnd: () => {
                document.body.classList.remove('is-dragging');
                triggerSave();
            }
        });
    }
}

function serializeBlocks() {
    const blocks = [];
    elements.blockEditor.querySelectorAll('.block-wrapper').forEach(wrapper => {
        const contentEl = wrapper.querySelector('.block-content');
        if (!contentEl) return;
        const type = contentEl.getAttribute('data-type');
        
        // Lưu trữ khối hình ảnh với đầy đủ metadata (src, caption, width, align, frameStyle)
        if (type === 'image') {
            const img = contentEl.querySelector('img.note-image') || contentEl.querySelector('img');
            const cap = contentEl.querySelector('.image-caption');
            const mediaWrap = contentEl.querySelector('.image-media-wrapper');
            let src = img ? (img.getAttribute('src') || '') : '';
            if (!src && contentEl.dataset.src) src = contentEl.dataset.src;
            const caption = cap ? (cap.innerText || cap.textContent || '').trim() : '';
            const width = (mediaWrap && mediaWrap.style.width) ? mediaWrap.style.width : (img && img.style.width ? img.style.width : 'fit-content');
            const align = contentEl.getAttribute('data-align') || 'center';
            const frameStyle = mediaWrap ? (mediaWrap.getAttribute('data-frame') || 'standard') : 'standard';
            
            blocks.push({
                id: wrapper.getAttribute('data-id'),
                type: 'image',
                content: JSON.stringify({ src, caption, width, align, frameStyle }),
                indent: parseInt(wrapper.getAttribute('data-indent') || '0', 10)
            });
            return;
        }

        // Lưu trữ khối công thức toán học (Math / LaTeX)
        if (type === 'math') {
            const latex = contentEl.dataset.latex || '';
            blocks.push({
                id: wrapper.getAttribute('data-id'),
                type: 'math',
                content: latex,
                indent: parseInt(wrapper.getAttribute('data-indent') || '0', 10)
            });
            return;
        }

        // Lưu trữ khối bảng (Table)
        if (type === 'table') {
            const tableEl = contentEl.querySelector('table.notion-table');
            const hasHeader = tableEl ? tableEl.classList.contains('has-header') : true;
            const rows = [];
            if (tableEl) {
                tableEl.querySelectorAll('tr').forEach(tr => {
                    const rowData = [];
                    tr.querySelectorAll('th, td').forEach(cell => {
                        rowData.push(cell.innerHTML.trim());
                    });
                    if (rowData.length > 0) rows.push(rowData);
                });
            }
            blocks.push({
                id: wrapper.getAttribute('data-id'),
                type: 'table',
                content: JSON.stringify({ hasHeader, rows }),
                indent: parseInt(wrapper.getAttribute('data-indent') || '0', 10)
            });
            return;
        }

        let content = contentEl.innerHTML !== undefined ? contentEl.innerHTML : (contentEl.innerText || '');
        if (content === '<br>' || content === '<div><br></div>') {
            content = '';
        } else {
            content = content.replace(/<br\s*\/?>$/i, '').trim();
        }
        
        // save checked state for todos
        if (type === 'todo') {
            const cb = wrapper.querySelector('.todo-cb');
            if (cb && cb.checked && !content.startsWith('[x] ')) {
                content = '[x] ' + content;
            }
        }
        
        const blockObj = {
            id: wrapper.getAttribute('data-id'),
            type: type,
            content: content,
            indent: parseInt(wrapper.getAttribute('data-indent') || '0', 10)
        };

        if (contentEl.style.color) {
            blockObj.color = contentEl.style.color;
        }
        if (contentEl.style.backgroundColor) {
            blockObj.bgColor = contentEl.style.backgroundColor;
        }
        if (type === 'toggle' || (type && type.startsWith('toggle-'))) {
            const isCollapsed = wrapper.getAttribute('data-collapsed') === 'true' || 
                (wrapper.querySelector('.toggle-icon') && !wrapper.querySelector('.toggle-icon').classList.contains('open'));
            blockObj.collapsed = !!isCollapsed;
        }
        
        blocks.push(blockObj);
    });
    return blocks;
}

function setCaretAtStart(el) {
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

function setCaretAtEnd(el) {
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

function setCaretAtOffset(el, targetOffset) {
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    let currentOffset = 0;
    let foundNode = null;
    let nodeOffset = 0;
    
    function traverse(node) {
        if (foundNode) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.nodeValue.length;
            if (currentOffset + len >= targetOffset) {
                foundNode = node;
                nodeOffset = targetOffset - currentOffset;
                return;
            }
            currentOffset += len;
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                traverse(node.childNodes[i]);
                if (foundNode) return;
            }
        }
    }
    
    traverse(el);
    const range = document.createRange();
    if (foundNode) {
        range.setStart(foundNode, Math.min(nodeOffset, foundNode.nodeValue.length));
    } else {
        range.selectNodeContents(el);
        range.collapse(false);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

function updateNumberPrefixes() {
    if (!elements.blockEditor) return;
    const indentCounters = {};
    elements.blockEditor.querySelectorAll('.block-wrapper').forEach(wrapper => {
        const type = wrapper.getAttribute('data-type');
        const indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        
        if (type === 'number') {
            if (!indentCounters[indent]) indentCounters[indent] = 1;
            const prefixEl = wrapper.querySelector('.block-prefix');
            if (prefixEl) {
                prefixEl.innerHTML = `<span class="number-prefix">${indentCounters[indent]}.</span>`;
                prefixEl.style.display = 'flex';
            }
            indentCounters[indent]++;
            Object.keys(indentCounters).forEach(k => {
                if (parseInt(k, 10) > indent) delete indentCounters[k];
            });
        } else {
            Object.keys(indentCounters).forEach(k => {
                if (parseInt(k, 10) >= indent) delete indentCounters[k];
            });
        }
    });
}

function stripLeadingMarkdownPrefix(target, prefixRegex, fallbackText) {
    let stripped = false;
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
    const firstTextNode = walker.nextNode();
    if (firstTextNode && prefixRegex.test(firstTextNode.textContent)) {
        firstTextNode.textContent = firstTextNode.textContent.replace(prefixRegex, '');
        stripped = true;
    }
    if (!stripped) {
        target.innerHTML = fallbackText;
    }
}

function checkMarkdownShortcuts(target) {
    const text = target.innerText || target.textContent || '';

    // 0. Math Equation Block: "$$ " or "$$formula$$"
    const mathMatch = text.match(/^\$\$(.*?)(?:\$\$)?$/s);
    if (mathMatch && (text.startsWith('$$ ') || text.endsWith('$$') || text.trim() === '$$')) {
        EditorHistory.recordBeforeAction();
        const formula = mathMatch[1].trim();
        setBlockType(target, 'math', formula);
        triggerSave();
        return true;
    }

    // 0.1 Table Block: "/table" or "||"
    if (text.trim() === '/table' || text.trim() === '||') {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'table');
        triggerSave();
        return true;
    }
    
    // 1. Bullet list: "* " or "- "
    const bulletMatch = text.match(/^(\*|-)\s(.*)/s);
    if (bulletMatch) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'bullet');
        stripLeadingMarkdownPrefix(target, /^(\*|-)\s/, bulletMatch[2]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 2. Numbered list: "1. " or "1) "
    const numberMatch = text.match(/^1[\.\)]\s(.*)/s);
    if (numberMatch) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'number');
        stripLeadingMarkdownPrefix(target, /^1[\.\)]\s/, numberMatch[1]);
        setCaretAtStart(target);
        updateNumberPrefixes();
        triggerSave();
        return true;
    }
    
    // 3. To-do list: "[] " or "[ ] "
    const todoMatch = text.match(/^(\[\]|\[\s\])\s(.*)/s);
    if (todoMatch) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'todo');
        stripLeadingMarkdownPrefix(target, /^(\[\]|\[\s\])\s/, todoMatch[2]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 4. Heading 1: "# "
    const h1Match = text.match(/^#\s(.*)/s);
    if (h1Match) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'h1');
        const wrapper = target.closest('.block-wrapper');
        if (wrapper) {
            wrapper.setAttribute('data-indent', 0);
            wrapper.style.marginLeft = '0px';
        }
        stripLeadingMarkdownPrefix(target, /^#\s/, h1Match[1]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 5. Heading 2: "## "
    const h2Match = text.match(/^##\s(.*)/s);
    if (h2Match) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'h2');
        const wrapper = target.closest('.block-wrapper');
        if (wrapper) {
            let curIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
            curIndent = Math.min(curIndent, 1);
            wrapper.setAttribute('data-indent', curIndent);
            wrapper.style.marginLeft = `${curIndent * 24}px`;
        }
        stripLeadingMarkdownPrefix(target, /^##\s/, h2Match[1]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 6. Heading 3: "### "
    const h3Match = text.match(/^###\s(.*)/s);
    if (h3Match) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'h3');
        const wrapper = target.closest('.block-wrapper');
        if (wrapper) {
            let curIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
            curIndent = Math.min(curIndent, 2);
            wrapper.setAttribute('data-indent', curIndent);
            wrapper.style.marginLeft = `${curIndent * 24}px`;
        }
        stripLeadingMarkdownPrefix(target, /^###\s/, h3Match[1]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 7. Quote: "> "
    const quoteMatch = text.match(/^>\s(.*)/s);
    if (quoteMatch) {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'quote');
        stripLeadingMarkdownPrefix(target, /^>\s/, quoteMatch[1]);
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 8. Divider: "---"
    if (text.trim() === '---') {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'divider');
        const wrapper = target.closest('.block-wrapper');
        const newWrapper = createBlockElement('text', '', generateId(), 0);
        wrapper.parentNode.insertBefore(newWrapper, wrapper.nextSibling);
        newWrapper.querySelector('.block-content').focus();
        triggerSave();
        return true;
    }
    
    // 9. Code block: "```"
    if (text.trim() === '```') {
        EditorHistory.recordBeforeAction();
        setBlockType(target, 'code');
        target.innerHTML = '';
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    return false;
}

function selectBlockAndShowMenu(wrapper) {
    if (!wrapper) return;
    const contentEl = wrapper.querySelector('.block-content');
    
    // 1. Đưa block này vào selectedBlockWrappers và đánh dấu is-block-selected ("chọn cả dòng")
    clearBlockSelection();
    wrapper.classList.add('is-block-selected');
    wrapper.classList.add('is-focused');
    selectedBlockWrappers = [wrapper];
    activeBlockId = wrapper.getAttribute('data-id');
    activeBlockElement = contentEl || wrapper;

    wrapper.setAttribute('tabindex', '-1');
    wrapper.focus();

    if (contentEl && contentEl.contentEditable !== 'false') {
        contentEl.focus();
        const range = document.createRange();
        range.selectNodeContents(contentEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    
    const currentType = wrapper.getAttribute('data-type') || 'text';
    updateBlockTypeBadge(currentType);
    
    // 4. Open Floating Toolbar right above this block
    const toolbar = document.getElementById('floating-toolbar');
    if (!toolbar) return;
    
    toolbar.style.display = 'flex';
    const rect = wrapper.getBoundingClientRect();
    const tbWidth = toolbar.offsetWidth || 340;
    const tbHeight = toolbar.offsetHeight || 260;
    
    let top = rect.top - tbHeight - 10;
    if (top < 10) {
        top = rect.bottom + 8;
    }
    let left = rect.left + 24;
    if (left + tbWidth > window.innerWidth - 16) {
        left = window.innerWidth - tbWidth - 16;
    }
    if (left < 16) left = 16;
    
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    
    // Open type dropdown automatically for instant 1-click conversion
    const typeDropdown = document.getElementById('nft-type-dropdown');
    if (typeDropdown) {
        typeDropdown.style.display = 'block';
    }
}

function createBlockElement(type, content, id = generateId(), indent = 0, color = null, bgColor = null, collapsed = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.setAttribute('data-id', id);
    wrapper.setAttribute('data-indent', indent);
    wrapper.style.marginLeft = `${indent * 24}px`;
    if (collapsed && (type === 'toggle' || (type && type.startsWith('toggle-')))) {
        wrapper.setAttribute('data-collapsed', 'true');
    }

    wrapper.innerHTML = `
        <div class="block-handle" contenteditable="false" title="Bấm để chọn dòng hoặc đổi kiểu khối, giữ để kéo"><i class="ri-drag-move-2-line"></i></div>
        <div class="block-prefix" contenteditable="false"></div>
        <div class="block-content" contenteditable="true"></div>
    `;
    
    const contentEl = wrapper.querySelector('.block-content');
    const handleEl = wrapper.querySelector('.block-handle');
    const prefixEl = wrapper.querySelector('.block-prefix');
    
    if (type !== 'image' && type !== 'math' && type !== 'table') {
        contentEl.innerHTML = content;
    }

    setBlockType(contentEl, type, content);

    if (color) contentEl.style.color = color;
    if (bgColor) contentEl.style.backgroundColor = bgColor;
    if (collapsed && (type === 'toggle' || (type && type.startsWith('toggle-')))) {
        const icon = wrapper.querySelector('.toggle-icon');
        if (icon) icon.classList.remove('open');
    }
    
    // Handle click to select line and show block menu
    if (handleEl) {
        handleEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBlockAndShowMenu(wrapper);
        });
    }

    // Cho phép nhấp vào vùng prefix của toggle để đóng/mở mượt mà
    if (prefixEl) {
        prefixEl.addEventListener('click', (e) => {
            const icon = prefixEl.querySelector('.toggle-icon');
            if (icon && e.target !== icon) {
                toggleBlockOpen(icon, e);
            }
        });
    }

    // Event listeners
    contentEl.addEventListener('keydown', handleBlockKeydown);
    contentEl.addEventListener('input', handleBlockInput);
    contentEl.addEventListener('paste', handleBlockPaste);
    contentEl.addEventListener('focus', () => { 
        activeBlockElement = contentEl;
        activeBlockId = id;
    });

    return wrapper;
}

function openSearchModal() {
    const modal = document.getElementById('search-modal');
    modal.style.display = 'flex';
    const input = document.getElementById('search-input');
    input.focus();
    input.value = '';
    renderSearchResults('');
    
    input.oninput = (e) => renderSearchResults(e.target.value);
}

function renderSearchResults(query) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
    query = query.toLowerCase();
    
    Object.values(appState.pages).forEach(page => {
        let match = false;
        if (page.title.toLowerCase().includes(query)) match = true;
        
        if (match || query === '') {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<span>${page.icon}</span> <span>${page.title || 'Untitled'}</span>`;
            div.onclick = () => {
                openPage(page.id);
                document.getElementById('search-modal').style.display = 'none';
            };
            resultsContainer.appendChild(div);
        }
    });
}

function toggleTodo(cb) {
    const contentEl = cb.closest('.block-wrapper').querySelector('.block-content');
    if (cb.checked) {
        contentEl.style.textDecoration = 'line-through';
        contentEl.style.opacity = '0.5';
    } else {
        contentEl.style.textDecoration = 'none';
        contentEl.style.opacity = '1';
    }
    triggerSave();
}

function toggleBlockOpen(icon, e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    icon.classList.toggle('open');
    const wrapper = icon.closest('.block-wrapper');
    if (!wrapper) return;
    const myIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
    const isOpen = icon.classList.contains('open');
    
    wrapper.setAttribute('data-collapsed', isOpen ? 'false' : 'true');
    
    let next = wrapper.nextElementSibling;
    let skipChildIndent = null;
    
    while (next && next.classList.contains('block-wrapper')) {
        const nextIndent = parseInt(next.getAttribute('data-indent') || '0', 10);
        if (nextIndent <= myIndent) break; // Ra khỏi phạm vi con của toggle này
        
        if (isOpen) {
            // Đang mở toggle: hiển thị các khối con trực tiếp
            if (skipChildIndent !== null) {
                if (nextIndent > skipChildIndent) {
                    next = next.nextElementSibling;
                    continue; // Bỏ qua vì nằm trong một toggle con đang đóng
                } else {
                    skipChildIndent = null; // Đã ra khỏi toggle con đóng đó
                }
            }
            
            next.style.display = 'flex';
            
            // Nếu khối con này lại là một toggle và đang đóng, không mở các cháu chắt của nó
            const nextType = next.getAttribute('data-type') || '';
            const isChildCollapsed = next.getAttribute('data-collapsed') === 'true' || 
                (next.querySelector('.toggle-icon') && !next.querySelector('.toggle-icon').classList.contains('open'));
            if (isChildCollapsed && (nextType === 'toggle' || nextType.startsWith('toggle-'))) {
                skipChildIndent = nextIndent;
            }
        } else {
            // Đang đóng toggle: ẩn toàn bộ các con, cháu phía dưới
            next.style.display = 'none';
        }
        next = next.nextElementSibling;
    }

    triggerSave();
    EditorHistory.record(true);
}

function focusFirstBlockOrCreate() {
    const firstBlock = elements.blockEditor.querySelector('.block-content');
    if (firstBlock) {
        firstBlock.focus();
    } else {
        const newBlock = createBlockElement('text', '');
        elements.blockEditor.appendChild(newBlock);
        newBlock.querySelector('.block-content').focus();
    }
}

function handleBlockKeydown(e) {
    const target = e.target;
    const wrapper = target.closest('.block-wrapper');
    if (!wrapper) return;

    // Điều hướng bàn phím khi Menu lệnh Slash ('/') đang mở
    if (elements.slashMenu && elements.slashMenu.style.display === 'block') {
        const visibleItems = Array.from(elements.slashMenu.querySelectorAll('.slash-menu-item')).filter(it => it.style.display !== 'none');
        if (visibleItems.length > 0) {
            let selectedIdx = visibleItems.findIndex(it => it.classList.contains('selected'));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                visibleItems.forEach(it => it.classList.remove('selected'));
                selectedIdx = (selectedIdx + 1) % visibleItems.length;
                visibleItems[selectedIdx].classList.add('selected');
                visibleItems[selectedIdx].scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                visibleItems.forEach(it => it.classList.remove('selected'));
                selectedIdx = (selectedIdx - 1 + visibleItems.length) % visibleItems.length;
                visibleItems[selectedIdx].classList.add('selected');
                visibleItems[selectedIdx].scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const targetItem = selectedIdx >= 0 ? visibleItems[selectedIdx] : visibleItems[0];
                const itemType = targetItem.getAttribute('data-type');
                applySlashCommand(itemType);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                closeSlashMenu();
                return;
            }
        }
    }
    
    // Handle Indentation with Tab
    if (e.key === 'Tab') {
        e.preventDefault();
        EditorHistory.recordBeforeAction();
        let indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        const blockType = target.getAttribute('data-type') || wrapper.getAttribute('data-type') || 'text';
        
        // Headings indentation rules:
        // H1 / toggle-h1: luôn giữ cấp 0 (không lùi dòng)
        if (blockType === 'h1' || blockType === 'toggle-h1') {
            wrapper.setAttribute('data-indent', 0);
            wrapper.style.marginLeft = '0px';
            return;
        }

        if (e.shiftKey) {
            indent = Math.max(0, indent - 1);
        } else {
            let maxIndent = 4;
            if (blockType === 'h2' || blockType === 'toggle-h2') maxIndent = 1;
            if (blockType === 'h3' || blockType === 'toggle-h3') maxIndent = 2;
            indent = Math.min(maxIndent, indent + 1);
        }
        wrapper.setAttribute('data-indent', indent);
        wrapper.style.marginLeft = `${indent * 24}px`;
        updateNumberPrefixes();
        triggerSave();
        EditorHistory.updateLastSnapshot();
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        EditorHistory.record(true);
        
        let indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        const type = target.getAttribute('data-type') || 'text';
        const rawText = target.innerText ? target.innerText.trim() : '';
        
        // 1. If block is empty
        if (rawText === '') {
            if (type !== 'text') {
                // Revert to plain text if special block (bullet, number, todo, heading, quote, etc.)
                setBlockType(target, 'text');
                updateNumberPrefixes();
                closeSlashMenu();
                triggerSave();
                return;
            } else if (indent > 0) {
                // Outdent if plain text and indented
                indent = indent - 1;
                wrapper.setAttribute('data-indent', indent);
                wrapper.style.marginLeft = `${indent * 24}px`;
                triggerSave();
                return;
            }
        }
        
        // 2. If block has content, split content at cursor!
        let beforeHtml = '';
        let afterHtml = '';
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            
            // Delete selection if user highlighted text
            range.deleteContents();
            
            // Range for content AFTER the cursor
            const afterRange = document.createRange();
            afterRange.selectNodeContents(target);
            afterRange.setStart(range.startContainer, range.startOffset);
            
            const afterFragment = afterRange.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(afterFragment);
            afterHtml = tempDiv.innerHTML;
            
            // Delete after content from target
            afterRange.deleteContents();
            beforeHtml = target.innerHTML;
        } else {
            beforeHtml = target.innerHTML;
            afterHtml = '';
        }
        
        // Determine type of the new block
        let newType = 'text';
        if (type === 'bullet' || type === 'number' || type === 'todo') {
            newType = type; // Continue list!
        }
        
        // Auto-indent if creating a new block after a toggle
        if (type === 'toggle' || (type && type.startsWith('toggle-'))) {
            indent = indent + 1;
            const icon = wrapper.querySelector('.toggle-icon');
            if (icon && !icon.classList.contains('open')) {
                toggleBlockOpen(icon);
            }
        } else if (type === 'h1') {
            indent = 0; // Khối mới dưới H1 luôn về cấp 0
        } else if (type === 'h2') {
            indent = Math.min(indent, 1);
        } else if (type === 'h3') {
            indent = Math.min(indent, 2);
        }
        
        // Create the new block with the content after cursor!
        const newWrapper = createBlockElement(newType, afterHtml, generateId(), indent);
        wrapper.parentNode.insertBefore(newWrapper, wrapper.nextSibling);
        
        if (newType === 'number' || type === 'number') {
            updateNumberPrefixes();
        }
        
        // Put cursor at the start of the new block
        const newContent = newWrapper.querySelector('.block-content');
        if (newContent) {
            setCaretAtStart(newContent);
        }
        
        closeSlashMenu();
        triggerSave();
        return;
    }
    
    if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            
            // Check if caret is at the beginning of the target
            let isAtBeginning = false;
            if (range.startOffset === 0) {
                if (range.startContainer === target || range.startContainer === target.firstChild || target.childNodes.length === 0) {
                    isAtBeginning = true;
                } else {
                    let prevNode = range.startContainer.previousSibling;
                    isAtBeginning = true;
                    while (prevNode) {
                        if (prevNode.textContent && prevNode.textContent.length > 0) {
                            isAtBeginning = false;
                            break;
                        }
                        prevNode = prevNode.previousSibling;
                    }
                }
            }
            
            if (isAtBeginning) {
                const type = target.getAttribute('data-type');
                let indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
                
                // 1. If not plain text, revert to plain text first (keeps text!)
                if (type && type !== 'text') {
                    e.preventDefault();
                    EditorHistory.record(true);
                    setBlockType(target, 'text');
                    updateNumberPrefixes();
                    closeSlashMenu();
                    triggerSave();
                    return;
                }
                
                // 2. If indented, outdent first!
                if (indent > 0) {
                    e.preventDefault();
                    EditorHistory.record(true);
                    indent = indent - 1;
                    wrapper.setAttribute('data-indent', indent);
                    wrapper.style.marginLeft = `${indent * 24}px`;
                    triggerSave();
                    return;
                }
                
                // 3. Otherwise merge with previous block!
                const prev = wrapper.previousElementSibling;
                if (prev && prev.classList.contains('block-wrapper')) {
                    const prevType = prev.getAttribute('data-type');
                    // Nếu block phía trước là ảnh, divider hoặc math -> Xóa ngay dòng phía trước
                    if (prevType === 'image' || prevType === 'divider' || prevType === 'math') {
                        e.preventDefault();
                        EditorHistory.recordBeforeAction();
                        prev.remove();
                        updateNumberPrefixes();
                        triggerSave();
                        EditorHistory.updateLastSnapshot();
                        showToast('🗑️ Đã xóa dòng phía trước');
                        return;
                    }

                    e.preventDefault();
                    EditorHistory.record(true);
                    const prevContent = prev.querySelector('.block-content');
                    if (prevContent) {
                        const prevTextLen = prevContent.innerText ? prevContent.innerText.length : 0;
                        const currentHtml = target.innerHTML;
                        
                        if (currentHtml && currentHtml !== '<br>') {
                            prevContent.innerHTML += currentHtml;
                        }
                        
                        wrapper.remove();
                        updateNumberPrefixes();
                        
                        setCaretAtOffset(prevContent, prevTextLen);
                        triggerSave();
                        return;
                    }
                }
            }
        }
    }

    // Forward Delete key handler: xóa dòng ảnh, divider hoặc math phía dưới nếu con trỏ ở cuối dòng
    if (e.key === 'Delete') {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            let isAtEnd = false;
            if (range.endOffset >= (range.endContainer.textContent || '').length) {
                let nextNode = range.endContainer.nextSibling;
                isAtEnd = true;
                while (nextNode) {
                    if (nextNode.textContent && nextNode.textContent.length > 0) {
                        isAtEnd = false;
                        break;
                    }
                    nextNode = nextNode.nextSibling;
                }
            }
            if (isAtEnd) {
                const next = wrapper.nextElementSibling;
                if (next && next.classList.contains('block-wrapper')) {
                    const nextType = next.getAttribute('data-type');
                    if (nextType === 'image' || nextType === 'divider' || nextType === 'math') {
                        e.preventDefault();
                        EditorHistory.record(true);
                        next.remove();
                        updateNumberPrefixes();
                        triggerSave();
                        showToast('🗑️ Đã xóa dòng phía dưới');
                        return;
                    }
                }
            }
        }
    }
}

function handleBlockInput(e) {
    const target = e.target;
    const wrapper = target.closest('.block-wrapper');
    if (wrapper) {
        activeBlockId = wrapper.getAttribute('data-id');
        activeBlockElement = target;
    }
    EditorHistory.record(false, e);
    
    // Check for Word/Markdown shortcuts: "- ", "1. ", "[] ", "# ", etc.
    const converted = checkMarkdownShortcuts(target);
    if (converted) {
        closeSlashMenu();
        return;
    }
    
    const text = target.innerText || target.textContent || '';
    const match = text.match(/\/([a-zA-Z0-9_-]*)$/);
    if (match) {
        const query = match[1].toLowerCase();
        openSlashMenu(target, query);
    } else {
        closeSlashMenu();
    }
    triggerSave();
}

function extractCleanInlineHtml(html) {
    if (!html) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const body = doc.body;
        if (!body) return '';
        body.querySelectorAll('script, style, meta, link').forEach(el => el.remove());
        const blocks = body.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, table, pre, blockquote');
        if (blocks.length <= 1) {
            const inner = blocks.length === 1 ? blocks[0].innerHTML : body.innerHTML;
            return inner.trim();
        }
    } catch (e) {}
    return '';
}

function formatInlineMarkdown(text) {
    if (!text) return '';
    let res = escapeHtml(text);
    // Chuyển `code` thành <code class="inline-code">code</code>
    res = res.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // Chuyển **bold** thành <strong>bold</strong>
    res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return res;
}

function preprocessClipboardHtml(html) {
    if (!html) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Chuyển các thẻ code inline thành dạng `code`
        doc.querySelectorAll('code, pre').forEach(c => {
            const codeText = c.textContent || '';
            if (codeText && !codeText.includes('\n')) {
                c.replaceWith(document.createTextNode(' `' + codeText.trim() + '` '));
            }
        });

        // Bóc tách các công thức KaTeX / MathML / LaTeX từ ChatGPT, Claude, DeepSeek, Wikipedia
        let foundMath = false;
        doc.querySelectorAll('.katex-display, .katex, math, .mwe-math-element, [data-latex]').forEach(mathEl => {
            const ann = mathEl.querySelector('annotation[encoding*="tex"]') || mathEl.querySelector('annotation');
            let tex = '';
            if (mathEl.getAttribute('data-latex')) {
                tex = mathEl.getAttribute('data-latex');
            } else if (ann) {
                tex = ann.textContent || '';
            } else if (mathEl.getAttribute('alt')) {
                tex = mathEl.getAttribute('alt');
            } else if (mathEl.dataset && mathEl.dataset.tex) {
                tex = mathEl.dataset.tex;
            }
            if (tex) {
                foundMath = true;
                tex = tex.trim();
                const isDisplay = mathEl.classList.contains('katex-display') || 
                                  mathEl.closest('.katex-display') || 
                                  mathEl.getAttribute('display') === 'block' ||
                                  tex.includes('\\begin{') || tex.includes('\\\\') || tex.length > 50;
                const node = document.createTextNode(isDisplay ? `\n\n$$${tex}$$\n\n` : ` $${tex}$ `);
                mathEl.replaceWith(node);
            }
        });

        // Thêm dấu ngắt dòng cho các thẻ khối
        doc.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        doc.querySelectorAll('p, div, tr, h1, h2, h3, h4, h5, h6').forEach(el => el.append('\n'));
        doc.querySelectorAll('li').forEach(li => {
            li.parentNode.insertBefore(document.createTextNode('\n• '), li);
        });

        return (doc.body ? (doc.body.innerText || doc.body.textContent || '') : '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
    } catch (e) {
        return '';
    }
}

function parsePastedContentToBlocks(rawText, baseIndent = 0, rawHtml = '') {
    let text = (rawText || '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
    // Chuẩn hóa ký hiệu LaTeX display \[ ... \] thành $$ ... $$
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
    // Tự động bọc các môi trường ma trận / mảng phép tính đứng riêng vào $$
    text = text.replace(/(?<!\$)(?:\\begin\{(array|align|matrix|pmatrix|bmatrix|cases|equation|gather)\}[\s\S]*?\\end\{\1\})(?!\$)/g, (m) => `\n$$${m}$$\n`);

    // 0. Kiểm tra nếu có dán HTML table (Excel, Word, Google Docs/Sheets, Web)
    if (rawHtml && rawHtml.includes('<table')) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, 'text/html');
            const tableEl = doc.querySelector('table');
            if (tableEl) {
                const rows = [];
                tableEl.querySelectorAll('tr').forEach(tr => {
                    const rowCells = [];
                    tr.querySelectorAll('th, td').forEach(td => {
                        rowCells.push(td.innerHTML.trim());
                    });
                    if (rowCells.length > 0) rows.push(rowCells);
                });
                if (rows.length > 0) {
                    return [{
                        type: 'table',
                        content: JSON.stringify({ hasHeader: true, rows }),
                        indent: baseIndent
                    }];
                }
            }
        } catch (e) {}
    }

    // 0.1 Kiểm tra nếu là bảng dữ liệu phân tách bằng tab (TSV copied from Excel / Google Sheets)
    if (text.includes('\t') && text.includes('\n')) {
        const rawLines = text.trim().split('\n');
        if (rawLines.length >= 2 && rawLines.some(l => l.includes('\t'))) {
            const rows = rawLines.map(l => l.split('\t').map(c => c.trim()));
            if (rows.every(r => r.length === rows[0].length && r.length >= 2)) {
                return [{
                    type: 'table',
                    content: JSON.stringify({ hasHeader: true, rows }),
                    indent: baseIndent
                }];
            }
        }
    }

    // 0.2 Kiểm tra nếu toàn bộ đoạn text là bảng Markdown (| Col 1 | Col 2 |)
    const mdLines = text.trim().split('\n').map(l => l.trim());
    if (mdLines.length >= 2 && mdLines.every(l => l.startsWith('|') && l.endsWith('|'))) {
        const parsedRows = [];
        let hasSeparator = false;
        mdLines.forEach(line => {
            if (/^\|[\s\-:|]+\|$/.test(line)) {
                hasSeparator = true;
                return;
            }
            const cells = line.split('|').slice(1, -1).map(c => formatInlineMarkdown(c.trim()));
            if (cells.length > 0) parsedRows.push(cells);
        });
        if (parsedRows.length > 0) {
            return [{
                type: 'table',
                content: JSON.stringify({ hasHeader: hasSeparator, rows: parsedRows }),
                indent: baseIndent
            }];
        }
    }

    const blocks = [];
    const pattern = /\$\$([\s\S]*?)\$\$/g;
    let lastIdx = 0;
    let match;

    function parseTextChunk(chunk) {
        if (!chunk) return;
        const rawLines = chunk.split('\n');
        for (let i = 0; i < rawLines.length; i++) {
            const rawLine = rawLines[i];
            const trimmed = rawLine.trim();
            if (!trimmed) continue;

            let blockType = 'text';
            let blockIndent = baseIndent;
            let m;

            const leadingSpaces = (rawLine.match(/^ */) || [''])[0].length;
            if (leadingSpaces >= 2) {
                blockIndent = Math.min(4, baseIndent + Math.floor(leadingSpaces / 2));
            }

            let blockContent = '';
            if ((m = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/))) {
                blockType = 'image';
                blockContent = JSON.stringify({ src: m[2], caption: m[1] || '', width: 'fit-content', align: 'center', frameStyle: 'standard' });
            } else if (trimmed === '---') {
                blockType = 'divider';
                blockContent = '';
            } else if ((m = trimmed.match(/^###\s+(.*)$/))) {
                blockType = 'h3';
                blockContent = formatInlineMarkdown(m[1]);
            } else if ((m = trimmed.match(/^##\s+(.*)$/))) {
                blockType = 'h2';
                blockContent = formatInlineMarkdown(m[1]);
            } else if ((m = trimmed.match(/^#\s+(.*)$/))) {
                blockType = 'h1';
                blockContent = formatInlineMarkdown(m[1]);
            } else if ((m = trimmed.match(/^(?:[-*]\s+)?\[( |x|X)?\]\s*(.*)$/))) {
                blockType = 'todo';
                blockContent = (m[1] && m[1].toLowerCase() === 'x' ? '[x] ' : '') + formatInlineMarkdown(m[2]);
            } else if ((m = trimmed.match(/^[-*•]\s+(.*)$/))) {
                blockType = 'bullet';
                blockContent = formatInlineMarkdown(m[1]);
            } else if ((m = trimmed.match(/^\d+[.)]\s+(.*)$/))) {
                blockType = 'number';
                blockContent = formatInlineMarkdown(m[1]);
            } else if ((m = trimmed.match(/^>\s?(.*)$/))) {
                blockType = 'quote';
                blockContent = formatInlineMarkdown(m[1]);
            } else if (trimmed.startsWith('```')) {
                blockType = 'code';
                blockContent = escapeHtml(trimmed.replace(/^```/, ''));
            } else {
                blockContent = formatInlineMarkdown(trimmed);
            }

            blocks.push({
                type: blockType,
                content: blockContent,
                indent: blockIndent
            });
        }
    }

    while ((match = pattern.exec(text)) !== null) {
        const textBefore = text.substring(lastIdx, match.index);
        parseTextChunk(textBefore);

        const formula = match[1].trim();
        if (formula) {
            blocks.push({
                type: 'math',
                content: formula,
                indent: baseIndent
            });
        }
        lastIdx = pattern.lastIndex;
    }

    const textAfter = text.substring(lastIdx);
    parseTextChunk(textAfter);

    return blocks;
}

function handleBlockPaste(e) {
    let target = e.target;

    // Nếu người dùng đang dán trực tiếp vào ô nhập công thức LaTeX (.math-latex-input)
    if (target && target.classList && target.classList.contains('math-latex-input')) {
        let pastedText = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
        if (pastedText) {
            pastedText = pastedText.trim()
                .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
                .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '')
                .replace(/^\$\s*/, '').replace(/\s*\$$/, '');
            e.preventDefault();
            document.execCommand('insertText', false, pastedText);
            const inputEvt = new Event('input', { bubbles: true });
            target.dispatchEvent(inputEvt);
            return;
        }
        return;
    }

    let wrapper = target ? target.closest('.block-wrapper') : null;
    if (!wrapper) return;
    EditorHistory.record(true);

    // Multi-block selection paste replacement
    if (typeof selectedBlockWrappers !== 'undefined' && selectedBlockWrappers && selectedBlockWrappers.length > 0) {
        if (selectedBlockWrappers.includes(wrapper)) {
            const firstBlock = selectedBlockWrappers[0];
            const restBlocks = selectedBlockWrappers.slice(1);
            restBlocks.forEach(w => w.remove());
            clearBlockSelection();
            if (firstBlock) {
                const firstContent = firstBlock.querySelector('.block-content');
                if (firstContent) {
                    target = firstContent;
                    wrapper = firstBlock;
                    target.innerHTML = '';
                }
            }
        } else {
            clearBlockSelection();
        }
    }

    // 1. Kiểm tra dán ảnh trực tiếp từ clipboard (Messenger, Snipping Tool, Win+Shift+S)
    const cbItems = e.clipboardData ? e.clipboardData.items : null;
    let pastedImageFile = null;
    if (cbItems) {
        for (let i = 0; i < cbItems.length; i++) {
            if (cbItems[i].type && cbItems[i].type.startsWith('image/')) {
                pastedImageFile = cbItems[i].getAsFile();
                break;
            }
        }
    }
    if (!pastedImageFile && e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
            if (e.clipboardData.files[i].type && e.clipboardData.files[i].type.startsWith('image/')) {
                pastedImageFile = e.clipboardData.files[i];
                break;
            }
        }
    }

    if (pastedImageFile) {
        e.preventDefault();
        e.stopPropagation();
        insertImageFromFile(pastedImageFile, wrapper);
        return;
    }

    let text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    const html = e.clipboardData ? e.clipboardData.getData('text/html') : '';

    // 2. Tiền xử lý clipboard: Khôi phục công thức LaTeX & code pills nếu copy từ ChatGPT, Claude, DeepSeek, Wikipedia
    const preprocessedFromHtml = preprocessClipboardHtml(html);
    if (preprocessedFromHtml && (preprocessedFromHtml.includes('$$') || preprocessedFromHtml.includes('`') || preprocessedFromHtml.includes('\n'))) {
        text = preprocessedFromHtml;
    }

    text = (text || '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
    if (!text && !html) return;

    const trimmedAll = text.trim();

    // 3. Kiểm tra nếu người dùng dán ĐƠN MỘT CÔNG THỨC TOÁN (Single Math Formula)
    const isSingleMathFormula = (
        (trimmedAll.startsWith('$$') && trimmedAll.endsWith('$$') && trimmedAll.length > 4 && !trimmedAll.slice(2, -2).includes('$$')) ||
        (trimmedAll.startsWith('\\[') && trimmedAll.endsWith('\\]') && trimmedAll.length > 4) ||
        (/^\\[a-zA-Z]+/.test(trimmedAll) && (trimmedAll.includes('\\neq') || trimmedAll.includes('\\implies') || trimmedAll.includes('\\frac') || trimmedAll.includes('\\begin{array}') || trimmedAll.includes('\\times') || trimmedAll.includes('&') || trimmedAll.includes('=')))
    );

    if (isSingleMathFormula) {
        e.preventDefault();
        EditorHistory.recordBeforeAction();
        const cleanFormula = trimmedAll
            .replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
            .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
        setBlockType(target, 'math', cleanFormula);
        selectSingleBlock(wrapper);
        triggerSave();
        EditorHistory.updateLastSnapshot();
        return;
    }

    // 4. Phân tích nội dung clipboard thành danh sách khối hoàn chỉnh
    const currentIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
    const parsedBlocks = parsePastedContentToBlocks(text, currentIndent, html);

    if (parsedBlocks.length > 1 || (parsedBlocks.length === 1 && parsedBlocks[0].type !== 'text')) {
        e.preventDefault();
        EditorHistory.recordBeforeAction();

        // Tách nội dung trước và sau con trỏ trong khối hiện tại nếu có
        let beforeHtml = '';
        let afterHtml = '';
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && target.contains(sel.anchorNode)) {
            try {
                const range = sel.getRangeAt(0);
                const beforeRange = range.cloneRange();
                beforeRange.selectNodeContents(target);
                beforeRange.setEnd(range.startContainer, range.startOffset);
                const beforeFrag = beforeRange.cloneContents();
                const tempDivBefore = document.createElement('div');
                tempDivBefore.appendChild(beforeFrag);
                beforeHtml = tempDivBefore.innerHTML.trim();

                const afterRange = range.cloneRange();
                afterRange.selectNodeContents(target);
                afterRange.setStart(range.endContainer, range.endOffset);
                const afterFrag = afterRange.cloneContents();
                const tempDivAfter = document.createElement('div');
                tempDivAfter.appendChild(afterFrag);
                afterHtml = tempDivAfter.innerHTML.trim();
            } catch (err) {}
        }

        const firstBlock = parsedBlocks[0];

        // Khối đầu tiên: cập nhật trực tiếp vào khối hiện tại với nội dung đầy đủ
        if (firstBlock.type !== 'image' && firstBlock.type !== 'math' && firstBlock.type !== 'table' && firstBlock.type !== 'divider' && firstBlock.type !== 'toc') {
            target.innerHTML = (beforeHtml ? beforeHtml + ' ' : '') + firstBlock.content;
            setBlockType(target, firstBlock.type, target.innerHTML);
        } else {
            // Khối đặc biệt (math, table, image, divider, toc)
            setBlockType(target, firstBlock.type, firstBlock.content);
        }

        if (firstBlock.indent !== undefined) {
            wrapper.setAttribute('data-indent', firstBlock.indent);
            wrapper.style.marginLeft = `${firstBlock.indent * 24}px`;
        }

        // Các khối tiếp theo: chèn nối tiếp bên dưới
        let lastWrapper = wrapper;
        let lastContentEl = target;

        for (let i = 1; i < parsedBlocks.length; i++) {
            const b = parsedBlocks[i];
            const newWrapper = createBlockElement(b.type, b.content, generateId(), b.indent !== undefined ? b.indent : currentIndent);
            lastWrapper.parentNode.insertBefore(newWrapper, lastWrapper.nextSibling);
            lastWrapper = newWrapper;
            lastContentEl = newWrapper.querySelector('.block-content');
        }

        // Nếu có phần nội dung sau con trỏ, ghép vào khối cuối cùng
        if (afterHtml && lastContentEl && lastContentEl.contentEditable !== 'false') {
            lastContentEl.innerHTML += (lastContentEl.innerHTML ? ' ' : '') + afterHtml;
        }

        updateNumberPrefixes();

        if (lastContentEl && lastContentEl.contentEditable !== 'false') {
            lastContentEl.focus();
            setCaretAtEnd(lastContentEl);
        }

        closeSlashMenu();
        triggerSave();
        EditorHistory.updateLastSnapshot();
        return;
    }

    // 5. Nếu chỉ là 1 khối text hoặc đoạn văn bản đơn giản: giữ nguyên chèn tự nhiên
    const cleanInlineHtml = extractCleanInlineHtml(html);
    if (cleanInlineHtml && (cleanInlineHtml.includes('<') || cleanInlineHtml.includes('style='))) {
        e.preventDefault();
        EditorHistory.recordBeforeAction();
        document.execCommand('insertHTML', false, cleanInlineHtml);
        checkMarkdownShortcuts(target);
        triggerSave();
        EditorHistory.updateLastSnapshot();
        return;
    }

    e.preventDefault();
    EditorHistory.recordBeforeAction();
    document.execCommand('insertText', false, text);
    checkMarkdownShortcuts(target);
    triggerSave();
    EditorHistory.updateLastSnapshot();
    return;

    closeSlashMenu();
    triggerSave();
}

function openSlashMenu(target, query = '') {
    const rect = target.getBoundingClientRect();
    elements.slashMenu.style.display = 'block';
    elements.slashMenu.style.top = `${rect.bottom + 5}px`;
    elements.slashMenu.style.left = `${rect.left}px`;
    
    // Đảm bảo mục Bảng (Table) luôn có mặt trong DOM ngay cả khi HTML bị cache cũ
    let tableItem = elements.slashMenu.querySelector('.slash-menu-item[data-type="table"]');
    if (!tableItem) {
        tableItem = document.createElement('div');
        tableItem.className = 'slash-menu-item';
        tableItem.setAttribute('data-type', 'table');
        tableItem.setAttribute('data-keywords', 'table bang grid spreadsheet cot hang row column du lieu');
        tableItem.innerHTML = `
            <div class="item-icon"><i class="ri-table-line"></i></div>
            <div class="item-info">
                <div class="item-title">Table (Bảng)</div>
                <div class="item-desc">Tạo bảng dữ liệu hàng & cột linh hoạt.</div>
            </div>
        `;
        tableItem.addEventListener('click', () => applySlashCommand('table'));
        const tocItem = elements.slashMenu.querySelector('.slash-menu-item[data-type="toc"]');
        if (tocItem && tocItem.nextSibling) {
            elements.slashMenu.insertBefore(tableItem, tocItem.nextSibling);
        } else {
            elements.slashMenu.appendChild(tableItem);
        }
    }

    // Filter items
    const items = elements.slashMenu.querySelectorAll('.slash-menu-item');
    let hasVisible = false;
    let firstVisible = null;
    items.forEach(item => {
        const title = (item.querySelector('.item-title')?.textContent || '').toLowerCase();
        const type = (item.getAttribute('data-type') || '').toLowerCase();
        const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
        if (title.includes(query) || type.includes(query) || keywords.includes(query)) {
            item.style.display = 'flex';
            hasVisible = true;
            if (!firstVisible) firstVisible = item;
        } else {
            item.style.display = 'none';
            item.classList.remove('selected');
        }
    });

    // Tự động đánh dấu mục đầu tiên phù hợp để nhấn Enter là chọn ngay
    items.forEach(it => it.classList.remove('selected'));
    if (firstVisible) {
        firstVisible.classList.add('selected');
    }
    
    if (!hasVisible) {
        closeSlashMenu();
    }
}

function closeSlashMenu() {
    elements.slashMenu.style.display = 'none';
}

function applySlashCommand(type) {
    if (activeBlockElement) {
        const wrapper = activeBlockElement.closest('.block-wrapper');
        // Remove the /command string
        activeBlockElement.innerText = activeBlockElement.innerText.replace(/\/[a-zA-Z0-9_-]*$/, '');
        
        if (type === 'image') {
            closeSlashMenu();
            openImageModalForTarget(wrapper);
            return;
        }

        if (type === 'math') {
            closeSlashMenu();
            setBlockType(activeBlockElement, 'math', '');
            const editorPanel = activeBlockElement.querySelector('.math-editor-panel');
            if (editorPanel) {
                editorPanel.style.display = 'block';
                const input = editorPanel.querySelector('.math-latex-input');
                if (input) setTimeout(() => input.focus(), 60);
            }
            triggerSave();
            return;
        }

        if (type === 'table') {
            closeSlashMenu();
            setBlockType(activeBlockElement, 'table', '');
            triggerSave();
            return;
        }

        setBlockType(activeBlockElement, type);
        activeBlockElement.focus();
        
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(activeBlockElement);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        
        triggerSave();
    }
    closeSlashMenu();
}

function setBlockType(element, type, initialContent = '') {
    const wrapper = element.closest('.block-wrapper');
    const prefixEl = wrapper.querySelector('.block-prefix');
    
    // Update prefix based on type
    let prefix = '';
    const isToggle = type === 'toggle' || (type && type.startsWith('toggle-'));
    
    if (type === 'todo') {
        let checked = element.style.textDecoration === 'line-through';
        if (typeof initialContent === 'string' && initialContent.startsWith('[x] ')) {
            checked = true;
            element.innerHTML = initialContent.slice(4);
            element.style.textDecoration = 'line-through';
            element.style.opacity = '0.5';
        }
        prefix = `<input type="checkbox" class="todo-cb" ${checked ? 'checked' : ''} onclick="toggleTodo(this)">`;
    } else {
        if (element.style.textDecoration === 'line-through') {
            element.style.textDecoration = 'none';
            element.style.opacity = '1';
        }
        if (isToggle) {
            prefix = `<i class="ri-arrow-right-s-line toggle-icon open" onclick="toggleBlockOpen(this)"></i>`;
        } else if (type === 'bullet') {
            prefix = `<span class="bullet-dot">•</span>`;
        } else if (type === 'number') {
            prefix = `<span class="number-prefix">1.</span>`;
        } else if (type === 'quote') {
            prefix = `<div class="quote-bar"></div>`;
        } else if (type === 'callout') {
            prefix = `<span class="callout-icon">💡</span>`;
        } else if (type === 'divider') {
            element.innerHTML = `<hr class="divider-line">`;
            element.contentEditable = false;
        } else if (type === 'toc') {
            renderTableOfContents(element);
            element.contentEditable = false;
        } else if (type === 'image') {
            renderImageBlock(element, initialContent);
            element.contentEditable = false;
        } else if (type === 'math') {
            renderMathBlock(element, initialContent);
            element.contentEditable = false;
        } else if (type === 'table') {
            renderTableBlock(element, initialContent);
            element.contentEditable = false;
        }
    }
    
    // Ràng buộc thụt đầu dòng (indentation constraints) cho tiêu đề Heading
    if (wrapper) {
        if (type === 'h1' || type === 'toggle-h1') {
            wrapper.setAttribute('data-indent', 0);
            wrapper.style.marginLeft = '0px';
        } else if (type === 'h2' || type === 'toggle-h2') {
            let curIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
            if (curIndent > 1) {
                wrapper.setAttribute('data-indent', 1);
                wrapper.style.marginLeft = '24px';
            }
        } else if (type === 'h3' || type === 'toggle-h3') {
            let curIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
            if (curIndent > 2) {
                wrapper.setAttribute('data-indent', 2);
                wrapper.style.marginLeft = '48px';
            }
        }
    }

    if (type !== 'divider' && type !== 'image' && type !== 'toc' && type !== 'math' && type !== 'table') {
        const page = appState.pages[appState.activePageId];
        const isLocked = page && page.locked;
        element.contentEditable = !isLocked;
    }

    if (prefixEl) {
        prefixEl.innerHTML = prefix;
        if (!prefix) {
            prefixEl.style.display = 'none';
        } else {
            prefixEl.style.display = 'flex';
        }
    }

    let classes = `block-content block-type-${type}`;
    if (type === 'toggle-h1') classes += ' block-type-h1 block-type-toggle-h1 block-type-toggle';
    if (type === 'toggle-h2') classes += ' block-type-h2 block-type-toggle-h2 block-type-toggle';
    if (type === 'toggle-h3') classes += ' block-type-h3 block-type-toggle-h3 block-type-toggle';
    element.className = classes;
    
    element.setAttribute('data-type', type);
    wrapper.setAttribute('data-type', type);
    
    let placeholder = "Type '/' for commands";
    if (type === 'h1' || type === 'toggle-h1') placeholder = "Heading 1";
    if (type === 'h2' || type === 'toggle-h2') placeholder = "Heading 2";
    if (type === 'h3' || type === 'toggle-h3') placeholder = "Heading 3";
    if (type === 'bullet') placeholder = "Danh sách chấm";
    if (type === 'number') placeholder = "Danh sách số";
    if (type === 'todo') placeholder = "To-do";
    if (type === 'code') placeholder = "Code snippet";
    if (type === 'quote') placeholder = "Empty quote";
    if (type === 'toggle') placeholder = "Toggle";
    if (type === 'image' || type === 'divider' || type === 'toc' || type === 'math' || type === 'table') {
        element.removeAttribute('data-placeholder');
    } else {
        element.setAttribute('data-placeholder', placeholder);
    }
}

function renderTableOfContents(element) {
    const headings = [];
    elements.blockEditor.querySelectorAll('.block-wrapper').forEach(wrapper => {
        const type = wrapper.getAttribute('data-type') || '';
        if (['h1', 'h2', 'h3', 'toggle-h1', 'toggle-h2', 'toggle-h3'].includes(type)) {
            const contentEl = wrapper.querySelector('.block-content');
            const text = contentEl.innerText.trim();
            if (text) {
                const level = type.includes('h1') ? 0 : (type.includes('h2') ? 1 : 2);
                headings.push({ id: wrapper.getAttribute('data-id'), text, level });
            }
        }
    });

    if (headings.length === 0) {
        element.innerHTML = `
            <div class="toc-container">
                <div class="toc-header"><i class="ri-list-check-2"></i> Table of contents</div>
                <div style="font-size: 13px; color: var(--text-secondary); font-style: italic;">No headings on this page yet. Add H1, H2, or Toggle Headings to see the outline.</div>
            </div>
        `;
    } else {
        const itemsHtml = headings.map(h => `
            <div class="toc-item indent-${h.level}" onclick="scrollToBlock('${h.id}')">
                ${h.text}
            </div>
        `).join('');
        element.innerHTML = `
            <div class="toc-container">
                <div class="toc-header"><i class="ri-list-check-2"></i> Table of contents</div>
                <div class="toc-list">${itemsHtml}</div>
            </div>
        `;
    }
}

function scrollToBlock(id) {
    const el = document.querySelector(`.block-wrapper[data-id="${id}"]`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 0.3s';
        el.style.background = 'rgba(59, 130, 246, 0.2)';
        setTimeout(() => { el.style.background = ''; }, 1000);
    }
}

function refreshToc() {
    const tocs = elements.blockEditor.querySelectorAll('.block-type-toc');
    tocs.forEach(t => renderTableOfContents(t));
}

// Start app
window.addEventListener('DOMContentLoaded', initApp);

// --- VOCABULARY & FLASHCARDS MODULE ---
const defaultVocabItems = [
    {
        id: 'v1',
        word: 'Microcontroller',
        phonetic: '/ˌmaɪ.kroʊ.kənˈtroʊ.lɚ/',
        meaning: 'Vi điều khiển: chip tích hợp bộ vi xử lý, bộ nhớ và các ngoại vi điều khiển phần cứng',
        example: 'Modern automotive ECUs rely on a high-performance 32-bit microcontroller.',
        tag: 'TechAdvanced',
        status: 'learning',
        createdAt: 1715000000000
    },
    {
        id: 'v2',
        word: 'Concurrency',
        phonetic: '/kənˈkɝː.ən.si/',
        meaning: 'Tính đồng thời: khả năng phân chia và xử lý nhiều tác vụ cùng lúc mà không xung đột tài nguyên',
        example: 'Concurrency control is critical for high-throughput distributed systems.',
        tag: 'TechAdvanced',
        status: 'mastered',
        createdAt: 1715001000000
    },
    {
        id: 'v3',
        word: 'Refactoring',
        phonetic: '/riːˈfæk.tər.ɪŋ/',
        meaning: 'Tái cấu trúc mã nguồn: cải thiện thiết kế cấu trúc code bên trong mà không làm đổi hành vi bên ngoài',
        example: 'Regular code refactoring improves software maintainability and performance.',
        tag: 'TechCommon',
        status: 'mastered',
        createdAt: 1715002000000
    },
    {
        id: 'v4',
        word: 'Latency',
        phonetic: '/ˈleɪ.tən.si/',
        meaning: 'Độ trễ: khoảng thời gian trôi qua từ khi một gói dữ liệu được gửi đến khi nhận được phản hồi',
        example: 'We optimized our network layer to achieve sub-millisecond API latency.',
        tag: 'TechCommon',
        status: 'learning',
        createdAt: 1715003000000
    },
    {
        id: 'v5',
        word: 'Collaborate',
        phonetic: '/kəˈlæb.ə.reɪt/',
        meaning: 'Hợp tác, cộng tác cùng làm việc trong dự án hoặc đàm phán công việc',
        example: 'Engineers collaborate with the product team to design better user experiences.',
        tag: 'TOEIC',
        status: 'mastered',
        createdAt: 1715004000000
    },
    {
        id: 'v6',
        word: 'Negotiate',
        phonetic: '/nəˈɡoʊ.ʃi.eɪt/',
        meaning: 'Thương lượng, đàm phán để đạt được thỏa thuận hợp đồng',
        example: 'The project manager will negotiate contract terms with key vendors next Monday.',
        tag: 'TOEIC',
        status: 'learning',
        createdAt: 1715005000000
    },
    {
        id: 'v7',
        word: 'Serendipity',
        phonetic: '/ˌser.ənˈdɪp.ə.t̬i/',
        meaning: 'Sự tình cờ may mắn, sự khám phá ngẫu nhiên đầy giá trị',
        example: 'Finding the optimal algorithm in an old school notebook was pure serendipity.',
        tag: 'Other',
        status: 'learning',
        createdAt: 1715006000000
    }
];

const vocab = {
    items: [],
    activeTag: 'all',
    searchQuery: '',
    currentView: 'list',
    flashcardIndex: 0,
    flashcardDeck: [],

    getTagInfo: (tag) => {
        switch (tag) {
            case 'TechAdvanced':
                return { label: 'Kỹ thuật chuyên sâu', icon: '🔧', cls: 'tag-tech-adv' };
            case 'TechCommon':
                return { label: 'Kỹ thuật quen thuộc', icon: '💻', cls: 'tag-tech-com' };
            case 'TOEIC':
                return { label: 'Tiếng Anh TOEIC', icon: '🎯', cls: 'tag-toeic' };
            case 'Other':
            default:
                return { label: 'Khác', icon: '📝', cls: 'tag-other' };
        }
    },

    initVocab: () => {
        const stored = localStorage.getItem('schooldb_vocab_items');
        if (stored) {
            try {
                vocab.items = JSON.parse(stored);
                // Migrate any old legacy tags
                vocab.items.forEach(item => {
                    if (item.tag === 'Tech') item.tag = 'TechCommon';
                    else if (item.tag === 'IELTS') item.tag = 'TOEIC';
                    else if (item.tag === 'Daily' || item.tag === 'General' || !item.tag) item.tag = 'Other';
                });
            } catch (e) {
                vocab.items = defaultVocabItems;
            }
        } else {
            vocab.items = defaultVocabItems;
            vocab.save();
        }
        vocab.renderStats();
        vocab.renderGrid();
        vocab.initDeck();
    },

    save: (itemToSync) => {
        localStorage.setItem('schooldb_vocab_items', JSON.stringify(vocab.items));
        vocab.renderStats();
        broadcastLocalChange('vocab-updated', { count: vocab.items.length });

        if (db) {
            if (itemToSync && itemToSync.id) {
                db.collection('vocab_items').doc(itemToSync.id).set(itemToSync, { merge: true })
                    .catch(err => console.warn('Vocab cloud sync warning:', err));
            } else {
                clearTimeout(vocabSyncTimeout);
                vocabSyncTimeout = setTimeout(() => {
                    const batch = db.batch();
                    let count = 0;
                    vocab.items.forEach(item => {
                        if (item && item.id && item.word) {
                            batch.set(db.collection('vocab_items').doc(item.id), item, { merge: true });
                            count++;
                            if (count >= 400) return;
                        }
                    });
                    if (count > 0) batch.commit().catch(err => console.warn('Vocab batch sync warning:', err));
                }, 800);
            }
        }
    },

    renderStats: () => {
        const total = vocab.items.length;
        const mastered = vocab.items.filter(i => i.status === 'mastered').length;
        const learning = total - mastered;

        const totalEl = document.getElementById('stat-total-words');
        const masteredEl = document.getElementById('stat-mastered-words');
        const learningEl = document.getElementById('stat-learning-words');

        if (totalEl) totalEl.textContent = total;
        if (masteredEl) masteredEl.textContent = mastered;
        if (learningEl) learningEl.textContent = learning;
    },

    renderGrid: () => {
        const grid = document.getElementById('vocab-grid');
        if (!grid) return;

        let filtered = vocab.items.filter(item => {
            const matchesTag = vocab.activeTag === 'all' || item.tag === vocab.activeTag;
            const q = vocab.searchQuery.toLowerCase();
            const matchesQuery = !q || item.word.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q);
            return matchesTag && matchesQuery;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
                    <i class="ri-inbox-line" style="font-size: 40px; opacity: 0.5;"></i>
                    <p style="margin-top: 12px; font-size: 15px;">Chưa tìm thấy từ vựng nào trong danh mục này.</p>
                    <button class="btn btn-primary" style="margin-top: 14px;" onclick="vocab.openAddModal()">
                        <i class="ri-add-line"></i> Thêm từ mới
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const tagInfo = vocab.getTagInfo(item.tag);
            return `
            <div class="vocab-card" data-id="${item.id}">
                <div>
                    <div class="vocab-card-header">
                        <div class="vocab-card-word">
                            <span>${escapeHtml(item.word)}</span>
                            <i class="ri-volume-up-line vocab-audio-icon" onclick="event.stopPropagation(); vocab.speakWord('${escapeJs(item.word)}')" title="Nghe phát âm"></i>
                        </div>
                        <span class="vocab-tag-badge ${tagInfo.cls}">${tagInfo.icon} ${escapeHtml(tagInfo.label)}</span>
                    </div>

                    ${item.phonetic ? `<div class="vocab-card-phonetic">${escapeHtml(item.phonetic)}</div>` : ''}
                    <div class="vocab-card-meaning">${escapeHtml(item.meaning)}</div>
                    ${item.example ? `<div class="vocab-card-example">${escapeHtml(item.example)}</div>` : ''}
                </div>

                <div class="vocab-card-footer">
                    <span class="vocab-status-check ${item.status === 'mastered' ? 'mastered' : 'learning'}" onclick="vocab.toggleStatus('${item.id}')">
                        <i class="${item.status === 'mastered' ? 'ri-checkbox-circle-fill' : 'ri-time-line'}"></i>
                        ${item.status === 'mastered' ? 'Đã nhớ' : 'Cần ôn'}
                    </span>

                    <div class="vocab-card-actions">
                        <button class="vocab-icon-action" onclick="vocab.editWord('${item.id}')" title="Sửa">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button class="vocab-icon-action delete" onclick="vocab.deleteWord('${item.id}')" title="Xóa">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    switchView: (view) => {
        vocab.currentView = view;
        const listView = document.getElementById('vocab-grid-view');
        const filterBar = document.getElementById('vocab-filter-bar');
        const flashcardView = document.getElementById('vocab-flashcard-view');
        const tabList = document.getElementById('tab-vocab-list');
        const tabFc = document.getElementById('tab-vocab-flashcard');

        if (view === 'list') {
            listView.style.display = 'block';
            filterBar.style.display = 'flex';
            flashcardView.style.display = 'none';
            tabList.classList.add('active');
            tabFc.classList.remove('active');
            vocab.renderGrid();
        } else {
            listView.style.display = 'none';
            filterBar.style.display = 'none';
            flashcardView.style.display = 'block';
            tabList.classList.remove('active');
            tabFc.classList.add('active');
            vocab.initDeck();
        }
    },

    setTagFilter: (tag, btn) => {
        vocab.activeTag = tag;
        document.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        vocab.renderGrid();
    },

    filterWords: () => {
        const input = document.getElementById('vocab-search-input');
        vocab.searchQuery = input ? input.value.trim() : '';
        vocab.renderGrid();
    },

    openAddModal: (prefillWord = '') => {
        const modal = document.getElementById('vocab-modal');
        const titleEl = document.getElementById('vocab-modal-title');
        const idInput = document.getElementById('vocab-edit-id');
        const wordInput = document.getElementById('vocab-input-word');
        const phoneticInput = document.getElementById('vocab-input-phonetic');
        const meaningInput = document.getElementById('vocab-input-meaning');
        const exampleInput = document.getElementById('vocab-input-example');
        const tagInput = document.getElementById('vocab-input-tag');

        titleEl.innerHTML = '<i class="ri-book-2-line"></i> Thêm từ vựng mới';
        idInput.value = '';
        wordInput.value = prefillWord;
        phoneticInput.value = '';
        meaningInput.value = '';
        exampleInput.value = '';
        tagInput.value = 'TechCommon';

        modal.style.display = 'flex';
        setTimeout(() => {
            if (prefillWord) {
                meaningInput.focus();
            } else {
                wordInput.focus();
            }
        }, 50);
    },

    editWord: (id) => {
        const item = vocab.items.find(i => i.id === id);
        if (!item) return;

        const modal = document.getElementById('vocab-modal');
        const titleEl = document.getElementById('vocab-modal-title');
        const idInput = document.getElementById('vocab-edit-id');
        const wordInput = document.getElementById('vocab-input-word');
        const phoneticInput = document.getElementById('vocab-input-phonetic');
        const meaningInput = document.getElementById('vocab-input-meaning');
        const exampleInput = document.getElementById('vocab-input-example');
        const tagInput = document.getElementById('vocab-input-tag');

        titleEl.innerHTML = '<i class="ri-edit-line"></i> Chỉnh sửa từ vựng';
        idInput.value = item.id;
        wordInput.value = item.word;
        phoneticInput.value = item.phonetic || '';
        meaningInput.value = item.meaning;
        exampleInput.value = item.example || '';
        tagInput.value = item.tag || 'TechCommon';

        modal.style.display = 'flex';
        wordInput.focus();
    },

    closeModal: () => {
        document.getElementById('vocab-modal').style.display = 'none';
    },

    handleFormSubmit: (e) => {
        e.preventDefault();
        const id = document.getElementById('vocab-edit-id').value;
        const word = document.getElementById('vocab-input-word').value.trim();
        const phonetic = document.getElementById('vocab-input-phonetic').value.trim();
        const meaning = document.getElementById('vocab-input-meaning').value.trim();
        const example = document.getElementById('vocab-input-example').value.trim();
        const tag = document.getElementById('vocab-input-tag').value;

        if (!word || !meaning) return;

        if (id) {
            // Edit existing
            const item = vocab.items.find(i => i.id === id);
            if (item) {
                item.word = word;
                item.phonetic = phonetic;
                item.meaning = meaning;
                item.example = example;
                item.tag = tag;
                showToast(`Đã cập nhật từ "${word}"!`);
                vocab.save(item);
            }
        } else {
            // Add new
            const newItem = {
                id: 'v_' + generateId(),
                word,
                phonetic,
                meaning,
                example,
                tag,
                status: 'learning',
                createdAt: Date.now()
            };
            vocab.items.unshift(newItem);
            showToast(`⭐ Đã thêm "${word}" vào Kho từ vựng!`);
            vocab.save(newItem);
        }

        vocab.closeModal();
        vocab.renderGrid();
        if (vocab.currentView === 'flashcard') {
            vocab.initDeck();
        }
    },

    deleteWord: (id) => {
        const item = vocab.items.find(i => i.id === id);
        if (!item) return;
        if (confirm(`Bạn có chắc muốn xóa từ "${item.word}"?`)) {
            vocab.items = vocab.items.filter(i => i.id !== id);
            if (db) {
                db.collection('vocab_items').doc(id).delete().catch(err => console.warn('Vocab delete cloud error:', err));
            }
            vocab.save();
            vocab.renderGrid();
            if (vocab.currentView === 'flashcard') {
                vocab.initDeck();
            }
            showToast(`Đã xóa từ "${item.word}"`);
        }
    },

    toggleStatus: (id) => {
        const item = vocab.items.find(i => i.id === id);
        if (!item) return;
        item.status = item.status === 'mastered' ? 'learning' : 'mastered';
        vocab.save(item);
        vocab.renderGrid();
    },

    speakWord: (text) => {
        const targetText = text || (vocab.flashcardDeck[vocab.flashcardIndex] ? vocab.flashcardDeck[vocab.flashcardIndex].word : '');
        if (!targetText) return;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(targetText);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        } else {
            showToast('Trình duyệt không hỗ trợ phát âm.');
        }
    },

    // --- FLASHCARD METHODS ---
    initDeck: () => {
        vocab.flashcardDeck = [...vocab.items];
        vocab.flashcardIndex = 0;
        vocab.renderFlashcard();
    },

    renderFlashcard: () => {
        const card = document.getElementById('flashcard-card');
        if (card) card.classList.remove('flipped');

        if (vocab.flashcardDeck.length === 0) {
            const frontWord = document.getElementById('fc-front-word');
            const frontPhonetic = document.getElementById('fc-front-phonetic');
            const backMeaning = document.getElementById('fc-back-meaning');
            if (frontWord) frontWord.textContent = 'Trống';
            if (frontPhonetic) frontPhonetic.textContent = '';
            if (backMeaning) backMeaning.textContent = 'Chưa có từ vựng nào trong kho.';
            document.getElementById('flashcard-counter').textContent = '0 / 0';
            document.getElementById('flashcard-progress-fill').style.width = '0%';
            return;
        }

        const item = vocab.flashcardDeck[vocab.flashcardIndex];
        const total = vocab.flashcardDeck.length;
        const current = vocab.flashcardIndex + 1;

        const tagInfo = vocab.getTagInfo(item.tag);
        document.getElementById('fc-front-tag').textContent = `${tagInfo.icon} ${tagInfo.label}`;
        document.getElementById('fc-front-word').textContent = item.word;
        document.getElementById('fc-front-phonetic').textContent = item.phonetic || '';
        document.getElementById('fc-back-tag').textContent = (item.status === 'mastered' ? '✅ Đã thuộc' : '⏳ Cần ôn');
        document.getElementById('fc-back-meaning').textContent = item.meaning;
        document.getElementById('fc-back-example').textContent = item.example ? `"${item.example}"` : 'Chưa có câu ví dụ';

        document.getElementById('flashcard-counter').textContent = `Thẻ ${current} / ${total}`;
        document.getElementById('flashcard-progress-fill').style.width = `${(current / total) * 100}%`;
    },

    flipCurrentCard: () => {
        const card = document.getElementById('flashcard-card');
        if (card) card.classList.toggle('flipped');
    },

    nextCard: () => {
        if (vocab.flashcardDeck.length === 0) return;
        vocab.flashcardIndex = (vocab.flashcardIndex + 1) % vocab.flashcardDeck.length;
        vocab.renderFlashcard();
    },

    prevCard: () => {
        if (vocab.flashcardDeck.length === 0) return;
        vocab.flashcardIndex = (vocab.flashcardIndex - 1 + vocab.flashcardDeck.length) % vocab.flashcardDeck.length;
        vocab.renderFlashcard();
    },

    markCard: (isMastered) => {
        if (vocab.flashcardDeck.length === 0) return;
        const currentItem = vocab.flashcardDeck[vocab.flashcardIndex];
        currentItem.status = isMastered ? 'mastered' : 'learning';
        
        // update in main items
        const orig = vocab.items.find(i => i.id === currentItem.id);
        if (orig) orig.status = currentItem.status;
        vocab.save(orig || currentItem);

        showToast(isMastered ? `✅ Đã đánh dấu "${currentItem.word}" là ĐÃ NHỚ!` : `⏳ Sẽ ôn lại "${currentItem.word}"!`);
        vocab.nextCard();
    },

    shuffleDeck: () => {
        if (vocab.flashcardDeck.length <= 1) return;
        for (let i = vocab.flashcardDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [vocab.flashcardDeck[i], vocab.flashcardDeck[j]] = [vocab.flashcardDeck[j], vocab.flashcardDeck[i]];
        }
        vocab.flashcardIndex = 0;
        vocab.renderFlashcard();
        showToast('🔁 Đã xáo trộn bộ thẻ Flashcard!');
    }
};

// --- FLOATING SELECTION TOOLBAR LOGIC (NOTION STYLE) ---
let lastActiveRange = null;

function initFloatingToolbar() {
    const toolbar = document.getElementById('floating-toolbar');
    const colorBtn = document.getElementById('bubble-color-btn');
    const colorDropdown = document.getElementById('bubble-color-dropdown');
    const typeBtn = document.getElementById('nft-block-type-btn');
    const typeDropdown = document.getElementById('nft-type-dropdown');
    const addVocabBtn = document.getElementById('bubble-add-vocab-btn');

    if (!toolbar) return;

    // Prevent selection from collapsing when clicking buttons in the toolbar
    toolbar.addEventListener('mousedown', (e) => {
        if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            e.preventDefault();
        }
    });

    // Formatting Buttons (Bold, Italic, Underline, etc.)
    toolbar.querySelectorAll('.bubble-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.getAttribute('data-action');
            executeFormatAction(action);
        });
    });

    // Color Dropdown Toggle
    if (colorBtn && colorDropdown) {
        colorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeDropdown) typeDropdown.style.display = 'none';
            colorDropdown.style.display = colorDropdown.style.display === 'none' ? 'flex' : 'none';
        });
    }

    // Text Colors
    toolbar.querySelectorAll('.color-dot.text-color').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const color = dot.getAttribute('data-color');
            if (color) {
                applyFormattingToSelection('foreColor', color);
                colorDropdown.style.display = 'none';
            }
        });
    });

    // Custom Text Color Input
    const customTextColorInput = document.getElementById('custom-text-color-picker');
    if (customTextColorInput) {
        customTextColorInput.addEventListener('input', (e) => {
            applyFormattingToSelection('foreColor', e.target.value);
        });
        customTextColorInput.addEventListener('change', (e) => {
            applyFormattingToSelection('foreColor', e.target.value);
            colorDropdown.style.display = 'none';
        });
    }

    // Background Highlight Colors
    toolbar.querySelectorAll('.color-dot.bg-color').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const bgcolor = dot.getAttribute('data-bgcolor');
            if (bgcolor) {
                applyFormattingToSelection('hiliteColor', bgcolor);
                colorDropdown.style.display = 'none';
            }
        });
    });

    // Custom Background Color Input
    const customBgColorInput = document.getElementById('custom-bg-color-picker');
    if (customBgColorInput) {
        customBgColorInput.addEventListener('input', (e) => {
            applyFormattingToSelection('hiliteColor', e.target.value);
        });
        customBgColorInput.addEventListener('change', (e) => {
            applyFormattingToSelection('hiliteColor', e.target.value);
            colorDropdown.style.display = 'none';
        });
    }

    // Block Type Dropdown Toggle
    if (typeBtn && typeDropdown) {
        typeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (colorDropdown) colorDropdown.style.display = 'none';
            typeDropdown.style.display = typeDropdown.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Block Type Selection
    if (typeDropdown) {
        typeDropdown.querySelectorAll('.nft-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const newType = item.getAttribute('data-type');
                typeDropdown.style.display = 'none';
                
                // Chuyển đổi hàng loạt nếu đang bôi đen nhiều dòng
                if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
                    EditorHistory.recordBeforeAction();
                    selectedBlockWrappers.forEach(w => {
                        const cid = w.getAttribute('data-id');
                        if (cid) convertBlockType(cid, newType);
                    });
                    triggerSave();
                    EditorHistory.updateLastSnapshot();
                    return;
                }

                if (activeBlockId) {
                    convertBlockType(activeBlockId, newType);
                }
            });
        });
    }

    let currentSelectedText = '';

    // 1. ADD TO VOCABULARY VAULT (+ Từ vựng)
    if (addVocabBtn) {
        addVocabBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = currentSelectedText || (window.getSelection() ? window.getSelection().toString().trim() : '');
            toolbar.style.display = 'none';
            if (text) {
                vocab.openAddModal(text);
            } else {
                showToast('Vui lòng bôi đen từ cần thêm vào kho từ vựng.');
            }
        });
    }

    // 2. WORD CASE CONVERTERS (UPPERCASE, lowercase, Title Case)
    toolbar.querySelectorAll('.nft-case-btn[data-case]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const caseType = btn.getAttribute('data-case');
            const selectedText = currentSelectedText || (window.getSelection() ? window.getSelection().toString() : '');
            if (!selectedText) return;

            let converted = selectedText;
            if (caseType === 'upper') {
                converted = selectedText.toUpperCase();
            } else if (caseType === 'lower') {
                converted = selectedText.toLowerCase();
            } else if (caseType === 'title') {
                converted = selectedText.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            }

            document.execCommand('insertText', false, converted);
            showToast('Đã đổi kiểu chữ!');
            triggerSave();
        });
    });

    // 3. INSERT LINK
    const linkBtn = document.getElementById('bubble-link-btn');
    if (linkBtn) {
        linkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = window.prompt('Nhập địa chỉ liên kết (URL):', 'https://');
            if (url && url !== 'https://') {
                document.execCommand('createLink', false, url);
                showToast('Đã gắn liên kết!');
                triggerSave();
            }
            toolbar.style.display = 'none';
        });
    }

    // 4. GOOGLE SEARCH
    const searchGoogleBtn = document.getElementById('bubble-search-google-btn');
    if (searchGoogleBtn) {
        searchGoogleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const text = currentSelectedText || (window.getSelection() ? window.getSelection().toString().trim() : '');
            if (text) {
                window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
            }
            toolbar.style.display = 'none';
        });
    }

    // Check Selection and Position Toolbar
    let selTimeout;
    const checkSelection = () => {
        clearTimeout(selTimeout);
        selTimeout = setTimeout(() => {
            const sel = window.getSelection();
            const hasBlocks = selectedBlockWrappers && selectedBlockWrappers.length > 0;
            const hasText = sel && !sel.isCollapsed && sel.rangeCount > 0 && sel.toString().trim().length > 0;

            if (!hasText && !hasBlocks) {
                toolbar.style.display = 'none';
                if (colorDropdown) colorDropdown.style.display = 'none';
                if (typeDropdown) typeDropdown.style.display = 'none';
                return;
            }

            let text = '';
            let rect = null;
            let inEditor = false;

            if (hasText) {
                text = sel.toString().trim();
                currentSelectedText = text;
                const range = sel.getRangeAt(0);
                lastActiveRange = range.cloneRange();
                let container = range.commonAncestorContainer;
                if (container && container.nodeType === Node.TEXT_NODE) container = container.parentElement;

                if (toolbar.contains(container) || (container && container.closest('#vocab-modal, #search-modal, #settings-modal'))) {
                    return;
                }

                inEditor = !!(container && container.closest('#editor-container, .page-content, .block-editor, .block-content'));
                rect = range.getBoundingClientRect();

                if (inEditor) {
                    const blockEl = container.closest('.block-wrapper');
                    if (blockEl) {
                        activeBlockId = blockEl.getAttribute('data-id');
                        activeBlockElement = blockEl;
                        const blockType = blockEl.getAttribute('data-type') || 'text';
                        updateBlockTypeBadge(blockType);
                    }
                }
            } else if (hasBlocks) {
                inEditor = true;
                const first = selectedBlockWrappers[0];
                rect = first.getBoundingClientRect();
                activeBlockId = first.getAttribute('data-id');
                activeBlockElement = first;
                const bType = first.getAttribute('data-type') || 'text';
                updateBlockTypeBadge(bType);

                let totalWords = 0;
                let totalChars = 0;
                let combinedText = [];
                selectedBlockWrappers.forEach(w => {
                    const t = w.querySelector('.block-content')?.innerText || '';
                    totalWords += t.split(/\s+/).filter(Boolean).length;
                    totalChars += t.length;
                    combinedText.push(t);
                });
                text = combinedText.join('\n').trim();
                currentSelectedText = text;
                const statsEl = document.getElementById('nft-word-char-count');
                if (statsEl) {
                    statsEl.textContent = `${selectedBlockWrappers.length} dòng • ${totalWords} từ • ${totalChars} ký tự`;
                }
            }

            if (!rect || (rect.width === 0 && rect.height === 0)) {
                toolbar.style.display = 'none';
                return;
            }

            toolbar.style.display = 'flex';
            const tbWidth = toolbar.offsetWidth || 320;
            const tbHeight = toolbar.offsetHeight || 260;

            let top = rect.top - tbHeight - 10;
            if (top < 10) {
                top = rect.bottom + 10;
            }
            if (top + tbHeight > window.innerHeight - 10) {
                top = Math.max(10, window.innerHeight - tbHeight - 10);
            }

            let left = rect.left + (rect.width / 2) - (tbWidth / 2);
            if (left < 10) left = 10;
            if (left + tbWidth > window.innerWidth - 10) {
                left = window.innerWidth - tbWidth - 10;
            }

            toolbar.style.top = `${top}px`;
            toolbar.style.left = `${left}px`;
        }, 50);
    };

    document.addEventListener('selectionchange', checkSelection);
    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('keyup', checkSelection);

    // Close dropdowns on outside click
    document.addEventListener('mousedown', (e) => {
        if (!toolbar.contains(e.target)) {
            if (colorDropdown) colorDropdown.style.display = 'none';
            if (typeDropdown) typeDropdown.style.display = 'none';
        }
    });
}

function updateBlockTypeBadge(type) {
    const labelEl = document.getElementById('nft-block-label');
    const iconEl = document.getElementById('nft-block-icon');
    if (!labelEl || !iconEl) return;

    const typeConfig = {
        text: { label: 'Text', icon: 'ri-text' },
        h1: { label: 'Heading 1', icon: 'ri-h-1' },
        h2: { label: 'Heading 2', icon: 'ri-h-2' },
        h3: { label: 'Heading 3', icon: 'ri-h-3' },
        toggle: { label: 'Toggle list', icon: 'ri-arrow-right-s-line' },
        'toggle-h1': { label: 'Toggle H1', icon: 'ri-arrow-right-s-line' },
        'toggle-h2': { label: 'Toggle H2', icon: 'ri-arrow-right-s-line' },
        'toggle-h3': { label: 'Toggle H3', icon: 'ri-arrow-right-s-line' },
        bullet: { label: 'Danh sách', icon: 'ri-list-unordered' },
        number: { label: 'Số thứ tự', icon: 'ri-list-ordered' },
        todo: { label: 'To-do', icon: 'ri-checkbox-line' },
        quote: { label: 'Trích dẫn', icon: 'ri-double-quotes-l' },
        code: { label: 'Code', icon: 'ri-code-box-line' },
        math: { label: 'Toán học', icon: 'ri-functions' },
        table: { label: 'Bảng (Table)', icon: 'ri-table-line' }
    };

    const cfg = typeConfig[type] || typeConfig.text;
    labelEl.textContent = cfg.label;
    iconEl.className = cfg.icon;
}

function getBlockTypeName(type) {
    const names = {
        text: 'Text',
        h1: 'Heading 1',
        h2: 'Heading 2',
        h3: 'Heading 3',
        toggle: 'Toggle list',
        'toggle-h1': 'Toggle Heading 1',
        'toggle-h2': 'Toggle Heading 2',
        'toggle-h3': 'Toggle Heading 3',
        bullet: 'Danh sách chấm',
        number: 'Danh sách số',
        todo: 'To-do list',
        quote: 'Trích dẫn',
        code: 'Khối code',
        divider: 'Đường kẻ',
        math: 'Công thức toán (Math)',
        table: 'Bảng (Table)'
    };
    return names[type] || (type ? type.toUpperCase() : 'Khối');
}

function convertBlockType(blockId, newType) {
    let wrapper = null;
    if (blockId) {
        wrapper = document.querySelector(`.block-wrapper[data-id="${blockId}"]`);
    }
    if (!wrapper && activeBlockElement) {
        wrapper = activeBlockElement.closest('.block-wrapper');
    }
    if (!wrapper) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            let container = sel.getRangeAt(0).commonAncestorContainer;
            if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
            wrapper = container.closest('.block-wrapper');
        }
    }
    if (!wrapper) return;
    
    const contentEl = wrapper.querySelector('.block-content');
    if (!contentEl) return;
    
    EditorHistory.recordBeforeAction();
    const oldType = wrapper.getAttribute('data-type') || '';
    const wasToggle = oldType.startsWith('toggle');
    const isNewToggle = newType.startsWith('toggle');

    setBlockType(contentEl, newType);

    // Nếu chuyển từ Toggle sang khối thường, hiển thị lại các khối con trước đó bị ẩn
    if (wasToggle && !isNewToggle) {
        let next = wrapper.nextElementSibling;
        const myIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        while (next && next.classList.contains('block-wrapper')) {
            const nextIndent = parseInt(next.getAttribute('data-indent') || '0', 10);
            if (nextIndent <= myIndent) break;
            next.style.display = 'flex';
            next = next.nextElementSibling;
        }
    }

    if (newType === 'number') {
        updateNumberPrefixes();
    }
    updateBlockTypeBadge(newType);
    triggerSave();
    EditorHistory.updateLastSnapshot();
    contentEl.focus();
    
    const typeDropdown = document.getElementById('nft-type-dropdown');
    if (typeDropdown) typeDropdown.style.display = 'none';
    
    showToast(`Đã chuyển thành ${getBlockTypeName(newType)}`);
}

// Multi-Block Selection & Line Operations System
let selectedBlockWrappers = [];

function clearBlockSelection() {
    if (selectedBlockWrappers && selectedBlockWrappers.length) {
        selectedBlockWrappers.forEach(w => w.classList.remove('is-block-selected'));
        selectedBlockWrappers = [];
    }
}

function selectSingleBlock(wrapper) {
    if (!wrapper) return;
    clearBlockSelection();
    wrapper.classList.add('is-block-selected');
    wrapper.classList.add('is-focused');
    selectedBlockWrappers = [wrapper];
    activeBlockId = wrapper.getAttribute('data-id');
    const contentEl = wrapper.querySelector('.block-content');
    activeBlockElement = contentEl || wrapper;
    // Đặt tabindex và focus để các phím Backspace, Delete, Ctrl+C, Ctrl+X hoạt động trực tiếp trên khối
    wrapper.setAttribute('tabindex', '-1');
    wrapper.focus();
}

function selectAllBlocks() {
    if (!elements.blockEditor) return;
    const wrappers = elements.blockEditor.querySelectorAll('.block-wrapper');
    if (!wrappers.length) return;
    clearBlockSelection();
    wrappers.forEach(w => w.classList.add('is-block-selected'));
    selectedBlockWrappers = Array.from(wrappers);
    showToast(`Đã chọn toàn bộ ${wrappers.length} dòng (Ctrl+C để sao chép, Backspace để xóa)`);
}

function blockToMarkdown(wrapper) {
    if (!wrapper) return '';
    const type = wrapper.getAttribute('data-type') || 'text';
    const indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
    const indentStr = '  '.repeat(indent);
    const contentEl = wrapper.querySelector('.block-content');

    if (type === 'image') {
        const img = contentEl ? (contentEl.querySelector('img.note-image') || contentEl.querySelector('img')) : null;
        const cap = contentEl ? contentEl.querySelector('.image-caption') : null;
        const src = img ? (img.getAttribute('src') || '') : '';
        const caption = cap ? (cap.innerText || cap.textContent || '').trim() : '';
        return `${indentStr}![${caption || 'Hình ảnh'}](${src})\n`;
    }

    if (type === 'math') {
        const latex = contentEl ? (contentEl.dataset.latex || '') : '';
        return `${indentStr}$$\n${latex}\n$$\n`;
    }

    const rawText = contentEl ? (contentEl.innerText !== undefined ? contentEl.innerText : (contentEl.textContent || '')) : '';
    const text = rawText.trim();

    if (type === 'h1' || type === 'toggle-h1') return `${indentStr}# ${text}\n`;
    if (type === 'h2' || type === 'toggle-h2') return `${indentStr}## ${text}\n`;
    if (type === 'h3' || type === 'toggle-h3') return `${indentStr}### ${text}\n`;
    if (type === 'bullet') return `${indentStr}- ${text}\n`;
    if (type === 'number') return `${indentStr}1. ${text}\n`;
    if (type === 'todo') {
        const isChecked = wrapper.querySelector('.todo-cb')?.checked;
        return `${indentStr}${isChecked ? '[x]' : '[ ]'} ${text}\n`;
    }
    if (type === 'quote') return `${indentStr}> ${text}\n`;
    if (type === 'code') return `${indentStr}\`\`\`\n${rawText}\n\`\`\`\n`;
    if (type === 'divider') return `${indentStr}---\n`;
    return `${indentStr}${rawText}\n`;
}

function blockToHtml(wrapper) {
    if (!wrapper) return '';
    const type = wrapper.getAttribute('data-type') || 'text';
    const contentEl = wrapper.querySelector('.block-content');
    if (type === 'image') {
        const img = contentEl ? (contentEl.querySelector('img.note-image') || contentEl.querySelector('img')) : null;
        const cap = contentEl ? contentEl.querySelector('.image-caption') : null;
        const src = img ? (img.getAttribute('src') || '') : '';
        const caption = cap ? (cap.innerText || cap.textContent || '').trim() : '';
        return `<p><img src="${src}" alt="${escapeHtml(caption)}"></p>`;
    }
    if (type === 'math') {
        const latex = contentEl ? (contentEl.dataset.latex || '') : '';
        return `<div class="math-block" data-latex="${escapeHtml(latex)}"><p>$$ ${escapeHtml(latex)} $$</p></div>`;
    }
    const html = contentEl ? contentEl.innerHTML : '';
    if (type === 'h1') return `<h1>${html}</h1>`;
    if (type === 'h2') return `<h2>${html}</h2>`;
    if (type === 'h3') return `<h3>${html}</h3>`;
    if (type === 'bullet') return `<ul><li>${html}</li></ul>`;
    if (type === 'number') return `<ol><li>${html}</li></ol>`;
    if (type === 'todo') {
        const isChecked = wrapper.querySelector('.todo-cb')?.checked;
        return `<p>[${isChecked ? 'x' : ' '}] ${html}</p>`;
    }
    if (type === 'quote') return `<blockquote>${html}</blockquote>`;
    if (type === 'code') return `<pre><code>${html}</code></pre>`;
    if (type === 'divider') return `<hr>`;
    return `<p>${html}</p>`;
}

function initMultiBlockSelection() {
    let isMouseDown = false;
    let dragStartWrapper = null;

    if (!elements.blockEditor) return;

    elements.blockEditor.addEventListener('mousedown', (e) => {
        if (e.target.closest('.block-handle') || e.target.closest('.todo-cb') || e.target.closest('.toggle-icon') || e.target.closest('.image-toolbar')) {
            return;
        }
        isMouseDown = true;
        dragStartWrapper = e.target.closest('.block-wrapper');
        if (!e.shiftKey && !e.target.closest('.is-block-selected')) {
            clearBlockSelection();
        }
    });

    elements.blockEditor.addEventListener('mousemove', (e) => {
        if (!isMouseDown || !dragStartWrapper) return;
        const currentWrapper = e.target.closest('.block-wrapper');
        if (currentWrapper && currentWrapper !== dragStartWrapper) {
            const allWrappers = Array.from(elements.blockEditor.querySelectorAll('.block-wrapper'));
            const idx1 = allWrappers.indexOf(dragStartWrapper);
            const idx2 = allWrappers.indexOf(currentWrapper);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                allWrappers.forEach((w, idx) => {
                    if (idx >= start && idx <= end) {
                        w.classList.add('is-block-selected');
                    } else {
                        w.classList.remove('is-block-selected');
                    }
                });
                selectedBlockWrappers = allWrappers.slice(start, end + 1);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        dragStartWrapper = null;
    });

    // Keyboard handlers when blocks are selected
    document.addEventListener('keydown', (e) => {
        // Arrow keys clear selection when moving cursor
        if (selectedBlockWrappers && selectedBlockWrappers.length > 0 && !e.shiftKey) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                clearBlockSelection();
            }
        }

        // Ctrl+A handling
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            const activeEl = document.activeElement;
            const inEditor = activeEl && activeEl.closest('#editor-container, .block-editor');
            if (inEditor) {
                const blockContent = activeEl.closest('.block-content');
                if (blockContent) {
                    const sel = window.getSelection();
                    const textLen = (blockContent.innerText || '').trim().length;
                    const selLen = (sel ? sel.toString() : '').trim().length;
                    if (selLen >= textLen || textLen === 0) {
                        e.preventDefault();
                        selectAllBlocks();
                        return;
                    }
                } else {
                    e.preventDefault();
                    selectAllBlocks();
                    return;
                }
            }
        }

        // Multi-block / Selected line actions
        if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
            if (e.key === 'Escape') {
                clearBlockSelection();
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                EditorHistory.recordBeforeAction();
                const lastBlock = selectedBlockWrappers[selectedBlockWrappers.length - 1];
                const indent = parseInt(lastBlock.getAttribute('data-indent') || '0', 10);
                const nextWrapper = createBlockElement('text', '', generateId(), indent);
                lastBlock.parentNode.insertBefore(nextWrapper, lastBlock.nextSibling);
                clearBlockSelection();
                const nextContent = nextWrapper.querySelector('.block-content');
                if (nextContent) nextContent.focus();
                updateNumberPrefixes();
                triggerSave();
                EditorHistory.updateLastSnapshot();
                return;
            }

            // Delete multi-block text / selected line (supports images, headings, etc.)
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                EditorHistory.recordBeforeAction();
                const firstBlock = selectedBlockWrappers[0];
                const prev = firstBlock.previousElementSibling;
                const next = selectedBlockWrappers[selectedBlockWrappers.length - 1].nextElementSibling;
                
                selectedBlockWrappers.forEach(w => w.remove());
                selectedBlockWrappers = [];
                clearBlockSelection();

                let targetToFocus = prev || next;
                if (!targetToFocus || !targetToFocus.classList.contains('block-wrapper')) {
                    targetToFocus = createBlockElement('text', '', generateId(), 0);
                    elements.blockEditor.appendChild(targetToFocus);
                }
                const nextContent = targetToFocus.querySelector('.block-content');
                if (nextContent && nextContent.contentEditable !== 'false') {
                    setCaretAtStart(nextContent);
                }
                updateNumberPrefixes();
                triggerSave();
                EditorHistory.updateLastSnapshot();
                showToast('🗑️ Đã xóa dòng được chọn');
                return;
            }
        }
    });

    // Global Copy handler: sao chép cả dòng (toàn bộ cấu trúc markdown + HTML)
    document.addEventListener('copy', (e) => {
        // 1. Nếu đang chọn khối (nhiều dòng hoặc 1 dòng qua click handle / ảnh)
        if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
            e.preventDefault();
            const mdText = selectedBlockWrappers.map(w => blockToMarkdown(w)).join('');
            const htmlText = selectedBlockWrappers.map(w => blockToHtml(w)).join('');
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', mdText);
                e.clipboardData.setData('text/html', htmlText);
            }
            showToast(`📋 Đã sao chép ${selectedBlockWrappers.length} dòng!`);
            return;
        }

        // 2. Nếu con trỏ chuột đang ở trong 1 block:
        const activeEl = document.activeElement;
        const currentWrapper = activeEl ? activeEl.closest('.block-wrapper') : null;
        if (currentWrapper && elements.blockEditor && elements.blockEditor.contains(currentWrapper)) {
            const sel = window.getSelection();
            const selText = sel ? sel.toString() : '';
            const contentEl = currentWrapper.querySelector('.block-content');
            const contentText = contentEl ? (contentEl.innerText || '').trim() : '';

            // Nếu người dùng KHÔNG bôi đen từng chữ (con trỏ chỉ nhấp nháy ở dòng đó) 
            // HOẶC toàn bộ nội dung dòng đó được bôi đen -> Copy CẢ DÒNG (cả kiểu block, ảnh, markdown)
            if (!selText || sel.isCollapsed || selText.trim() === contentText) {
                e.preventDefault();
                const mdText = blockToMarkdown(currentWrapper);
                const htmlText = blockToHtml(currentWrapper);
                if (e.clipboardData) {
                    e.clipboardData.setData('text/plain', mdText);
                    e.clipboardData.setData('text/html', htmlText);
                }
                showToast('📋 Đã sao chép cả dòng!');
                return;
            }

            // Nếu người dùng bôi đen 1 đoạn chữ: Đảm bảo giữ nguyên highlight / styling HTML
            if (sel && !sel.isCollapsed && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const container = document.createElement('div');
                container.appendChild(range.cloneContents());
                const selHtml = container.innerHTML;
                if (selHtml && (selHtml.includes('<') || selHtml.includes('style='))) {
                    e.preventDefault();
                    if (e.clipboardData) {
                        e.clipboardData.setData('text/plain', selText);
                        e.clipboardData.setData('text/html', selHtml);
                    }
                    return;
                }
            }
        }
    });

    // Global Cut handler
    document.addEventListener('cut', (e) => {
        if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
            e.preventDefault();
            EditorHistory.recordBeforeAction();
            const mdText = selectedBlockWrappers.map(w => blockToMarkdown(w)).join('');
            const htmlText = selectedBlockWrappers.map(w => blockToHtml(w)).join('');
            if (e.clipboardData) {
                e.clipboardData.setData('text/plain', mdText);
                e.clipboardData.setData('text/html', htmlText);
            }
            const firstBlock = selectedBlockWrappers[0];
            const prev = firstBlock.previousElementSibling;
            const next = selectedBlockWrappers[selectedBlockWrappers.length - 1].nextElementSibling;
            selectedBlockWrappers.forEach(w => w.remove());
            selectedBlockWrappers = [];
            clearBlockSelection();

            let targetToFocus = prev || next;
            if (!targetToFocus || !targetToFocus.classList.contains('block-wrapper')) {
                targetToFocus = createBlockElement('text', '', generateId(), 0);
                elements.blockEditor.appendChild(targetToFocus);
            }
            const nextContent = targetToFocus.querySelector('.block-content');
            if (nextContent && nextContent.contentEditable !== 'false') setCaretAtStart(nextContent);
            updateNumberPrefixes();
            triggerSave();
            EditorHistory.updateLastSnapshot();
            showToast('✂️ Đã cắt các dòng đã chọn');
            return;
        }
    });
}

function applyFormattingToSelection(formatType, value = null) {
    EditorHistory.recordBeforeAction();

    // 1. Nếu có nhiều khối dòng đang được chọn (Multi-block selection)
    if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
        selectedBlockWrappers.forEach(wrapper => {
            const contentEl = wrapper.querySelector('.block-content');
            if (!contentEl || contentEl.contentEditable === 'false') return;
            applyBlockFormat(contentEl, formatType, value);
        });
        triggerSave();
        EditorHistory.updateLastSnapshot();
        return;
    }

    // 2. Kiểm tra vùng bôi đen chữ (Text Selection)
    let sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0 || sel.isCollapsed) && lastActiveRange) {
        try {
            sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastActiveRange);
        } catch (e) {}
    }

    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // Nếu không có vùng bôi đen cụ thể nhưng đang ở một khối dòng đang hoạt động (activeBlockElement)
        if (activeBlockElement) {
            const targetEl = activeBlockElement.classList.contains('block-content') ? activeBlockElement : activeBlockElement.querySelector('.block-content');
            if (targetEl && targetEl.contentEditable !== 'false') {
                applyBlockFormat(targetEl, formatType, value);
                triggerSave();
                EditorHistory.updateLastSnapshot();
            }
        }
        return;
    }
    const range = sel.getRangeAt(0);

    // Tìm tất cả các khối block giao nhau với vùng bôi đen
    const allWrappers = Array.from(elements.blockEditor.querySelectorAll('.block-wrapper'));
    const intersectingWrappers = allWrappers.filter(w => {
        const c = w.querySelector('.block-content');
        if (!c) return false;
        try {
            return range.intersectsNode(c);
        } catch (e) {
            return false;
        }
    });

    if (intersectingWrappers.length <= 1) {
        // Bôi đen trong phạm vi 1 dòng
        applyInlineCommand(formatType, value);
    } else {
        // Bôi đen xuyên suốt NHIỀU DÒNG (Multi-line selection)
        intersectingWrappers.forEach((w, idx) => {
            const contentEl = w.querySelector('.block-content');
            if (!contentEl || contentEl.contentEditable === 'false') return;

            const subRange = document.createRange();
            try {
                if (idx === 0) {
                    subRange.setStart(range.startContainer, range.startOffset);
                    subRange.setEnd(contentEl, contentEl.childNodes.length);
                } else if (idx === intersectingWrappers.length - 1) {
                    subRange.setStart(contentEl, 0);
                    subRange.setEnd(range.endContainer, range.endOffset);
                } else {
                    subRange.selectNodeContents(contentEl);
                }

                sel.removeAllRanges();
                sel.addRange(subRange);
                applyInlineCommand(formatType, value);
            } catch (err) {
                applyBlockFormat(contentEl, formatType, value);
            }
        });

        // Đánh dấu trực quan các dòng đã được định dạng
        intersectingWrappers.forEach(w => w.classList.add('is-block-selected'));
        selectedBlockWrappers = intersectingWrappers;
    }

    triggerSave();
    EditorHistory.updateLastSnapshot();
}

function applyInlineCommand(formatType, value = null) {
    if (formatType === 'foreColor') {
        if (value === 'default') {
            document.execCommand('removeFormat', false, null);
        } else {
            document.execCommand('foreColor', false, value);
        }
    } else if (formatType === 'hiliteColor') {
        if (value === 'transparent') {
            document.execCommand('removeFormat', false, null);
        } else {
            document.execCommand('hiliteColor', false, value);
        }
    } else if (formatType === 'bold') {
        document.execCommand('bold', false, null);
    } else if (formatType === 'italic') {
        document.execCommand('italic', false, null);
    } else if (formatType === 'underline') {
        document.execCommand('underline', false, null);
    } else if (formatType === 'strikethrough') {
        document.execCommand('strikeThrough', false, null);
    } else if (formatType === 'removeFormat') {
        document.execCommand('removeFormat', false, null);
    } else if (formatType === 'code') {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
            const text = sel.toString();
            document.execCommand('insertHTML', false, `<code class="inline-code">${escapeHtml(text)}</code>`);
        }
    } else if (formatType === 'copy') {
        const sel = window.getSelection();
        if (sel) {
            navigator.clipboard.writeText(sel.toString().trim());
            showToast('Đã sao chép đoạn văn bản!');
        }
    }
}

function applyBlockFormat(contentEl, formatType, value = null) {
    if (formatType === 'foreColor') {
        if (value === 'default') {
            contentEl.style.color = '';
            contentEl.querySelectorAll('[style*="color"], font[color]').forEach(el => {
                el.style.color = '';
                if (el.tagName === 'FONT') el.removeAttribute('color');
            });
        } else {
            contentEl.style.color = value;
            contentEl.querySelectorAll('font[color]').forEach(el => el.removeAttribute('color'));
        }
    } else if (formatType === 'hiliteColor') {
        if (value === 'transparent') {
            contentEl.style.backgroundColor = '';
            contentEl.querySelectorAll('[style*="background"], mark').forEach(el => el.style.backgroundColor = '');
        } else {
            contentEl.style.backgroundColor = value;
        }
    } else if (formatType === 'bold') {
        contentEl.style.fontWeight = (contentEl.style.fontWeight === 'bold' || contentEl.style.fontWeight === '700') ? 'normal' : 'bold';
    } else if (formatType === 'italic') {
        contentEl.style.fontStyle = contentEl.style.fontStyle === 'italic' ? 'normal' : 'italic';
    } else if (formatType === 'underline') {
        contentEl.style.textDecoration = contentEl.style.textDecoration === 'underline' ? 'none' : 'underline';
    } else if (formatType === 'strikethrough') {
        contentEl.style.textDecoration = contentEl.style.textDecoration === 'line-through' ? 'none' : 'line-through';
    } else if (formatType === 'removeFormat') {
        contentEl.style.color = '';
        contentEl.style.backgroundColor = '';
        contentEl.style.fontWeight = '';
        contentEl.style.fontStyle = '';
        contentEl.style.textDecoration = '';
    }
}

function executeFormatAction(action) {
    applyFormattingToSelection(action);
}

function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- MOBILE: DRAWER, BOTTOM NAV, GESTURES ---
const MOBILE_BP = 768;
function isMobileView() { return window.innerWidth <= MOBILE_BP; }

function openMobileSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('show');
}
function closeMobileSidebar() {
    if (!isMobileView()) return;
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
}

function initMobile() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn) toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
    });
    if (overlay) overlay.addEventListener('click', closeMobileSidebar);

    // Vuốt từ mép trái để mở, vuốt sang trái trên sidebar để đóng
    let sx = 0, sy = 0, tracking = false, fromEdge = false;
    document.addEventListener('touchstart', (e) => {
        if (!isMobileView() || e.touches.length !== 1) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        fromEdge = sx < 24;
        tracking = fromEdge || sidebar.classList.contains('open');
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
        if (dy > 60) return;
        if (fromEdge && dx > 60) openMobileSidebar();
        else if (!fromEdge && dx < -60) closeMobileSidebar();
    }, { passive: true });

    // Đóng drawer khi mở Kho từ vựng hoặc tạo trang mới
    ['new-page-btn', 'sidebar-new-page-btn', 'search-btn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', closeMobileSidebar);
    });
    window.addEventListener('resize', () => {
        if (!isMobileView()) {
            sidebar.classList.remove('open');
            overlay?.classList.remove('show');
        }
    });

    // Chạm vào block → hiện tay cầm kéo (thay cho hover trên màn hình cảm ứng)
    elements.blockEditor.addEventListener('focusin', (e) => {
        elements.blockEditor.querySelectorAll('.block-wrapper.is-focused').forEach(w => w.classList.remove('is-focused'));
        e.target.closest('.block-wrapper')?.classList.add('is-focused');
    });

    initFlashcardSwipe();
}

// Flashcard: vuốt phải = Đã thuộc, vuốt trái = Cần ôn, chạm = lật
function initFlashcardSwipe() {
    const scene = document.querySelector('.flashcard-scene');
    const card = document.getElementById('flashcard-card');
    if (!scene || !card) return;
    let sx = 0, sy = 0, dx = 0, active = false, swiped = false;

    scene.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0;
        active = true; swiped = false;
        scene.style.transition = 'none';
    }, { passive: true });

    scene.addEventListener('touchmove', (e) => {
        if (!active) return;
        dx = e.touches[0].clientX - sx;
        const dy = e.touches[0].clientY - sy;
        if (Math.abs(dy) > Math.abs(dx)) return;
        scene.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
        scene.classList.toggle('swipe-right', dx > 50);
        scene.classList.toggle('swipe-left', dx < -50);
    }, { passive: true });

    scene.addEventListener('touchend', () => {
        if (!active) return;
        active = false;
        scene.style.transition = 'transform 0.25s ease';
        scene.classList.remove('swipe-left', 'swipe-right');
        if (Math.abs(dx) > 90) {
            swiped = true;
            const mastered = dx > 0;
            scene.style.transform = `translateX(${mastered ? 120 : -120}%) rotate(${mastered ? 12 : -12}deg)`;
            if (navigator.vibrate) navigator.vibrate(15);
            setTimeout(() => {
                scene.style.transition = 'none';
                scene.style.transform = '';
                vocab.markCard(mastered);
            }, 200);
        } else {
            scene.style.transform = '';
        }
    });

    // Chặn click lật thẻ sau khi vừa vuốt
    scene.addEventListener('click', (e) => {
        if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
    }, true);
}

// --- PWA: SERVICE WORKER ---
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((registration) => {
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('🚀 Đã có phiên bản cập nhật mới! Nhấn để làm mới trang.', 8000);
                        }
                    });
                }
            });
        }).catch(err => console.warn('SW register failed:', err));
    });
}

// Mở trang theo #id (dùng cho link chia sẻ và lối tắt PWA)
window.addEventListener('DOMContentLoaded', () => {
    initMobile();
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'vocab') app.showVocab();
    if (params.get('view') === 'flashcard') {
        app.showVocab();
        if (typeof vocab.switchView === 'function') vocab.switchView('flashcard');
    }
    const hashId = decodeURIComponent(location.hash.slice(1));
    if (hashId && appState.pages[hashId]) openPage(hashId);
});

// --- IMAGE MANAGEMENT & OPTIMIZATION (COMPRESSION, LIGHTBOX, MODAL, DRAG-DROP) ---
function compressImageFile(file, maxW = 1400, maxH = 1400, q = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('Tệp không phải là hình ảnh'));
        }
        // Giữ nguyên GIF động để tránh mất hoạt ảnh
        if (file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Không thể đọc tệp GIF'));
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    let width = img.width;
                    let height = img.height;
                    if (width > maxW || height > maxH) {
                        const ratio = Math.min(maxW / width, maxH / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let dataUrl = canvas.toDataURL('image/webp', q);
                    if (!dataUrl.startsWith('data:image/webp')) {
                        dataUrl = canvas.toDataURL('image/jpeg', q);
                    }
                    resolve(dataUrl);
                } catch (err) {
                    resolve(e.target.result);
                }
            };
            img.onerror = () => reject(new Error('Không thể giải mã hình ảnh'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Không thể đọc tệp'));
        reader.readAsDataURL(file);
    });
}

function renderImageBlock(contentEl, contentData) {
    let src = '';
    let caption = '';
    let width = 'fit-content';
    let align = 'center';
    let frameStyle = 'standard';

    if (contentData) {
        if (typeof contentData === 'object') {
            src = contentData.src || '';
            caption = contentData.caption || '';
            width = contentData.width || 'fit-content';
            align = contentData.align || 'center';
            frameStyle = contentData.frameStyle || 'standard';
        } else if (typeof contentData === 'string') {
            const trimmed = contentData.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    src = parsed.src || '';
                    caption = parsed.caption || '';
                    width = parsed.width || 'fit-content';
                    align = parsed.align || 'center';
                    frameStyle = parsed.frameStyle || 'standard';
                } catch (e) {
                    src = trimmed;
                }
            } else {
                const mdMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/);
                if (mdMatch) {
                    caption = mdMatch[1] || '';
                    src = mdMatch[2] || '';
                } else if (trimmed.includes('<img')) {
                    const temp = document.createElement('div');
                    temp.innerHTML = trimmed;
                    const foundImg = temp.querySelector('img');
                    if (foundImg) {
                        src = foundImg.getAttribute('src') || '';
                        caption = foundImg.getAttribute('alt') || '';
                    }
                } else {
                    src = trimmed;
                }
            }
        }
    }

    contentEl.contentEditable = false;
    contentEl.setAttribute('data-type', 'image');
    contentEl.setAttribute('data-align', align);

    const safeCaption = escapeHtml(caption);
    const safeSrc = src ? escapeHtml(src) : '';
    const isFit = (width === 'fit-content' || width === 'auto');

    contentEl.innerHTML = `<div class="image-block-container align-${align}"><div class="image-media-wrapper frame-${frameStyle} ${isFit ? 'is-fit' : ''}" data-frame="${frameStyle}" style="width: ${width};"><div class="image-resize-handle handle-left" title="Kéo để chỉnh kích thước"></div><div class="image-resize-handle handle-right" title="Kéo để chỉnh kích thước"></div><div class="image-inner-frame"><img class="note-image" src="${safeSrc}" alt="${safeCaption || 'Hình ảnh ghi chú'}" loading="lazy" /></div><div class="image-resize-badge" style="display: none;">${width}</div><div class="image-toolbar" contenteditable="false"><button type="button" class="img-btn ${isFit ? 'active' : ''}" data-action="resize-fit" title="Vừa vặn (Kích thước tự nhiên)">Vừa</button><button type="button" class="img-btn ${width === '25%' ? 'active' : ''}" data-action="resize-25" title="25% chiều rộng">25%</button><button type="button" class="img-btn ${width === '50%' ? 'active' : ''}" data-action="resize-50" title="50% chiều rộng">50%</button><button type="button" class="img-btn ${width === '75%' ? 'active' : ''}" data-action="resize-75" title="75% chiều rộng">75%</button><button type="button" class="img-btn ${width === '100%' ? 'active' : ''}" data-action="resize-100" title="100% chiều rộng">100%</button><span class="img-tb-divider"></span><button type="button" class="img-btn" data-action="toggle-frame" title="Đổi khung ảnh: Chuẩn / Bóng đổ / Bo tròn / Không viền"><i class="ri-artboard-line"></i></button><span class="img-tb-divider"></span><button type="button" class="img-btn ${align === 'left' ? 'active' : ''}" data-action="align-left" title="Căn trái"><i class="ri-align-left"></i></button><button type="button" class="img-btn ${align === 'center' || !align ? 'active' : ''}" data-action="align-center" title="Căn giữa"><i class="ri-align-center"></i></button><button type="button" class="img-btn ${align === 'right' ? 'active' : ''}" data-action="align-right" title="Căn phải"><i class="ri-align-right"></i></button><span class="img-tb-divider"></span><button type="button" class="img-btn" data-action="caption" title="Thêm/sửa chú thích"><i class="ri-chat-1-line"></i></button><button type="button" class="img-btn" data-action="zoom" title="Xem ảnh toàn màn hình"><i class="ri-zoom-in-line"></i></button><button type="button" class="img-btn" data-action="download" title="Tải ảnh về máy"><i class="ri-download-2-line"></i></button><button type="button" class="img-btn danger" data-action="delete" title="Xóa dòng ảnh"><i class="ri-delete-bin-line"></i></button></div></div><div class="image-caption" contenteditable="true" data-placeholder="Thêm chú thích ảnh...">${safeCaption}</div></div>`.trim();

    const container = contentEl.querySelector('.image-block-container');
    const mediaWrap = contentEl.querySelector('.image-media-wrapper');
    const imgEl = contentEl.querySelector('.note-image');
    const captionEl = contentEl.querySelector('.image-caption');
    const badge = contentEl.querySelector('.image-resize-badge');
    const leftHandle = contentEl.querySelector('.handle-left');
    const rightHandle = contentEl.querySelector('.handle-right');

    // Interactive Drag-to-Resize on Left & Right handles
    const setupResizeHandle = (handle, isLeft) => {
        if (!handle) return;
        const startResize = (e) => {
            e.preventDefault();
            e.stopPropagation();
            EditorHistory.recordBeforeAction();
            handle.classList.add('is-resizing');
            if (badge) {
                badge.textContent = mediaWrap.style.width || '100%';
                badge.style.display = 'block';
            }

            const startX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
            const containerWidth = container.offsetWidth || 800;
            const startMediaWidth = mediaWrap.offsetWidth;

            const onMove = (moveEvt) => {
                const clientX = moveEvt.type.startsWith('touch') ? moveEvt.touches[0].clientX : moveEvt.clientX;
                const deltaX = clientX - startX;
                const change = isLeft ? -deltaX * 2 : deltaX * 2;
                let newPx = startMediaWidth + (align === 'center' ? change : (isLeft ? -deltaX : deltaX));
                let newPercent = Math.round((newPx / containerWidth) * 100);
                if (newPercent < 20) newPercent = 20;
                if (newPercent > 100) newPercent = 100;

                mediaWrap.style.width = `${newPercent}%`;
                mediaWrap.classList.remove('is-fit');
                if (badge) {
                    badge.textContent = `${newPercent}%`;
                    badge.style.display = 'block';
                }
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-action') === `resize-${newPercent}`);
                });
            };

            const onEnd = () => {
                handle.classList.remove('is-resizing');
                if (badge) badge.style.display = 'none';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onEnd);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onEnd);
                triggerSave();
                EditorHistory.updateLastSnapshot();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove);
            document.addEventListener('touchend', onEnd);
        };

        handle.addEventListener('mousedown', startResize);
        handle.addEventListener('touchstart', startResize, { passive: false });
    };

    setupResizeHandle(leftHandle, true);
    setupResizeHandle(rightHandle, false);

    // Bấm vào ảnh hoặc vùng ảnh: Chọn toàn bộ dòng ảnh (cho phép xóa bằng Backspace/Delete hoặc copy bằng Ctrl+C)
    container.addEventListener('click', (e) => {
        if (e.target.closest('.image-toolbar') || e.target.closest('.image-caption') || e.target.closest('.image-resize-handle')) return;
        const wrapper = contentEl.closest('.block-wrapper');
        if (wrapper) {
            selectSingleBlock(wrapper);
        }
    });

    // Nhấp đúp vào ảnh: Phóng to xem chi tiết trong lightbox
    if (imgEl) {
        imgEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const curCap = captionEl ? (captionEl.innerText || captionEl.textContent || '').trim() : '';
            openImageLightbox(imgEl.src, curCap);
        });
    }

    if (captionEl) {
        if (!caption) {
            captionEl.style.display = 'none';
        }
        captionEl.addEventListener('input', () => {
            triggerSave();
        });
        captionEl.addEventListener('blur', () => {
            if (!captionEl.innerText.trim()) {
                captionEl.style.display = 'none';
            }
        });
        captionEl.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && (!captionEl.innerText || !captionEl.innerText.trim())) {
                e.preventDefault();
                const wrapper = contentEl.closest('.block-wrapper');
                if (wrapper) {
                    EditorHistory.recordBeforeAction();
                    const prev = wrapper.previousElementSibling || wrapper.nextElementSibling;
                    wrapper.remove();
                    clearBlockSelection();
                    if (prev) {
                        const targetContent = prev.querySelector('.block-content');
                        if (targetContent && targetContent.contentEditable !== 'false') setCaretAtStart(targetContent);
                    } else {
                        focusFirstBlockOrCreate();
                    }
                    updateNumberPrefixes();
                    triggerSave();
                    EditorHistory.updateLastSnapshot();
                    showToast('🗑️ Đã xóa dòng ảnh');
                }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                EditorHistory.recordBeforeAction();
                const wrapper = contentEl.closest('.block-wrapper');
                const nextWrapper = createBlockElement('text', '', generateId(), parseInt(wrapper.getAttribute('data-indent') || '0', 10));
                wrapper.parentNode.insertBefore(nextWrapper, wrapper.nextSibling);
                const nextContent = nextWrapper.querySelector('.block-content');
                if (nextContent) nextContent.focus();
                triggerSave();
                EditorHistory.updateLastSnapshot();
            }
        });
    }

    contentEl.querySelectorAll('.img-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            if (action === 'resize-fit') {
                EditorHistory.recordBeforeAction();
                mediaWrap.style.width = 'fit-content';
                mediaWrap.classList.add('is-fit');
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
                showToast('📐 Kích thước tự nhiên (Vừa vặn)');
            } else if (action === 'resize-25') {
                EditorHistory.recordBeforeAction();
                mediaWrap.style.width = '25%';
                mediaWrap.classList.remove('is-fit');
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'resize-50') {
                EditorHistory.recordBeforeAction();
                mediaWrap.style.width = '50%';
                mediaWrap.classList.remove('is-fit');
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'resize-75') {
                EditorHistory.recordBeforeAction();
                mediaWrap.style.width = '75%';
                mediaWrap.classList.remove('is-fit');
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'resize-100') {
                EditorHistory.recordBeforeAction();
                mediaWrap.style.width = '100%';
                mediaWrap.classList.remove('is-fit');
                contentEl.querySelectorAll('[data-action^="resize-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'toggle-frame') {
                EditorHistory.recordBeforeAction();
                const frameStyles = ['standard', 'shadow', 'rounded', 'clean'];
                const curFrame = mediaWrap.getAttribute('data-frame') || 'standard';
                const nextIdx = (frameStyles.indexOf(curFrame) + 1) % frameStyles.length;
                const newFrame = frameStyles[nextIdx];
                frameStyles.forEach(f => mediaWrap.classList.remove(`frame-${f}`));
                mediaWrap.classList.add(`frame-${newFrame}`);
                mediaWrap.setAttribute('data-frame', newFrame);
                triggerSave();
                EditorHistory.updateLastSnapshot();
                const frameLabels = { standard: 'Chuẩn (Viền nhẹ)', shadow: 'Bóng đổ nổi', rounded: 'Bo tròn lớn', clean: 'Không viền' };
                showToast(`🖼️ Khung: ${frameLabels[newFrame]}`);
            } else if (action === 'align-left') {
                EditorHistory.recordBeforeAction();
                container.className = 'image-block-container align-left';
                contentEl.setAttribute('data-align', 'left');
                contentEl.querySelectorAll('[data-action^="align-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'align-center') {
                EditorHistory.recordBeforeAction();
                container.className = 'image-block-container align-center';
                contentEl.setAttribute('data-align', 'center');
                contentEl.querySelectorAll('[data-action^="align-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'align-right') {
                EditorHistory.recordBeforeAction();
                container.className = 'image-block-container align-right';
                contentEl.setAttribute('data-align', 'right');
                contentEl.querySelectorAll('[data-action^="align-"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                triggerSave();
                EditorHistory.updateLastSnapshot();
            } else if (action === 'caption') {
                captionEl.style.display = 'block';
                captionEl.focus();
            } else if (action === 'zoom') {
                const curCap = captionEl ? (captionEl.innerText || captionEl.textContent || '').trim() : '';
                openImageLightbox(imgEl.src, curCap);
            } else if (action === 'download') {
                const curCap = captionEl ? (captionEl.innerText || captionEl.textContent || '').trim() : '';
                downloadImage(imgEl.src, curCap || 'note-image');
            } else if (action === 'delete') {
                const wrapper = contentEl.closest('.block-wrapper');
                if (wrapper) {
                    EditorHistory.recordBeforeAction();
                    const prev = wrapper.previousElementSibling || wrapper.nextElementSibling;
                    wrapper.remove();
                    clearBlockSelection();
                    if (prev) {
                        const targetContent = prev.querySelector('.block-content');
                        if (targetContent && targetContent.contentEditable !== 'false') targetContent.focus();
                    } else {
                        focusFirstBlockOrCreate();
                    }
                    updateNumberPrefixes();
                    triggerSave();
                    EditorHistory.updateLastSnapshot();
                    showToast('🗑️ Đã xóa hình ảnh');
                }
            }
        });
    });
}

function insertImageFromFile(file, targetWrapper = null) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('⚠️ Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF)!');
        return;
    }

    showToast('⏳ Đang tối ưu hóa dung lượng ảnh...');

    compressImageFile(file).then(dataUrl => {
        EditorHistory.recordBeforeAction();
        let wrapper = targetWrapper;
        if (!wrapper && activeBlockElement) {
            wrapper = activeBlockElement.closest('.block-wrapper');
        }

        const indent = wrapper ? parseInt(wrapper.getAttribute('data-indent') || '0', 10) : 0;
        const imgBlock = createBlockElement('image', JSON.stringify({
            src: dataUrl,
            caption: '',
            width: 'fit-content',
            align: 'center',
            frameStyle: 'standard'
        }), generateId(), indent);

        if (wrapper && wrapper.parentNode) {
            const contentEl = wrapper.querySelector('.block-content');
            const isBlank = contentEl && (!contentEl.innerText || !contentEl.innerText.trim());
            if (isBlank) {
                wrapper.parentNode.replaceChild(imgBlock, wrapper);
            } else {
                wrapper.parentNode.insertBefore(imgBlock, wrapper.nextSibling);
            }
        } else {
            elements.blockEditor.appendChild(imgBlock);
        }

        selectSingleBlock(imgBlock);
        updateNumberPrefixes();
        triggerSave();
        EditorHistory.updateLastSnapshot();
        showToast('🖼️ Đã chèn ảnh thành công!');
    }).catch(err => {
        console.error('Lỗi chèn ảnh:', err);
        showToast('❌ Không thể xử lý ảnh: ' + (err.message || 'Lỗi'));
    });
}

function openImageLightbox(src, caption = '') {
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-image');
    const capEl = document.getElementById('lightbox-caption');
    const zoomBtn = document.getElementById('lightbox-zoom-toggle-btn');
    if (!modal || !img) return;

    img.src = src;
    img.classList.remove('is-zoomed');
    if (capEl) capEl.textContent = caption || '';
    if (zoomBtn) zoomBtn.innerHTML = '<i class="ri-zoom-in-line"></i>';

    modal.style.display = 'flex';
}

function closeImageLightbox() {
    const modal = document.getElementById('image-lightbox-modal');
    if (modal) {
        modal.style.display = 'none';
        const img = document.getElementById('lightbox-image');
        if (img) {
            img.src = '';
            img.classList.remove('is-zoomed');
        }
    }
}

function downloadImage(src, filename = 'note-image') {
    if (!src) return;
    const cleanName = (filename.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'note-image') + '.webp';
    const a = document.createElement('a');
    a.href = src;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
}

function initImageLightbox() {
    const modal = document.getElementById('image-lightbox-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('lightbox-close-btn');
    const backdrop = modal.querySelector('.lightbox-backdrop');
    const zoomBtn = document.getElementById('lightbox-zoom-toggle-btn');
    const downloadBtn = document.getElementById('lightbox-download-btn');
    const img = document.getElementById('lightbox-image');

    if (closeBtn) closeBtn.onclick = closeImageLightbox;
    if (backdrop) backdrop.onclick = closeImageLightbox;

    if (zoomBtn && img) {
        zoomBtn.onclick = () => {
            const isZoomed = img.classList.toggle('is-zoomed');
            zoomBtn.innerHTML = isZoomed ? '<i class="ri-zoom-out-line"></i>' : '<i class="ri-zoom-in-line"></i>';
        };
        img.onclick = () => {
            const isZoomed = img.classList.toggle('is-zoomed');
            if (zoomBtn) {
                zoomBtn.innerHTML = isZoomed ? '<i class="ri-zoom-out-line"></i>' : '<i class="ri-zoom-in-line"></i>';
            }
        };
    }

    if (downloadBtn && img) {
        downloadBtn.onclick = () => {
            const cap = document.getElementById('lightbox-caption')?.textContent || 'image';
            downloadImage(img.src, cap);
        };
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeImageLightbox();
        }
    });
}

let imageModalTargetWrapper = null;

function openImageModalForTarget(targetWrapper = null) {
    imageModalTargetWrapper = targetWrapper;
    const modal = document.getElementById('image-modal');
    if (!modal) return;

    const urlInput = document.getElementById('image-modal-url-input');
    if (urlInput) urlInput.value = '';

    switchImageModalTab('upload');
    modal.style.display = 'flex';
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) modal.style.display = 'none';
    imageModalTargetWrapper = null;
}

function switchImageModalTab(tabName) {
    const tabs = ['upload', 'link', 'camera'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-img-${t}-btn`);
        const panel = document.getElementById(`panel-img-${t}`);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (panel) panel.style.display = (t === tabName) ? 'block' : 'none';
    });
    if (tabName === 'link') {
        const urlInput = document.getElementById('image-modal-url-input');
        if (urlInput) setTimeout(() => urlInput.focus(), 60);
    }
}

function applyImageToTarget(src, caption = '') {
    if (!src) return;
    EditorHistory.recordBeforeAction();
    const wrapper = imageModalTargetWrapper;
    const indent = wrapper ? parseInt(wrapper.getAttribute('data-indent') || '0', 10) : 0;

    const imgBlock = createBlockElement('image', JSON.stringify({
        src: src,
        caption: caption,
        width: 'fit-content',
        align: 'center',
        frameStyle: 'standard'
    }), generateId(), indent);

    if (wrapper && wrapper.parentNode) {
        const contentEl = wrapper.querySelector('.block-content');
        const isBlank = contentEl && (!contentEl.innerText || !contentEl.innerText.trim());
        if (isBlank) {
            wrapper.parentNode.replaceChild(imgBlock, wrapper);
        } else {
            wrapper.parentNode.insertBefore(imgBlock, wrapper.nextSibling);
        }
    } else {
        elements.blockEditor.appendChild(imgBlock);
    }

    selectSingleBlock(imgBlock);
    closeImageModal();
    updateNumberPrefixes();
    triggerSave();
    EditorHistory.updateLastSnapshot();
    showToast('🖼️ Đã chèn ảnh thành công!');
}

function handleModalImageFile(file) {
    if (!file) return;
    closeImageModal();
    insertImageFromFile(file, imageModalTargetWrapper);
}

function initImageModal() {
    const modal = document.getElementById('image-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('image-modal-close-btn');
    if (closeBtn) closeBtn.onclick = closeImageModal;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeImageModal();
    });

    document.querySelectorAll('.img-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            if (tab) switchImageModalTab(tab);
        });
    });

    const dropzone = document.getElementById('image-upload-dropzone');
    const fileInput = document.getElementById('image-modal-file-input');
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleModalImageFile(file);
            e.target.value = '';
        });

        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleModalImageFile(file);
        });
    }

    const urlInput = document.getElementById('image-modal-url-input');
    const submitLinkBtn = document.getElementById('image-modal-submit-link-btn');
    const cancelLinkBtn = document.getElementById('image-modal-cancel-link-btn');

    if (cancelLinkBtn) cancelLinkBtn.onclick = closeImageModal;

    const submitUrl = () => {
        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) {
            showToast('⚠️ Vui lòng nhập đường dẫn hình ảnh hợp lệ!');
            return;
        }
        applyImageToTarget(url, '');
    };

    if (submitLinkBtn) submitLinkBtn.onclick = submitUrl;
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitUrl();
            }
        });
    }

    const cameraTriggerBtn = document.getElementById('image-camera-trigger-btn');
    const cameraInput = document.getElementById('image-camera-input');
    if (cameraTriggerBtn && cameraInput) {
        cameraTriggerBtn.onclick = () => cameraInput.click();
        cameraInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleModalImageFile(file);
            e.target.value = '';
        });
    }
}

function initEditorDragDrop() {
    const editorScroll = document.querySelector('.editor-scroll-area') || document.getElementById('editor-container');
    if (!editorScroll) return;

    let dragTimer;

    ['dragenter', 'dragover'].forEach(eventName => {
        editorScroll.addEventListener(eventName, (e) => {
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
                e.preventDefault();
                editorScroll.classList.add('is-dragging-file');
                clearTimeout(dragTimer);
            }
        });
    });

    editorScroll.addEventListener('dragleave', (e) => {
        dragTimer = setTimeout(() => {
            editorScroll.classList.remove('is-dragging-file');
        }, 80);
    });

    editorScroll.addEventListener('drop', (e) => {
        editorScroll.classList.remove('is-dragging-file');
        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (!files || files.length === 0) return;

        let imageFile = null;
        for (let i = 0; i < files.length; i++) {
            if (files[i].type && files[i].type.startsWith('image/')) {
                imageFile = files[i];
                break;
            }
        }

        if (imageFile) {
            e.preventDefault();
            e.stopPropagation();
            const dropElem = document.elementFromPoint(e.clientX, e.clientY);
            const targetWrapper = dropElem ? dropElem.closest('.block-wrapper') : null;
            insertImageFromFile(imageFile, targetWrapper);
        }
    });
}

window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.openImageModalForTarget = openImageModalForTarget;
window.closeImageModal = closeImageModal;

// ==========================================================================
// MATH EQUATION MODULE (KaTeX / LaTeX) - Notion Style
// ==========================================================================

function sanitizeLatexForKatex(latex) {
    if (!latex) return '';
    let res = latex.trim();
    // Strip accidental outer $$ or \[ \] if present
    res = res.replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '');
    res = res.replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
    res = res.replace(/^\$\s*/, '').replace(/\s*\$$/, '');
    
    // Auto-escape solitary & if not in a table / array / matrix / align environment and not already escaped
    const hasEnvironment = /\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|align|alignat|gather|cases)\}/.test(res);
    if (!hasEnvironment) {
        res = res.replace(/(?<!\\)&/g, '\\&');
    }
    return res;
}

function renderMathBlock(contentEl, initialFormula = '') {
    contentEl.contentEditable = false;
    contentEl.setAttribute('data-type', 'math');
    
    let formula = (typeof initialFormula === 'string' ? initialFormula : '').trim();
    // Clean outer delimiters
    formula = formula.replace(/^\\\[\s*/, '').replace(/\s*\\\]$/, '')
                     .replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '');
    contentEl.dataset.latex = formula;

    contentEl.innerHTML = `
        <div class="math-block-container" contenteditable="false">
            <div class="math-render-area" title="Nhấp hoặc bấm Sửa để chỉnh sửa công thức"></div>
            <div class="math-toolbar" contenteditable="false">
                <button type="button" class="math-btn" data-action="edit" title="Chỉnh sửa công thức (LaTeX)"><i class="ri-edit-line"></i> Sửa</button>
                <button type="button" class="math-btn" data-action="copy" title="Sao chép mã LaTeX"><i class="ri-file-copy-line"></i> Copy TeX</button>
                <button type="button" class="math-btn danger" data-action="delete" title="Xóa khối công thức"><i class="ri-delete-bin-line"></i></button>
            </div>
            <div class="math-editor-panel" style="display: none;">
                <div class="math-editor-header">
                    <span><i class="ri-functions"></i> Công thức toán học (LaTeX / KaTeX)</span>
                    <button type="button" class="math-close-btn" data-action="close" title="Đóng">&times;</button>
                </div>
                <div class="math-quick-symbols">
                    <button type="button" class="math-sym-btn" data-latex="\\frac{a}{b}" title="Phân số">a/b</button>
                    <button type="button" class="math-sym-btn" data-latex="\\sqrt{x}" title="Căn bậc 2">√x</button>
                    <button type="button" class="math-sym-btn" data-latex="^{2}" title="Số mũ">x²</button>
                    <button type="button" class="math-sym-btn" data-latex="_{1}" title="Chỉ số dưới">x₁</button>
                    <button type="button" class="math-sym-btn" data-latex="\\neq" title="Khác (≠)">≠</button>
                    <button type="button" class="math-sym-btn" data-latex="\\implies" title="Suy ra (⟹)">⟹</button>
                    <button type="button" class="math-sym-btn" data-latex="\\times" title="Nhân (×)">×</button>
                    <button type="button" class="math-sym-btn" data-latex="\\pm" title="Cộng trừ (±)">±</button>
                    <button type="button" class="math-sym-btn" data-latex="\\text{chữ}" title="Chữ tiếng Việt / Text">\\text{chữ}</button>
                    <button type="button" class="math-sym-btn" data-latex="\\begin{array}{rll}& 0000\\ 0101b & (\\text{Lỗi A}) \\\\\\ & 0000\\ 1000b & (\\text{Mask 0x08}) \\\\\\ \\hline = & 0000\\ 0000b \\implies \\mathbf{0} & (\\text{Kết quả})\\end{array}" title="Phép tính AND bit / Ma trận">Bảng tính dọc</button>
                    <button type="button" class="math-sym-btn" data-latex="\\hline" title="Gạch ngang">\\hline</button>
                    <button type="button" class="math-sym-btn" data-latex="\\mathbf{0}" title="In đậm">\\mathbf{0}</button>
                </div>
                <textarea class="math-latex-input" placeholder="Nhập công thức LaTeX (ví dụ: \\text{Điều kiện khớp} = (A \\& B) \\neq 0)..." rows="3"></textarea>
                <div class="math-preview-label">Xem trước trực tiếp:</div>
                <div class="math-preview-box"></div>
                <div class="math-editor-actions">
                    <span class="math-tip">Mẹo: Nhấn Ctrl+Enter để lưu nhanh</span>
                    <div class="math-action-btns">
                        <button type="button" class="math-act-btn secondary" data-action="cancel">Hủy</button>
                        <button type="button" class="math-act-btn primary" data-action="save">Hoàn tất</button>
                    </div>
                </div>
            </div>
        </div>
    `.trim();

    const renderArea = contentEl.querySelector('.math-render-area');
    const editorPanel = contentEl.querySelector('.math-editor-panel');
    const textarea = contentEl.querySelector('.math-latex-input');
    const previewBox = contentEl.querySelector('.math-preview-box');
    const wrapper = contentEl.closest('.block-wrapper');

    function renderDisplayFormula(rawTex) {
        const tex = sanitizeLatexForKatex(rawTex);
        if (!tex) {
            renderArea.innerHTML = `<div class="math-placeholder"><i class="ri-functions"></i><span>Nhấp để nhập công thức toán (LaTeX / KaTeX)...</span></div>`;
            return;
        }

        if (typeof window.katex !== 'undefined') {
            try {
                katex.render(tex, renderArea, {
                    displayMode: true,
                    throwOnError: false,
                    trust: true
                });
            } catch (err) {
                renderArea.innerHTML = `<div class="math-error">Lỗi KaTeX: ${escapeHtml(err.message)}</div>`;
            }
        } else {
            renderArea.innerHTML = `<div class="math-fallback">$$\n${escapeHtml(tex)}\n$$</div>`;
        }
    }

    function renderPreviewFormula(rawTex) {
        const tex = sanitizeLatexForKatex(rawTex);
        if (!tex) {
            previewBox.innerHTML = `<span style="color: var(--text-placeholder); font-size: 13px; font-style: italic;">Chưa có công thức</span>`;
            return;
        }
        if (typeof window.katex !== 'undefined') {
            try {
                katex.render(tex, previewBox, {
                    displayMode: true,
                    throwOnError: false,
                    trust: true
                });
            } catch (err) {
                previewBox.innerHTML = `<div class="math-error" style="font-size: 11px;">${escapeHtml(err.message)}</div>`;
            }
        } else {
            previewBox.textContent = tex;
        }
    }

    function openEditor() {
        editorPanel.style.display = 'block';
        textarea.value = contentEl.dataset.latex || '';
        renderPreviewFormula(textarea.value);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }, 50);
    }

    function closeEditor() {
        editorPanel.style.display = 'none';
    }

    function saveFormula() {
        const newTex = sanitizeLatexForKatex(textarea.value);
        contentEl.dataset.latex = newTex;
        renderDisplayFormula(newTex);
        closeEditor();
        triggerSave();
        EditorHistory.updateLastSnapshot();
    }

    // Initial render
    renderDisplayFormula(formula);

    // Event listeners
    renderArea.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor();
    });

    contentEl.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor();
    });

    contentEl.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
        e.stopPropagation();
        const curTex = contentEl.dataset.latex || '';
        if (navigator.clipboard && curTex) {
            navigator.clipboard.writeText(curTex).then(() => {
                showToast('📋 Đã sao chép mã LaTeX vào clipboard!');
            });
        }
    });

    contentEl.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        EditorHistory.recordBeforeAction();
        if (wrapper) wrapper.remove();
        updateNumberPrefixes();
        triggerSave();
        EditorHistory.updateLastSnapshot();
        showToast('🗑️ Đã xóa khối công thức');
    });

    contentEl.querySelector('[data-action="close"]').addEventListener('click', (e) => {
        e.stopPropagation();
        closeEditor();
    });

    contentEl.querySelector('[data-action="cancel"]').addEventListener('click', (e) => {
        e.stopPropagation();
        closeEditor();
    });

    contentEl.querySelector('[data-action="save"]').addEventListener('click', (e) => {
        e.stopPropagation();
        saveFormula();
    });

    textarea.addEventListener('input', () => {
        renderPreviewFormula(textarea.value);
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveFormula();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeEditor();
        }
    });

    // Quick symbol buttons insertion
    contentEl.querySelectorAll('.math-sym-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const symbol = btn.getAttribute('data-latex') || '';
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const current = textarea.value;
            textarea.value = current.substring(0, start) + symbol + current.substring(end);
            textarea.focus();
            const newCursor = start + symbol.length;
            textarea.setSelectionRange(newCursor, newCursor);
            renderPreviewFormula(textarea.value);
        });
    });
}

function renderTableBlock(contentEl, initialContent = '') {
    contentEl.contentEditable = false;
    contentEl.setAttribute('data-type', 'table');

    let tableData = {
        hasHeader: true,
        rows: [
            ['Tiêu đề 1', 'Tiêu đề 2', 'Tiêu đề 3'],
            ['', '', ''],
            ['', '', '']
        ]
    };

    if (initialContent) {
        if (typeof initialContent === 'object' && initialContent.rows) {
            tableData = initialContent;
        } else if (typeof initialContent === 'string' && initialContent.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(initialContent);
                if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
                    tableData = parsed;
                }
            } catch (e) {}
        }
    }

    if (!Array.isArray(tableData.rows) || tableData.rows.length === 0) {
        tableData.rows = [
            ['Tiêu đề 1', 'Tiêu đề 2', 'Tiêu đề 3'],
            ['', '', ''],
            ['', '', '']
        ];
    }

    const maxCols = Math.max(...tableData.rows.map(r => Array.isArray(r) ? r.length : 0), 1);
    tableData.rows.forEach(r => {
        while (r.length < maxCols) r.push('');
    });

    const container = document.createElement('div');
    container.className = 'table-block-container';
    container.contentEditable = 'false';

    container.innerHTML = `
        <div class="table-floating-toolbar" contenteditable="false">
            <button type="button" class="tbl-btn ${tableData.hasHeader ? 'active' : ''}" data-action="toggle-header" title="Bật/Tắt dòng tiêu đề">
                <i class="ri-heading"></i> <span>Tiêu đề</span>
            </button>
            <div class="tbl-divider"></div>
            <button type="button" class="tbl-btn" data-action="add-row" title="Thêm dòng bên dưới ô đang chọn (Hoặc phím Enter / Tab)">
                <i class="ri-insert-row-bottom"></i> <span>+ Dòng</span>
            </button>
            <button type="button" class="tbl-btn" data-action="add-col" title="Thêm cột bên phải ô đang chọn">
                <i class="ri-insert-column-right"></i> <span>+ Cột</span>
            </button>
            <button type="button" class="tbl-btn" data-action="del-row" title="Xóa dòng hiện tại">
                <i class="ri-delete-row"></i> <span>- Dòng</span>
            </button>
            <button type="button" class="tbl-btn" data-action="del-col" title="Xóa cột hiện tại">
                <i class="ri-delete-column"></i> <span>- Cột</span>
            </button>
            <div class="tbl-divider"></div>
            <button type="button" class="tbl-btn" data-action="copy-md" title="Sao chép dưới dạng Markdown table">
                <i class="ri-file-copy-line"></i>
            </button>
            <button type="button" class="tbl-btn danger" data-action="delete" title="Xóa toàn bộ bảng">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
        <div class="table-main-wrapper">
            <div class="table-scroll-wrapper">
                <table class="notion-table ${tableData.hasHeader ? 'has-header' : ''}">
                    <tbody></tbody>
                </table>
            </div>
            <button type="button" class="table-add-col-btn" data-action="add-col-direct" title="Thêm cột mới">+</button>
        </div>
        <div class="table-bottom-bar">
            <button type="button" class="table-add-row-btn" data-action="add-row-direct" title="Thêm dòng mới (Phím tắt: Tab hoặc Enter)">
                <i class="ri-add-line"></i> <span>Thêm dòng</span>
            </button>
            <span class="table-hint-text">Mẹo: Bấm <kbd>Tab</kbd> hoặc <kbd>Enter</kbd> để thêm nhanh dòng mới</span>
        </div>
    `;

    const tbody = container.querySelector('tbody');
    const tableEl = container.querySelector('table');
    let activeCell = null;

    function syncDataFromDom() {
        const rows = [];
        tbody.querySelectorAll('tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('th, td').forEach(cell => {
                rowData.push(cell.innerHTML.trim());
            });
            if (rowData.length > 0) rows.push(rowData);
        });
        tableData.rows = rows;
    }

    function renderRows() {
        tbody.innerHTML = '';
        tableData.rows.forEach((row, rIdx) => {
            const tr = document.createElement('tr');
            row.forEach((cellVal, cIdx) => {
                const isHeader = tableData.hasHeader && rIdx === 0;
                const cell = document.createElement(isHeader ? 'th' : 'td');
                cell.contentEditable = 'true';
                cell.setAttribute('data-placeholder', isHeader ? `Tiêu đề ${cIdx + 1}` : 'Nội dung...');
                cell.innerHTML = cellVal || '';

                cell.addEventListener('focus', () => {
                    activeCell = cell;
                });

                cell.addEventListener('input', () => {
                    triggerSave();
                });

                cell.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const allCells = Array.from(tbody.querySelectorAll('th, td'));
                        const curIdx = allCells.indexOf(cell);
                        if (!e.shiftKey) {
                            if (curIdx < allCells.length - 1) {
                                allCells[curIdx + 1].focus();
                            } else {
                                addRow();
                                const updatedCells = Array.from(tbody.querySelectorAll('th, td'));
                                if (updatedCells[curIdx + 1]) {
                                    updatedCells[curIdx + 1].focus();
                                }
                            }
                        } else {
                            if (curIdx > 0) {
                                allCells[curIdx - 1].focus();
                            }
                        }
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const trEl = cell.parentElement;
                        const cellIdx = Array.from(trEl.children).indexOf(cell);
                        const nextTr = trEl.nextElementSibling;
                        if (nextTr && nextTr.children[cellIdx]) {
                            nextTr.children[cellIdx].focus();
                        } else {
                            addRow();
                            const newNextTr = trEl.nextElementSibling;
                            if (newNextTr && newNextTr.children[cellIdx]) {
                                newNextTr.children[cellIdx].focus();
                            }
                        }
                    }
                });

                tr.appendChild(cell);
            });
            tbody.appendChild(tr);
        });
    }

    function addRow() {
        syncDataFromDom();
        const numCols = tableData.rows[0] ? tableData.rows[0].length : 3;
        const newRow = new Array(numCols).fill('');
        let insertIndex = tableData.rows.length;
        if (activeCell) {
            const curTr = activeCell.parentElement;
            const curIdx = Array.from(tbody.children).indexOf(curTr);
            if (curIdx >= 0) insertIndex = curIdx + 1;
        }
        tableData.rows.splice(insertIndex, 0, newRow);
        renderRows();
        triggerSave();
        const trs = tbody.children;
        if (trs[insertIndex] && trs[insertIndex].children[0]) {
            trs[insertIndex].children[0].focus();
        }
    }

    function addCol() {
        syncDataFromDom();
        let insertColIdx = tableData.rows[0] ? tableData.rows[0].length : 1;
        if (activeCell) {
            const curTr = activeCell.parentElement;
            insertColIdx = Array.from(curTr.children).indexOf(activeCell) + 1;
        }
        tableData.rows.forEach(r => r.splice(insertColIdx, 0, ''));
        renderRows();
        triggerSave();
    }

    function delRow() {
        syncDataFromDom();
        if (tableData.rows.length <= 1) {
            showToast('Bảng cần có ít nhất 1 dòng.');
            return;
        }
        let targetRowIdx = tableData.rows.length - 1;
        if (activeCell) {
            const curTr = activeCell.parentElement;
            targetRowIdx = Array.from(tbody.children).indexOf(curTr);
        }
        tableData.rows.splice(targetRowIdx, 1);
        renderRows();
        triggerSave();
    }

    function delCol() {
        syncDataFromDom();
        const currentCols = tableData.rows[0] ? tableData.rows[0].length : 1;
        if (currentCols <= 1) {
            showToast('Bảng cần có ít nhất 1 cột.');
            return;
        }
        let targetColIdx = currentCols - 1;
        if (activeCell) {
            const curTr = activeCell.parentElement;
            targetColIdx = Array.from(curTr.children).indexOf(activeCell);
        }
        tableData.rows.forEach(r => r.splice(targetColIdx, 1));
        renderRows();
        triggerSave();
    }

    function toggleHeader() {
        syncDataFromDom();
        tableData.hasHeader = !tableData.hasHeader;
        tableEl.classList.toggle('has-header', tableData.hasHeader);
        const headerBtn = container.querySelector('[data-action="toggle-header"]');
        if (headerBtn) headerBtn.classList.toggle('active', tableData.hasHeader);
        renderRows();
        triggerSave();
    }

    function copyMarkdown() {
        syncDataFromDom();
        if (tableData.rows.length === 0) return;
        const numCols = tableData.rows[0].length;
        let md = '';
        const headerRow = tableData.rows[0];
        md += '| ' + headerRow.map(c => c.replace(/<[^>]*>/g, '').trim()).join(' | ') + ' |\n';
        md += '| ' + new Array(numCols).fill('---').join(' | ') + ' |\n';
        for (let i = 1; i < tableData.rows.length; i++) {
            md += '| ' + tableData.rows[i].map(c => c.replace(/<[^>]*>/g, '').trim()).join(' | ') + ' |\n';
        }
        if (navigator.clipboard) {
            navigator.clipboard.writeText(md).then(() => {
                showToast('📋 Đã sao chép bảng dưới dạng Markdown!');
            }).catch(() => {
                showToast('Không thể sao chép vào bộ nhớ tạm.');
            });
        }
    }

    function deleteTable() {
        const wrapper = contentEl.closest('.block-wrapper');
        if (wrapper && confirm('Bạn có chắc muốn xóa bảng này không?')) {
            wrapper.remove();
            triggerSave();
        }
    }

    container.querySelector('[data-action="toggle-header"]').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHeader();
    });
    container.querySelector('[data-action="add-row"]').addEventListener('click', (e) => {
        e.stopPropagation();
        addRow();
    });
    container.querySelector('[data-action="add-col"]').addEventListener('click', (e) => {
        e.stopPropagation();
        addCol();
    });
    container.querySelector('[data-action="del-row"]').addEventListener('click', (e) => {
        e.stopPropagation();
        delRow();
    });
    container.querySelector('[data-action="del-col"]').addEventListener('click', (e) => {
        e.stopPropagation();
        delCol();
    });
    container.querySelector('[data-action="copy-md"]').addEventListener('click', (e) => {
        e.stopPropagation();
        copyMarkdown();
    });
    container.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTable();
    });

    const addColDirectBtn = container.querySelector('[data-action="add-col-direct"]');
    if (addColDirectBtn) {
        addColDirectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addCol();
        });
    }

    const addRowDirectBtn = container.querySelector('[data-action="add-row-direct"]');
    if (addRowDirectBtn) {
        addRowDirectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addRow();
        });
    }

    renderRows();
    contentEl.innerHTML = '';
    contentEl.appendChild(container);
}

window.renderTableBlock = renderTableBlock;
window.renderMathBlock = renderMathBlock;
window.sanitizeLatexForKatex = sanitizeLatexForKatex;

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

window.vocab = vocab;
window.openPage = openPage;
window.app = app;
window.closeMobileSidebar = closeMobileSidebar;
window.openMobileSidebar = openMobileSidebar;


