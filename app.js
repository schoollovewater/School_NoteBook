document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('main-editor');
    const tooltip = document.getElementById('vocab-tooltip');
    const addVocabBtn = document.getElementById('add-vocab-btn');
    const modal = document.getElementById('vocab-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveVocabBtn = document.getElementById('save-vocab-btn');
    const engWordInput = document.getElementById('eng-word');
    const vnMeaningInput = document.getElementById('vn-meaning');
    const contextNoteInput = document.getElementById('context-note');
    const noteTitle = document.querySelector('.note-title');
    const tldrInput = document.querySelector('.tldr-input');
    
    let selectedText = '';
    let lastMouseX = 0;
    let lastMouseY = 0;

    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.pageX;
        lastMouseY = e.pageY;
    });

    const handleSelection = () => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        let rawSelectedText = editor.value.substring(start, end);
        
        // Chống đứt gãy đa dòng & Rác khoảng trắng
        selectedText = rawSelectedText.replace(/[\r\n\s]+/g, ' ').trim();
        
        // Đếm số từ, cho phép bôi đen tối đa 15 từ thay vì giới hạn 50 ký tự cứng nhắc
        const wordCount = selectedText.split(/\s+/).length;
        const containsLetters = /[a-zA-Zá-ỹđ]/.test(selectedText); // [Fix Lỗi 85]
        
        if (selectedText.length > 0 && wordCount <= 15 && containsLetters) {
            // [Fix Lỗi 76, 92]: Tự động lấy câu ngữ cảnh thông minh (Auto-Context)
            const punctuations = ['.', '?', '!', '\n'];
            let sentenceStart = -1;
            punctuations.forEach(p => {
                let idx = editor.value.lastIndexOf(p, start - 1);
                if (idx > sentenceStart) sentenceStart = idx;
            });
            sentenceStart = sentenceStart === -1 ? 0 : sentenceStart + 1;
            
            let sentenceEnd = editor.value.length - 1; // [Fix Lỗi 104] adjust to keep punctuation
            punctuations.forEach(p => {
                let idx = editor.value.indexOf(p, end);
                if (idx !== -1 && idx < sentenceEnd) sentenceEnd = idx;
            });
            
            // [Fix Lỗi 104, 105]: Giữ dấu câu và giới hạn maxlength bằng JS
            let extracted = editor.value.substring(sentenceStart, sentenceEnd + 1).trim();
            contextNoteInput.value = extracted.substring(0, 1000);

            let topPos, leftPos;
            
            // Fallback for pure keyboard users (no mouse movement recorded yet)
            if (lastMouseX === 0 && lastMouseY === 0) {
                const rect = editor.getBoundingClientRect();
                leftPos = rect.left + rect.width / 2;
                topPos = rect.top + rect.height / 2;
                tooltip.classList.remove('arrow-down');
            } else {
                leftPos = lastMouseX + 10;
                if (lastMouseY > 50) {
                    topPos = lastMouseY - 40;
                    tooltip.classList.add('arrow-down');
                } else {
                    topPos = lastMouseY + 20;
                    tooltip.classList.remove('arrow-down');
                }
            }
            
            // Chống tràn màn hình bên phải (Tooltip Bleeding) & Tránh thanh cuộn [Lỗi 115]
            const tooltipApproxWidth = 180;
            let shiftLeft = 0;
            const clientWidth = document.documentElement.clientWidth;
            if (leftPos + tooltipApproxWidth > clientWidth) {
                const newLeft = clientWidth - tooltipApproxWidth - 20;
                shiftLeft = leftPos - newLeft;
                leftPos = newLeft;
            }

            tooltip.style.left = `${leftPos}px`;
            tooltip.style.top = `${topPos}px`;
            const arrowLeft = Math.min(20 + shiftLeft, tooltipApproxWidth - 20); // [Fix Lỗi 114]
            tooltip.style.setProperty('--arrow-left', `${arrowLeft}px`); 
            tooltip.classList.remove('hidden');
        } else {
            tooltip.classList.add('hidden');
        }
    };

    // [Fix Lỗi 38, 39, 101, 112]: Chỉ bắt chuột trái (button === 0)
    document.addEventListener('mouseup', (e) => {
        if (e.target === editor && e.button === 0) handleSelection();
    });
    document.addEventListener('touchend', (e) => {
        if (e.target === editor) setTimeout(handleSelection, 100);
    });
    
    editor.addEventListener('keyup', (e) => {
        if (e.shiftKey && (e.key.includes('Arrow') || e.key === 'Home' || e.key === 'End')) {
            handleSelection();
        } else if (e.ctrlKey && e.key === 'a') {
            handleSelection();
        }
    });

    // [Fix Lỗi 82, 124]: Phím tắt Ctrl+E và Ctrl+S
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'e' && !tooltip.classList.contains('hidden')) {
            e.preventDefault();
            addVocabBtn.click();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { // [Fix Lỗi 124] Ctrl+S Save Note
            e.preventDefault();
            const saveBtn = document.getElementById('save-note-btn');
            if (saveBtn) saveBtn.click();
        }
    });

    if (noteTitle) {
        noteTitle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tldrInput.focus();
            }
        });
        
        noteTitle.addEventListener('input', () => {
            const title = noteTitle.value.trim();
            document.title = title ? `${title} - EngiHub` : "Engineer's Hub - Tri Thức Kỹ Sư";
        });
    }

    if (tldrInput) {
        tldrInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                editor.focus();
            }
        });
    }

    // Hash routing & Active menu fix [Fix Lỗi 130]
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Cập nhật Hash URL
            const sectionName = item.textContent.trim().replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            window.history.pushState(null, '', `#${sectionName}`);

            // Đóng sidebar trên mobile sau khi click (Lỗi 45)
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    document.addEventListener('mousedown', (e) => {
        if (!tooltip.contains(e.target) && e.target !== editor) {
            tooltip.classList.add('hidden');
            // [Fix Lỗi 40]: Xóa vùng bôi đen khi click ra ngoài để tránh bóng ma Tooltip
            editor.selectionStart = editor.selectionEnd;
        }
    });
    
    editor.addEventListener('input', () => {
        tooltip.classList.add('hidden');
    });

    // Cập nhật lại hoặc ẩn tooltip khi resize màn hình
    window.addEventListener('resize', () => {
        tooltip.classList.add('hidden');
    });

    // Hide tooltip on scroll
    editor.addEventListener('scroll', () => {
        tooltip.classList.add('hidden');
    });
    
    // In case editor container gets scrolling capability again
    document.querySelector('.editor-container').addEventListener('scroll', () => {
        tooltip.classList.add('hidden');
    });

    // [Fix Lỗi 121]: Race Condition Timeline & [Fix Lỗi 125]: Bảo vệ đóng Modal
    let closeModalTimeout;
    
    const requestCloseModal = () => {
        if (vnMeaningInput.value.trim() || contextNoteInput.value.trim()) {
            if (!confirm('Dữ liệu chưa được lưu. Bạn có chắc chắn muốn đóng?')) return;
        }
        closeModal();
    };

    const closeModal = () => {
        clearTimeout(closeModalTimeout);
        modal.classList.add('closing'); // [Fix Lỗi 90]
        closeModalTimeout = setTimeout(() => {
            modal.classList.remove('closing');
            modal.classList.add('hidden');
            engWordInput.value = '';
            engWordInput.dataset.raw = '';
            vnMeaningInput.value = '';
            contextNoteInput.value = '';
            editor.selectionStart = editor.selectionEnd; // [Fix Lỗi 81] Xóa bôi đen
            editor.focus({ preventScroll: true }); // [Fix Lỗi 71, 108] Focus restore without jump
            // [Fix Lỗi 34]: Mở khóa cuộn trang
            document.body.style.overflow = '';
        }, 250);
    };

    addVocabBtn.addEventListener('click', () => {
        clearTimeout(closeModalTimeout);
        modal.classList.remove('closing');
        engWordInput.value = selectedText;
        engWordInput.dataset.raw = selectedText; // [Fix Lỗi 79]
        modal.classList.remove('hidden');
        tooltip.classList.add('hidden');
        vnMeaningInput.focus();
        // [Fix Lỗi 34]: Khóa cuộn trang khi mở popup
        document.body.style.overflow = 'hidden';
    });

    closeModalBtn.addEventListener('click', requestCloseModal); // [Fix Lỗi 125]

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            requestCloseModal(); // [Fix Lỗi 125]
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!modal.classList.contains('hidden')) {
                requestCloseModal(); // [Fix Lỗi 125]
            } else if (!tooltip.classList.contains('hidden')) {
                tooltip.classList.add('hidden');
            } else if (sidebar && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        }
    });

    // Focus Trap cho Modal
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !modal.classList.contains('hidden')) {
            const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length === 0) return;
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            const activeEl = document.activeElement;
            const isBleeding = activeEl === document.body || activeEl === modal; // [Fix Lỗi 91]

            if (e.shiftKey) { 
                if (activeEl === firstElement || isBleeding) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else { 
                if (activeEl === lastElement || isBleeding) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    });

    const handleEnterToSave = (e) => {
        if (e.key === 'Enter') {
            // Ngăn việc lưu nhầm khi đang xuống dòng trong textarea (Cần Ctrl + Enter để lưu nhanh)
            if (e.target.tagName.toLowerCase() === 'textarea' && !e.ctrlKey) {
                return;
            }
            e.preventDefault();
            // Lỗi 63: Giờ xài form, nên gọi submit
            const vocabForm = document.getElementById('vocab-form');
            if (vocabForm) {
                vocabForm.requestSubmit(); // trigger submit event
            } else {
                saveVocabBtn.click();
            }
        }
    };
    engWordInput.addEventListener('keydown', handleEnterToSave);
    vnMeaningInput.addEventListener('keydown', handleEnterToSave);
    contextNoteInput.addEventListener('keydown', handleEnterToSave);

    let isSaving = false;
    const vocabForm = document.getElementById('vocab-form');
    if (vocabForm) {
        vocabForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isSaving) return;
            
            const vnMeaning = vnMeaningInput.value.trim();
            const engWord = engWordInput.value.trim(); // [Fix Lỗi 74]
            const context = contextNoteInput.value.trim();
            
            if (!engWord) {
                showToast('Vui lòng nhập từ tiếng Anh!', true);
                engWordInput.focus();
                return;
            }

            if (vnMeaning) {
                isSaving = true;
                saveVocabBtn.disabled = true;
                const originalText = saveVocabBtn.innerHTML;
                saveVocabBtn.innerHTML = 'Đang lưu...';
                
                // Giả lập delay mạng
                setTimeout(() => {
                    showToast(`Đã lưu thành công: ${engWord}`);
                    closeModal();
                    
                    isSaving = false;
                    saveVocabBtn.disabled = false;
                    saveVocabBtn.innerHTML = originalText;
                }, 300);
                
            } else {
                showToast('Vui lòng nhập nghĩa tiếng Việt!', true);
                vnMeaningInput.focus();
            }
        });
    }

    // Tracking Data Loss Prevention (isDirty)
    let isDirty = false;
    const markDirty = () => isDirty = true;
    editor.addEventListener('input', markDirty);
    noteTitle.addEventListener('input', markDirty);
    tldrInput.addEventListener('input', markDirty);

    // Feedback cho các CTA tĩnh
    const saveNoteBtn = document.getElementById('save-note-btn');
    const addTagBtn = document.getElementById('add-tag-btn');
    
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            if (!noteTitle.value.trim() && !editor.value.trim()) {
                showToast('Không thể lưu ghi chú trống!', true);
                return;
            }
            showToast('Tính năng "Lưu Ghi Chú" đang được phát triển!');
            isDirty = false; // [Fix Lỗi 89] Reset cờ khi đã lưu
        });
    }

    if (addTagBtn) {
        addTagBtn.addEventListener('click', () => {
            showToast('Tính năng "Thêm Tag" đang được phát triển!');
        });
    }

    // Mobile Navigation
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const closeSidebar = () => {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
        if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
    };

    // [Fix Lỗi 119]: Xóa trạng thái open khi xoay màn hình/resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('show');
            mobileMenuBtn.setAttribute('aria-expanded', 'true');
        });
    }

    if (closeSidebarBtn && sidebar) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // [Fix Lỗi 47]: Dead Profile UI
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.addEventListener('click', () => {
            showToast('Tính năng "Trang cá nhân" đang được phát triển!');
        });
    }

    // [Fix Lỗi 64, 89]: Cảnh báo mất dữ liệu có điều kiện
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});
