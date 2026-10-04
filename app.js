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
    
    // Topbar Actions
    document.querySelectorAll('.topbar-right .icon-btn')[1].addEventListener('click', () => {
        // Share -> Copy to clipboard
        app.copyPageContents();
    }); 
    
    document.querySelectorAll('.topbar-right .icon-btn')[2].addEventListener('click', (e) => {
        e.stopPropagation();
        const pop = document.getElementById('more-popover');
        const isVisible = pop.style.display === 'block';
        if (isVisible) {
            pop.style.display = 'none';
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        pop.style.display = 'block';
        pop.style.top = `${rect.bottom + 8}px`;
        pop.style.right = '16px';
        
        // Sync states with active page
        const page = appState.pages[appState.activePageId];
        if (page) {
            const font = page.font || 'default';
            pop.querySelectorAll('.font-btn').forEach(btn => {
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
        if (!emojiPicker.contains(e.target) && !e.target.closest('#add-icon-btn') && !e.target.closest('#page-icon')) {
            emojiPicker.style.display = 'none';
        }
        if (!coverPicker.contains(e.target) && !e.target.closest('#add-cover-btn') && !e.target.closest('.change-cover-btn')) {
            coverPicker.style.display = 'none';
        }
        if (!morePopover.contains(e.target) && !e.target.closest('.topbar-right .icon-btn:last-child')) {
            morePopover.style.display = 'none';
        }
    });

    initPopovers();
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
    
    // Pull from cloud if enabled
    if (db) {
        db.collection('notes').get().then(snapshot => {
            let hasChanges = false;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.blocks) {
                    appState.pages[data.id] = data;
                    hasChanges = true;
                }
            });
            if (hasChanges) {
                localStorage.setItem('schooldb_pages', JSON.stringify(appState.pages));
                renderSidebar();
                if (appState.activePageId && appState.pages[appState.activePageId]) {
                    openPage(appState.activePageId);
                }
            }
        }).catch(err => console.error("Error loading from Firebase:", err));
    }
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
                db.collection('notes').doc(appState.activePageId).set({
                    id: pageData.id,
                    title: pageData.title,
                    icon: pageData.icon || '📄',
                    cover: pageData.cover || null,
                    blocks: pageData.blocks,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true })
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
    Object.values(appState.pages).forEach(page => {
        const li = document.createElement('li');
        li.className = `page-item ${page.id === appState.activePageId ? 'active' : ''}`;
        li.innerHTML = `
            <div class="page-item-content">
                <span class="page-icon">${page.icon || '📄'}</span>
                <span class="page-title">${page.title || 'Untitled'}</span>
            </div>
        `;
        li.onclick = () => openPage(page.id);
        elements.pageList.appendChild(li);
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
    
    renderBlocks(page.blocks);
    
    // Apply lock state
    applyLockState(!!page.locked);
    
    renderSidebar(); // Update active state
}

// --- PAGE HEADER ACTIONS ---
const defaultCovers = [
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&q=80',
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1200&q=80',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80'
];

const emojis = ['📄','😀','😂','🥰','😎','🤔','🙌','💡','🚀','💻','📱','📚','🎓','📝','✨','🔥','⭐','🎉','🌿','🎨'];

function initPopovers() {
    // Populate emoji grid
    const emojiGrid = document.getElementById('emoji-grid');
    emojis.forEach(e => {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = e;
        span.onclick = () => {
            applyIcon(e);
            document.getElementById('emoji-picker').style.display = 'none';
        };
        emojiGrid.appendChild(span);
    });

    // Populate cover grid
    const coverGrid = document.getElementById('cover-grid');
    defaultCovers.forEach(c => {
        const div = document.createElement('div');
        div.className = 'cover-item';
        div.style.backgroundImage = `url(${c})`;
        div.onclick = () => {
            applyCover(c);
            document.getElementById('cover-picker').style.display = 'none';
        };
        coverGrid.appendChild(div);
    });

    document.getElementById('custom-cover-btn').onclick = () => {
        const val = document.getElementById('custom-cover-input').value;
        if (val) {
            applyCover(val);
            document.getElementById('cover-picker').style.display = 'none';
        }
    };
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
    picker.style.top = `${rect.bottom + 10}px`;
    picker.style.left = `${rect.left}px`;
}

function showCoverPicker(target) {
    const picker = document.getElementById('cover-picker');
    const rect = target.getBoundingClientRect();
    picker.style.display = 'block';
    picker.style.top = `${rect.bottom + 10}px`;
    picker.style.right = '48px'; // align roughly to edge
}

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
        if (!appState.activePageId) return;
        if(confirm('Bạn có chắc muốn xóa trang này?')) {
            delete appState.pages[appState.activePageId];
            if (db) db.collection('notes').doc(appState.activePageId).delete();
            saveToStorage();
            renderSidebar();
            const firstId = Object.keys(appState.pages)[0];
            if (firstId) openPage(firstId);
            else createNewPage();
        }
        document.getElementById('more-popover').style.display = 'none';
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
        const type = contentEl.getAttribute('data-type');
        let content = contentEl.innerText.trim();
        
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

function createBlockElement(type, content, id = generateId(), indent = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.setAttribute('data-id', id);
    wrapper.setAttribute('data-indent', indent);
    wrapper.style.marginLeft = `${indent * 24}px`;

    wrapper.innerHTML = `
        <div class="block-handle" contenteditable="false"><i class="ri-drag-move-2-line"></i></div>
        <div class="block-prefix" contenteditable="false"></div>
        <div class="block-content" contenteditable="true"></div>
    `;
    
    const contentEl = wrapper.querySelector('.block-content');
    
    if (type === 'image' && content.includes('<img')) {
        contentEl.innerHTML = content;
        contentEl.dataset.src = content;
    } else {
        contentEl.innerHTML = content;
    }

    setBlockType(contentEl, type, content);
    
    // Event listeners
    contentEl.addEventListener('keydown', handleBlockKeydown);
    contentEl.addEventListener('input', handleBlockInput);
    contentEl.addEventListener('focus', () => { activeBlockElement = contentEl; });

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
        triggerSave();
        return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
        let indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
        
        // If block is empty
        if (target.textContent.trim() === '') {
            const type = target.getAttribute('data-type');
            if (type !== 'text') {
                // 1. Revert to plain text if it's a special block
                setBlockType(target, 'text');
                closeSlashMenu();
                triggerSave();
                return;
            } else if (indent > 0) {
                // 2. Outdent if it's plain text and indented
                indent = indent - 1;
                wrapper.setAttribute('data-indent', indent);
                wrapper.style.marginLeft = `${indent * 24}px`;
                triggerSave();
                return;
            }
        }
        
        const type = target.getAttribute('data-type');
        
        // Auto-indent if creating a new block after a toggle
        if (type === 'toggle' || (type && type.startsWith('toggle-'))) {
            indent = indent + 1;
            // ensure it's open visually
            const icon = wrapper.querySelector('.toggle-icon');
            if (icon && !icon.classList.contains('open')) {
                toggleBlockOpen(icon);
            }
        }
        
        const newWrapper = createBlockElement('text', '', generateId(), indent);
        wrapper.parentNode.insertBefore(newWrapper, wrapper.nextSibling);
        newWrapper.querySelector('.block-content').focus();
        closeSlashMenu();
        triggerSave();
    }
    
    if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (sel.anchorOffset === 0 && sel.focusOffset === 0) {
            // If empty and not basic text, revert to text first
            const type = target.getAttribute('data-type');
            if (type !== 'text') {
                e.preventDefault();
                setBlockType(target, 'text');
                closeSlashMenu();
                triggerSave();
            } else {
                const prev = wrapper.previousElementSibling;
                if (prev) {
                    e.preventDefault();
                    // Merge text
                    const prevContent = prev.querySelector('.block-content');
                    const textToMove = target.innerText;
                    
                    const range = document.createRange();
                    range.selectNodeContents(prevContent);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    
                    wrapper.remove();
                    triggerSave();
                }
            }
        }
    }
}

