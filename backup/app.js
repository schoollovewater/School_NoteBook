document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('main-editor');
    const tooltip = document.getElementById('vocab-tooltip');
    const addVocabBtn = document.getElementById('add-vocab-btn');
    const modal = document.getElementById('vocab-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const saveVocabBtn = document.getElementById('save-vocab-btn');
    const engWordInput = document.getElementById('eng-word');
    
    let selectedText = '';

    // Lắng nghe sự kiện bôi đen chữ trong editor
    editor.addEventListener('mouseup', (e) => {
        selectedText = window.getSelection().toString().trim();
        
        // Nếu có text được bôi đen và độ dài hợp lý (dưới 50 ký tự)
        if (selectedText.length > 0 && selectedText.length < 50) {
            // Tính toán vị trí hiển thị tooltip
            tooltip.style.left = `${e.pageX + 10}px`;
            tooltip.style.top = `${e.pageY - 40}px`;
            tooltip.classList.remove('hidden');
        } else {
            tooltip.classList.add('hidden');
        }
    });

    // Ẩn tooltip khi click ra chỗ khác
    document.addEventListener('mousedown', (e) => {
        if (!tooltip.contains(e.target) && e.target !== editor) {
            tooltip.classList.add('hidden');
        }
    });

    // Mở popup lưu từ vựng
    addVocabBtn.addEventListener('click', () => {
        engWordInput.value = selectedText;
        modal.classList.remove('hidden');
        tooltip.classList.add('hidden');
        document.getElementById('vn-meaning').focus();
    });

    // Đóng popup
    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Giả lập lưu từ vựng
    saveVocabBtn.addEventListener('click', () => {
        const vnMeaning = document.getElementById('vn-meaning').value;
        const context = document.getElementById('context-note').value;
        
        if(vnMeaning) {
            // Ở phiên bản thực tế, đây là nơi gọi API để lưu vào Database
            alert(`Đã lưu thành công!\n\nTừ: ${selectedText}\nNghĩa: ${vnMeaning}\nNgữ cảnh: ${context}`);
            
            modal.classList.add('hidden');
            
            // Xóa dữ liệu cũ trong form
            document.getElementById('vn-meaning').value = '';
            document.getElementById('context-note').value = '';
            
            // Xóa vùng bôi đen
            window.getSelection().removeAllRanges();
        } else {
            alert('Vui lòng nhập nghĩa tiếng Việt!');
        }
    });
});
