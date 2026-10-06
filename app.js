// --- CONFIG & STATE ---
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
if (typeof window.USE_FIREBASE !== 'undefined' && window.USE_FIREBASE) {
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
    db = firebase.firestore();
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
    });
    
    // Settings Save
    document.getElementById('setting-workspace-name').addEventListener('input', (e) => {
        const newName = e.target.value;
        localStorage.setItem('schooldb_workspace', newName);
        document.querySelector('.workspace-name').textContent = newName || 'School NoteBook';
        updatePageTitle(elements.pageTitleInput.value);
    });
    
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

    // Keyboard Shortcuts (Ctrl+K, Ctrl+B, Ctrl+I, Ctrl+D, Ctrl+L, Ctrl+N)
    document.addEventListener('keydown', (e) => {
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
    saveToStorage();
    renderSidebar();
    openPage(id);
}

function loadPages() {
    const stored = localStorage.getItem('schooldb_pages');
    if (stored) {
        appState.pages = JSON.parse(stored);
        renderSidebar();
        const firstPageId = Object.keys(appState.pages)[0];
        if (firstPageId) openPage(firstPageId);
    } else {
        // Create default page
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

    const workspaceName = localStorage.getItem('schooldb_workspace');
    if (workspaceName) {
        document.querySelector('.workspace-name').textContent = workspaceName;
    }
    
    // Realtime sync from cloud + cross-tab sync (Mini Note on same device)
    startCloudSync();
    startLocalSync();
}

// --- REALTIME SYNC ---
// Nhận ghi chú từ Firestore theo thời gian thực. Ghi chú định dạng cũ ({title, content})
// do Mini Note / CLI cũ gửi lên sẽ được chuyển sang blocks và ghi đè lại lên Cloud.
function isEditingActivePage() {
    const ae = document.activeElement;
    return !!ae && (ae === elements.pageTitleInput || elements.blockEditor.contains(ae));
}

function startCloudSync() {
    if (!db) return;
    db.collection('notes').onSnapshot(snapshot => {
        let sidebarDirty = false;
        let activeDirty = false;
        let newInbox = 0;

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
            if (page.id === appState.activePageId) activeDirty = true;
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
        cloudSyncReady = true;
    }, err => {
        console.error('Firebase realtime error:', err);
        elements.saveStatus.textContent = 'Cloud Error';
    });

    // Từ vựng gửi từ Mini Note ở thiết bị khác
    db.collection('vocab_inbox').onSnapshot(snapshot => {
        let added = 0;
        snapshot.docChanges().forEach(change => {
            if (change.type !== 'added' || change.doc.metadata.hasPendingWrites) return;
            const data = change.doc.data();
            if (data && data.word && !vocab.items.some(i => i.id === data.id)) {
                vocab.items.unshift(Object.assign(NoteSchema.makeVocabItem(data), data.id ? { id: data.id } : {}));
                added++;
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

let saveTimeout;
function triggerSave() {
    elements.saveStatus.textContent = 'Saving...';
    clearTimeout(saveTimeout);
    
    // Update active page state from DOM
    if (appState.activePageId && appState.pages[appState.activePageId]) {
        appState.pages[appState.activePageId].title = elements.pageTitleInput.value;
        appState.pages[appState.activePageId].blocks = serializeBlocks();
    }

    refreshToc();

    saveTimeout = setTimeout(() => {
        saveToStorage();
        elements.saveStatus.textContent = 'Saved';
    }, 500);
}

let firebaseSyncTimeout;

function saveToStorage() {
    // 1. Save locally immediately
    localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
    
    // 2. Sync to Firebase (Debounced)
    if (db) {
        clearTimeout(firebaseSyncTimeout);
        firebaseSyncTimeout = setTimeout(() => {
            elements.saveStatus.textContent = 'Syncing...';
            // Sync active page
            if (appState.activePageId && appState.pages[appState.activePageId]) {
                const pageData = appState.pages[appState.activePageId];
                db.collection('notes').doc(appState.activePageId).set(pageToCloud(pageData), { merge: true })
                .then(() => {
                    elements.saveStatus.textContent = 'Saved to Cloud';
                })
                .catch(err => {
                    console.error("Firebase sync error:", err);
                    elements.saveStatus.textContent = 'Cloud Error';
                });
            }
        }, 1500);
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
    if (db) db.collection('notes').doc(pageId).delete();
    saveToStorage();
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
        page.blocks.forEach(b => text += b.content + '\n');
        
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

function renderBlocks(blocks) {
    elements.blockEditor.innerHTML = '';
    if (!blocks || blocks.length === 0) {
        blocks = [{ id: generateId(), type: 'text', content: '', indent: 0 }];
    }
    blocks.forEach(block => {
        const blockEl = createBlockElement(block.type, block.content, block.id, block.indent || 0);
        elements.blockEditor.appendChild(blockEl);
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
        const rawText = contentEl.innerText !== undefined ? contentEl.innerText : (contentEl.textContent || '');
        let content = rawText.trim();
        
        // save checked state for todos
        if (type === 'todo') {
            const cb = wrapper.querySelector('.todo-cb');
            if (cb && cb.checked) {
                content = '[x] ' + content;
            }
        }
        
        blocks.push({
            id: wrapper.getAttribute('data-id'),
            type: type,
            content: content,
            indent: parseInt(wrapper.getAttribute('data-indent') || '0', 10)
        });
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

function checkMarkdownShortcuts(target) {
    const text = target.innerText || target.textContent || '';
    
    // 1. Bullet list: "* " or "- "
    const bulletMatch = text.match(/^(\*|-)\s(.*)/s);
    if (bulletMatch) {
        setBlockType(target, 'bullet');
        target.innerHTML = bulletMatch[2];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 2. Numbered list: "1. " or "1) "
    const numberMatch = text.match(/^1[\.\)]\s(.*)/s);
    if (numberMatch) {
        setBlockType(target, 'number');
        target.innerHTML = numberMatch[1];
        setCaretAtStart(target);
        updateNumberPrefixes();
        triggerSave();
        return true;
    }
    
    // 3. To-do list: "[] " or "[ ] "
    const todoMatch = text.match(/^(\[\]|\[\s\])\s(.*)/s);
    if (todoMatch) {
        setBlockType(target, 'todo');
        target.innerHTML = todoMatch[2];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 4. Heading 1: "# "
    const h1Match = text.match(/^#\s(.*)/s);
    if (h1Match) {
        setBlockType(target, 'h1');
        target.innerHTML = h1Match[1];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 5. Heading 2: "## "
    const h2Match = text.match(/^##\s(.*)/s);
    if (h2Match) {
        setBlockType(target, 'h2');
        target.innerHTML = h2Match[1];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 6. Heading 3: "### "
    const h3Match = text.match(/^###\s(.*)/s);
    if (h3Match) {
        setBlockType(target, 'h3');
        target.innerHTML = h3Match[1];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 7. Quote: "> "
    const quoteMatch = text.match(/^>\s(.*)/s);
    if (quoteMatch) {
        setBlockType(target, 'quote');
        target.innerHTML = quoteMatch[1];
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    // 8. Divider: "---"
    if (text.trim() === '---') {
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
        setBlockType(target, 'code');
        target.innerHTML = '';
        setCaretAtStart(target);
        triggerSave();
        return true;
    }
    
    return false;
}

function selectBlockAndShowMenu(wrapper) {
    const contentEl = wrapper.querySelector('.block-content');
    if (!contentEl) return;
    
    // 1. Highlight / select all contents of this block ("bôi đen cả dòng")
    contentEl.focus();
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    // 2. Set active block state
    activeBlockId = wrapper.getAttribute('data-id');
    activeBlockElement = wrapper;
    const currentType = wrapper.getAttribute('data-type') || 'text';
    updateBlockTypeBadge(currentType);
    
    // 3. Highlight visually
    wrapper.classList.add('is-focused');
    
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

function createBlockElement(type, content, id = generateId(), indent = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.setAttribute('data-id', id);
    wrapper.setAttribute('data-indent', indent);
    wrapper.style.marginLeft = `${indent * 24}px`;

    wrapper.innerHTML = `
        <div class="block-handle" contenteditable="false" title="Bấm để chọn dòng hoặc đổi kiểu khối, giữ để kéo"><i class="ri-drag-move-2-line"></i></div>
        <div class="block-prefix" contenteditable="false"></div>
        <div class="block-content" contenteditable="true"></div>
    `;
    
    const contentEl = wrapper.querySelector('.block-content');
    const handleEl = wrapper.querySelector('.block-handle');
    
    if (type === 'image' && content.includes('<img')) {
        contentEl.innerHTML = content;
        contentEl.dataset.src = content;
    } else {
        contentEl.innerHTML = content;
    }

    setBlockType(contentEl, type, content);
    
    // Handle click to select line and show block menu
    if (handleEl) {
        handleEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBlockAndShowMenu(wrapper);
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

function toggleBlockOpen(icon) {
    icon.classList.toggle('open');
    const wrapper = icon.closest('.block-wrapper');
    const myIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
    const isOpen = icon.classList.contains('open');
    
    icon.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
    
    let next = wrapper.nextElementSibling;
    while (next && next.classList.contains('block-wrapper')) {
        const nextIndent = parseInt(next.getAttribute('data-indent') || '0', 10);
        if (nextIndent <= myIndent) break; // Not a child anymore
        
        if (isOpen) {
            next.style.display = 'flex'; // show
        } else {
            next.style.display = 'none'; // hide
        }
        next = next.nextElementSibling;
    }
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
    
    // Handle Indentation with Tab
    if (e.key === 'Tab') {
        e.preventDefault();
        let indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        if (e.shiftKey) {
            indent = Math.max(0, indent - 1);
        } else {
            indent = Math.min(4, indent + 1); // max 4 levels
        }
        wrapper.setAttribute('data-indent', indent);
        wrapper.style.marginLeft = `${indent * 24}px`;
        updateNumberPrefixes();
        triggerSave();
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
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
                    setBlockType(target, 'text');
                    updateNumberPrefixes();
                    closeSlashMenu();
                    triggerSave();
                    return;
                }
                
                // 2. If indented, outdent first!
                if (indent > 0) {
                    e.preventDefault();
                    indent = indent - 1;
                    wrapper.setAttribute('data-indent', indent);
                    wrapper.style.marginLeft = `${indent * 24}px`;
                    triggerSave();
                    return;
                }
                
                // 3. Otherwise merge with previous block!
                const prev = wrapper.previousElementSibling;
                if (prev && prev.classList.contains('block-wrapper')) {
                    e.preventDefault();
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
}

function handleBlockInput(e) {
    const target = e.target;
    
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

function handleBlockPaste(e) {
    let target = e.target;
    let wrapper = target.closest('.block-wrapper');
    if (!wrapper) return;

    // Nếu người dùng đang bôi đen nhiều khối (multi-block selection), xóa các khối đã chọn và thay thế
    if (typeof selectedBlockWrappers !== 'undefined' && selectedBlockWrappers && selectedBlockWrappers.length > 0) {
        const firstBlock = selectedBlockWrappers[0];
        const restBlocks = selectedBlockWrappers.slice(1);
        restBlocks.forEach(w => w.remove());
        if (typeof clearBlockSelection === 'function') clearBlockSelection();
        if (firstBlock) {
            const firstContent = firstBlock.querySelector('.block-content');
            if (firstContent) {
                target = firstContent;
                wrapper = firstBlock;
                target.innerHTML = '';
            }
        }
    }

    let text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    const html = e.clipboardData ? e.clipboardData.getData('text/html') : '';

    // Nếu plain text không có \n nhưng HTML có thẻ đoạn/ngắt dòng (copy từ web, Word, tài liệu rich text)
    if (!text.includes('\n') && html && (/<(p|br|div|li|tr|h[1-6])\b/i.test(html))) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        temp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        temp.querySelectorAll('p, div, tr, h1, h2, h3, h4, h5, h6').forEach(el => el.append('\n'));
        temp.querySelectorAll('li').forEach(li => {
            const prefix = document.createTextNode('\n• ');
            li.parentNode.insertBefore(prefix, li);
        });
        const extracted = temp.innerText || temp.textContent || '';
        if (extracted.includes('\n')) {
            text = extracted;
        }
    }

    // Chuẩn hóa ngắt dòng và dấu cách không ngắt (non-breaking space \u00A0 thành space thường)
    text = (text || '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');

    if (!text) return;

    // Dán 1 dòng thông thường: chèn plain text sạch vào vị trí con trỏ
    if (!text.includes('\n')) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        checkMarkdownShortcuts(target);
        triggerSave();
        return;
    }

    // DÁN TÀI LIỆU NHIỀU DÒNG: Tự động xuống dòng và tách thành các block tương ứng
    e.preventDefault();

    let beforeHtml = '';
    let afterHtml = '';
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        range.deleteContents();

        const afterRange = document.createRange();
        afterRange.selectNodeContents(target);
        afterRange.setStart(range.startContainer, range.startOffset);

        const afterFragment = afterRange.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(afterFragment);
        afterHtml = tempDiv.innerHTML;

        afterRange.deleteContents();
        beforeHtml = target.innerHTML;
    } else {
        beforeHtml = target.innerHTML;
        afterHtml = '';
    }

    const lines = text.split('\n');
    const currentIndent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);

    // 1. Dòng đầu tiên: đưa vào block hiện tại
    const firstLine = lines[0];
    let finalFirstHtml = beforeHtml + escapeHtml(firstLine);
    if (lines.length === 1 && afterHtml) {
        finalFirstHtml += afterHtml;
    }
    target.innerHTML = finalFirstHtml;
    checkMarkdownShortcuts(target);

    // 2. Các dòng tiếp theo: tạo thành các khối (block) mới nối tiếp
    let lastWrapper = wrapper;
    let lastContentEl = target;

    for (let i = 1; i < lines.length; i++) {
        const rawLine = lines[i];
        let lineText = rawLine;
        const isLastLine = (i === lines.length - 1);

        let blockType = 'text';
        let blockIndent = currentIndent;
        let m;

        // Tự động nhận diện độ thụt lề nếu có 2 space trở lên
        const leadingSpaces = (rawLine.match(/^ */) || [''])[0].length;
        if (leadingSpaces >= 2) {
            blockIndent = Math.min(4, currentIndent + Math.floor(leadingSpaces / 2));
            lineText = rawLine.trim();
        }

        const trimmed = lineText.trim();

        if (trimmed === '---') {
            blockType = 'divider';
            lineText = '';
        } else if ((m = trimmed.match(/^###\s+(.*)$/))) {
            blockType = 'h3';
            lineText = m[1];
        } else if ((m = trimmed.match(/^##\s+(.*)$/))) {
            blockType = 'h2';
            lineText = m[1];
        } else if ((m = trimmed.match(/^#\s+(.*)$/))) {
            blockType = 'h1';
            lineText = m[1];
        } else if ((m = trimmed.match(/^(?:[-*]\s+)?\[( |x|X)?\]\s*(.*)$/))) {
            blockType = 'todo';
            lineText = (m[1] && m[1].toLowerCase() === 'x' ? '[x] ' : '') + m[2];
        } else if ((m = trimmed.match(/^[-*•]\s+(.*)$/))) {
            blockType = 'bullet';
            lineText = m[1];
        } else if ((m = trimmed.match(/^\d+[.)]\s+(.*)$/))) {
            blockType = 'number';
            lineText = m[1];
        } else if ((m = trimmed.match(/^>\s?(.*)$/))) {
            blockType = 'quote';
            lineText = m[1];
        } else if (trimmed.startsWith('```')) {
            blockType = 'code';
            lineText = trimmed.replace(/^```/, '');
        } else {
            // Kế thừa danh sách nếu block trước là bullet/number/todo
            const prevType = lastWrapper.getAttribute('data-type');
            if (prevType === 'bullet' || prevType === 'number' || prevType === 'todo') {
                if (trimmed) blockType = prevType;
            }
        }

        let finalHtml = escapeHtml(lineText);
        if (isLastLine && afterHtml) {
            finalHtml += afterHtml;
        }

        const newWrapper = createBlockElement(blockType, finalHtml, generateId(), blockIndent);
        lastWrapper.parentNode.insertBefore(newWrapper, lastWrapper.nextSibling);
        lastWrapper = newWrapper;
        lastContentEl = newWrapper.querySelector('.block-content');
    }

    updateNumberPrefixes();

    if (lastContentEl) {
        lastContentEl.focus();
        if (lines[lines.length - 1] || afterHtml) {
            const targetOffset = lines[lines.length - 1].length;
            setCaretAtOffset(lastContentEl, targetOffset);
        } else {
            setCaretAtStart(lastContentEl);
        }
    }

    closeSlashMenu();
    triggerSave();
}

function openSlashMenu(target, query = '') {
    const rect = target.getBoundingClientRect();
    elements.slashMenu.style.display = 'block';
    elements.slashMenu.style.top = `${rect.bottom + 5}px`;
    elements.slashMenu.style.left = `${rect.left}px`;
    
    // Filter items
    const items = elements.slashMenu.querySelectorAll('.slash-menu-item');
    let hasVisible = false;
    items.forEach(item => {
        const title = item.querySelector('.item-title').textContent.toLowerCase();
        const type = (item.getAttribute('data-type') || '').toLowerCase();
        if (title.includes(query) || type.includes(query)) {
            item.style.display = 'flex';
            hasVisible = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    if (!hasVisible) {
        closeSlashMenu();
    }
}

function closeSlashMenu() {
    elements.slashMenu.style.display = 'none';
}

function applySlashCommand(type) {
    if (activeBlockElement) {
        setBlockType(activeBlockElement, type);
        // Remove the /command string
        activeBlockElement.innerText = activeBlockElement.innerText.replace(/\/[a-zA-Z0-9_-]*$/, '');
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
        const checked = element.style.textDecoration === 'line-through';
        prefix = `<input type="checkbox" class="todo-cb" ${checked ? 'checked' : ''} onclick="toggleTodo(this)">`;
    } else {
        if (element.style.textDecoration === 'line-through') {
            element.style.textDecoration = 'none';
            element.style.opacity = '1';
        }
        if (isToggle) {
            prefix = `<i class="ri-arrow-right-s-line toggle-icon" onclick="toggleBlockOpen(this)"></i>`;
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
            if (!element.querySelector('img') && !initialContent.includes('<img')) {
                const url = prompt('Nhập link hình ảnh:');
                if (url) {
                    element.innerHTML = `<img src="${url}" style="max-width:100%; border-radius:6px; margin-top:8px;">`;
                } else {
                    type = 'text'; // Fallback
                }
            }
            element.contentEditable = false;
        }
    }
    
    if (type !== 'divider' && type !== 'image' && type !== 'toc') {
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
    element.setAttribute('data-placeholder', placeholder);
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

    save: () => {
        localStorage.setItem('schooldb_vocab_items', JSON.stringify(vocab.items));
        vocab.renderStats();
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
        }

        vocab.save();
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
        vocab.save();
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
        vocab.save();

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
function initFloatingToolbar() {
    const toolbar = document.getElementById('floating-toolbar');
    const colorBtn = document.getElementById('bubble-color-btn');
    const colorDropdown = document.getElementById('bubble-color-dropdown');
    const typeBtn = document.getElementById('nft-block-type-btn');
    const typeDropdown = document.getElementById('nft-type-dropdown');
    const addVocabBtn = document.getElementById('bubble-add-vocab-btn');

    if (!toolbar) return;

    let activeBlockElement = null;
    let activeBlockId = null;

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
            document.execCommand('foreColor', false, color);
            colorDropdown.style.display = 'none';
            triggerSave();
        });
    });

    // Background Highlight Colors
    toolbar.querySelectorAll('.color-dot.bg-color').forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const bgcolor = dot.getAttribute('data-bgcolor');
            if (bgcolor === 'transparent') {
                document.execCommand('removeFormat', false, null);
            } else {
                document.execCommand('hiliteColor', false, bgcolor);
            }
            colorDropdown.style.display = 'none';
            triggerSave();
        });
    });

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
            if (!sel || sel.isCollapsed || !sel.rangeCount) {
                toolbar.style.display = 'none';
                if (colorDropdown) colorDropdown.style.display = 'none';
                if (typeDropdown) typeDropdown.style.display = 'none';
                return;
            }

            const text = sel.toString().trim();
            if (text.length === 0) {
                toolbar.style.display = 'none';
                return;
            }

            currentSelectedText = text;

            const range = sel.getRangeAt(0);
            let container = range.commonAncestorContainer;
            if (container && container.nodeType === Node.TEXT_NODE) container = container.parentElement;

            // Don't show toolbar if user is selecting inside the toolbar itself or inside modals/inputs
            if (toolbar.contains(container) || (container && container.closest('#vocab-modal, #search-modal, #settings-modal'))) {
                return;
            }

            // Check if selection is within editor content
            const inEditor = !!(container && container.closest('#editor-container, .page-content, .block-editor, .block-content'));

            // Toggle editor-only rows
            const headerRow = document.getElementById('nft-header-row');
            const dividerTop = document.getElementById('nft-divider-top');
            const caseTitle = document.getElementById('nft-case-title');
            const caseRow = document.getElementById('nft-case-row');
            const toolsTitle = document.getElementById('nft-tools-title');
            const linkItem = document.getElementById('bubble-link-btn');

            if (headerRow) headerRow.style.display = inEditor ? 'flex' : 'none';
            if (dividerTop) dividerTop.style.display = inEditor ? 'block' : 'none';
            if (caseTitle) caseTitle.style.display = inEditor ? 'block' : 'none';
            if (caseRow) caseRow.style.display = inEditor ? 'flex' : 'none';
            if (toolsTitle) toolsTitle.style.display = inEditor ? 'block' : 'none';
            if (linkItem) linkItem.style.display = inEditor ? 'flex' : 'none';

            // Update Word and Character Count Stats
            const wordCount = text.split(/\s+/).filter(Boolean).length;
            const charCount = text.length;
            const statsEl = document.getElementById('nft-word-char-count');
            if (statsEl) {
                statsEl.textContent = `${wordCount} từ • ${charCount} ký tự`;
            }

            // Identify active block if in editor
            if (inEditor) {
                const blockEl = container.closest('.block-wrapper');
                if (blockEl) {
                    activeBlockId = blockEl.getAttribute('data-id');
                    activeBlockElement = blockEl;
                    const blockType = blockEl.getAttribute('data-type') || 'text';
                    updateBlockTypeBadge(blockType);
                } else {
                    activeBlockId = null;
                    activeBlockElement = null;
                }
            }

            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
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
        bullet: { label: 'Danh sách', icon: 'ri-list-unordered' },
        number: { label: 'Số thứ tự', icon: 'ri-list-ordered' },
        todo: { label: 'To-do', icon: 'ri-checkbox-line' },
        quote: { label: 'Trích dẫn', icon: 'ri-double-quotes-l' },
        code: { label: 'Code', icon: 'ri-code-box-line' }
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
        bullet: 'Danh sách chấm',
        number: 'Danh sách số',
        todo: 'To-do list',
        quote: 'Trích dẫn',
        code: 'Khối code',
        divider: 'Đường kẻ',
        toggle: 'Toggle'
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
    
    setBlockType(contentEl, newType);
    if (newType === 'number') {
        updateNumberPrefixes();
    }
    updateBlockTypeBadge(newType);
    triggerSave();
    contentEl.focus();
    
    const typeDropdown = document.getElementById('nft-type-dropdown');
    if (typeDropdown) typeDropdown.style.display = 'none';
    
    showToast(`Đã chuyển thành ${getBlockTypeName(newType)}`);
}

// Multi-Block Selection System
let selectedBlockWrappers = [];

function clearBlockSelection() {
    if (selectedBlockWrappers && selectedBlockWrappers.length) {
        selectedBlockWrappers.forEach(w => w.classList.remove('is-block-selected'));
        selectedBlockWrappers = [];
    }
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

function initMultiBlockSelection() {
    let isMouseDown = false;
    let dragStartWrapper = null;

    if (!elements.blockEditor) return;

    elements.blockEditor.addEventListener('mousedown', (e) => {
        if (e.target.closest('.block-handle') || e.target.closest('.todo-cb') || e.target.closest('.toggle-icon')) {
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

    // Keyboard handlers when multiple blocks are selected
    document.addEventListener('keydown', (e) => {
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
                    // If single line already selected or empty, select all blocks!
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

        // Multi-block actions
        if (selectedBlockWrappers && selectedBlockWrappers.length > 0) {
            if (e.key === 'Escape') {
                clearBlockSelection();
                return;
            }

            // Copy multi-block text
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                const combinedText = selectedBlockWrappers
                    .map(w => {
                        const contentEl = w.querySelector('.block-content');
                        return contentEl ? (contentEl.innerText || '').trim() : '';
                    })
                    .join('\n');
                navigator.clipboard.writeText(combinedText);
                showToast(`Đã sao chép ${selectedBlockWrappers.length} dòng`);
                return;
            }

            // Delete multi-block text
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                const firstBlock = selectedBlockWrappers[0];
                const restBlocks = selectedBlockWrappers.slice(1);
                restBlocks.forEach(w => w.remove());
                if (firstBlock) {
                    const contentEl = firstBlock.querySelector('.block-content');
                    setBlockType(contentEl, 'text');
                    contentEl.innerHTML = '';
                    firstBlock.classList.remove('is-block-selected');
                    contentEl.focus();
                }
                selectedBlockWrappers = [];
                updateNumberPrefixes();
                triggerSave();
                showToast('Đã xóa các dòng đã chọn');
                return;
            }
        }
    });
}

function executeFormatAction(action) {
    if (action === 'bold') {
        document.execCommand('bold', false, null);
    } else if (action === 'italic') {
        document.execCommand('italic', false, null);
    } else if (action === 'underline') {
        document.execCommand('underline', false, null);
    } else if (action === 'removeFormat') {
        document.execCommand('removeFormat', false, null);
    } else if (action === 'strikethrough') {
        document.execCommand('strikeThrough', false, null);
    } else if (action === 'code') {
        const sel = window.getSelection();
        if (!sel.isCollapsed) {
            const text = sel.toString();
            document.execCommand('insertHTML', false, `<code class="inline-code">${escapeHtml(text)}</code>`);
        }
    } else if (action === 'copy') {
        const sel = window.getSelection();
        if (sel) {
            navigator.clipboard.writeText(sel.toString().trim());
            showToast('Đã sao chép đoạn văn bản!');
        }
    }
    triggerSave();
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
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed:', err));
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