function handleBlockInput(e) {
    const text = e.target.innerText;
    const match = text.match(/\/([a-zA-Z0-9_-]*)$/);
    if (match) {
        const query = match[1].toLowerCase();
        openSlashMenu(e.target, query);
    } else {
        closeSlashMenu();
    }
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
    } else if (isToggle) {
        prefix = `<i class="ri-arrow-right-s-line toggle-icon" onclick="toggleBlockOpen(this)"></i>`;
    } else if (type === 'bullet') {
        prefix = `<span class="bullet-dot">•</span>`;
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
        word: 'Resilient',
        phonetic: '/rɪˈzɪl.i.ənt/',
        meaning: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn',
        example: 'She is a resilient person who never gives up in adversity.',
        tag: 'IELTS',
        status: 'learning',
        createdAt: 1715000000000
    },
    {
        id: 'v2',
        word: 'Breakthrough',
        phonetic: '/ˈbreɪk.θruː/',
        meaning: 'Bước đột phá, phát minh mang tính cách mạng',
        example: 'Scientists made a major breakthrough in cancer treatment.',
        tag: 'Tech',
        status: 'mastered',
        createdAt: 1715001000000
    },
    {
        id: 'v3',
        word: 'Ubiquitous',
        phonetic: '/juːˈbɪk.wə.t̬əs/',
        meaning: 'Phổ biến, có mặt ở khắp mọi nơi',
        example: 'Smartphones have become ubiquitous in daily modern life.',
        tag: 'IELTS',
        status: 'learning',
        createdAt: 1715002000000
    },
    {
        id: 'v4',
        word: 'Pragmatic',
        phonetic: '/præɡˈmæt̬.ɪk/',
        meaning: 'Thực tế, thực dụng, chú trọng tính hiệu quả',
        example: 'He took a pragmatic approach to solving the budget crisis.',
        tag: 'TOEIC',
        status: 'mastered',
        createdAt: 1715003000000
    },
    {
        id: 'v5',
        word: 'Serendipity',
        phonetic: '/ˌser.ənˈdɪp.ə.t̬i/',
        meaning: 'Sự tình cờ may mắn, duyên may bất ngờ',
        example: 'Finding this cozy bookstore was pure serendipity.',
        tag: 'Daily',
        status: 'learning',
        createdAt: 1715004000000
    }
];

const vocab = {
    items: [],
    activeTag: 'all',
    searchQuery: '',
    currentView: 'list',
    flashcardIndex: 0,
    flashcardDeck: [],

    initVocab: () => {
        const stored = localStorage.getItem('schooldb_vocab_items');
        if (stored) {
            try {
                vocab.items = JSON.parse(stored);
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
                    <p style="margin-top: 12px; font-size: 15px;">Chưa tìm thấy từ vựng nào.</p>
                    <button class="btn btn-primary" style="margin-top: 14px;" onclick="vocab.openAddModal()">
                        <i class="ri-add-line"></i> Thêm từ đầu tiên
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(item => `
            <div class="vocab-card" data-id="${item.id}">
                <div>
                    <div class="vocab-card-header">
                        <div class="vocab-card-word">
                            <span>${escapeHtml(item.word)}</span>
                            <i class="ri-volume-up-line vocab-audio-icon" onclick="event.stopPropagation(); vocab.speakWord('${escapeJs(item.word)}')" title="Nghe phát âm"></i>
                        </div>
                        <span class="vocab-tag-badge">${escapeHtml(item.tag || 'General')}</span>
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
        `).join('');
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
        tagInput.value = 'IELTS';

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
        tagInput.value = item.tag || 'General';

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

        document.getElementById('fc-front-tag').textContent = item.tag || 'General';
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
                const blockEl = container.closest('.block');
                if (blockEl) {
                    activeBlockId = blockEl.getAttribute('data-id');
                    activeBlockElement = blockEl;
                    const blockData = appState.pages[appState.activePageId]?.blocks.find(b => b.id === activeBlockId);
                    if (blockData) {
                        updateBlockTypeBadge(blockData.type);
                    }
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

function convertBlockType(blockId, newType) {
    const page = appState.pages[appState.activePageId];
    if (!page) return;
    const block = page.blocks.find(b => b.id === blockId);
    if (!block) return;
    block.type = newType;
    renderBlocks(page.blocks);
    triggerSave();
    showToast(`Đã chuyển khối thành ${newType.toUpperCase()}`);
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
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

window.vocab = vocab;
window.openPage = openPage;
window.app = app;


