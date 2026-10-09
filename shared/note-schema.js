/**
 * NOTE SCHEMA — dùng chung cho Sổ tay chính (index.html), Mini Note (mini.html) và CLI (mininote.js).
 * Mọi nguồn ghi chú đều phải tạo ra "page" theo đúng định dạng này để app chính hiển thị được.
 *
 * Page = { id, title, icon, blocks: [{id, type, content, indent}], tags: [], source, inbox, createdAt, updatedAt }
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NoteSchema = api;
})(typeof self !== 'undefined' ? self : this, function () {

    const SOURCE_ICONS = { mini: '⚡', cli: '⌨️', share: '🔗', app: '📄' };

    function generateId() {
        return Math.random().toString(36).slice(2, 11);
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function block(type, content, indent) {
        const safeContent = (type === 'image' || type === 'math' || type === 'table') ? String(content || '') : escapeHtml(content);
        return { id: generateId(), type: type, content: safeContent, indent: indent || 0 };
    }

    /**
     * Chuyển văn bản thô thành block của editor.
     *   "# x" → h1, "## x" → h2, "### x" → h3, "- x"/"* x" → bullet, "1. x" → number,
     *   "[] x"/"[ ] x" → todo, "[x] x" → todo đã xong, "> x" → quote, "---" → divider,
     *   khối ``` ... ``` → code. Dòng trống bị bỏ qua. Thụt 2 dấu cách = 1 cấp indent.
     * @param {string} text
     * @param {{forceType?: string}} [opts] forceType='todo' biến mọi dòng thành todo.
     */
    function textToBlocks(text, opts) {
        opts = opts || {};
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const blocks = [];
        let codeBuf = null;

        lines.forEach(function (raw) {
            if (codeBuf !== null) {
                if (/^\s*```/.test(raw)) {
                    blocks.push(block('code', codeBuf.join('\n')));
                    codeBuf = null;
                } else {
                    codeBuf.push(raw);
                }
                return;
            }
            if (/^\s*```/.test(raw)) { codeBuf = []; return; }
            if (!raw.trim()) return;

            const indent = Math.min(Math.floor((raw.match(/^ */)[0].length) / 2), 6);
            const line = raw.trim();
            let m;

            if (opts.forceType === 'todo') {
                m = line.match(/^(?:[-*]\s+)?\[( |x|X)?\]\s*(.*)$/);
                if (m) blocks.push(block('todo', (m[1] && m[1].toLowerCase() === 'x' ? '[x] ' : '') + m[2], indent));
                else blocks.push(block('todo', line.replace(/^[-*]\s+/, ''), indent));
                return;
            }

            if (line === '---') blocks.push({ id: generateId(), type: 'divider', content: '', indent: 0 });
            else if ((m = line.match(/^###\s+(.*)$/))) blocks.push(block('h3', m[1], indent));
            else if ((m = line.match(/^##\s+(.*)$/))) blocks.push(block('h2', m[1], indent));
            else if ((m = line.match(/^#\s+(.*)$/))) blocks.push(block('h1', m[1], indent));
            else if ((m = line.match(/^(?:[-*]\s+)?\[( |x|X)?\]\s*(.*)$/))) {
                blocks.push(block('todo', (m[1] && m[1].toLowerCase() === 'x' ? '[x] ' : '') + m[2], indent));
            }
            else if ((m = line.match(/^[-*•]\s+(.*)$/))) blocks.push(block('bullet', m[1], indent));
            else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) blocks.push(block('number', m[1], indent));
            else if ((m = line.match(/^>\s?(.*)$/))) blocks.push(block('quote', m[1], indent));
            else if ((m = line.match(/^!\[(.*?)\]\((.+?)\)$/))) {
                blocks.push(block('image', JSON.stringify({ src: m[2], caption: m[1], width: '100%', align: 'center' }), indent));
            }
            else blocks.push(block('text', line, indent));
        });

        if (codeBuf !== null && codeBuf.length) blocks.push(block('code', codeBuf.join('\n')));
        if (!blocks.length) blocks.push({ id: generateId(), type: 'text', content: '', indent: 0 });
        return blocks;
    }

    /** Chuẩn hoá tags: "a, b #c" | ["a"] → ["a","b","c"] */
    function normalizeTags(tags) {
        if (Array.isArray(tags)) return tags.map(function (t) { return String(t).trim(); }).filter(Boolean);
        return String(tags || '')
            .split(/[,#\n]/)
            .map(function (t) { return t.trim(); })
            .filter(Boolean);
    }

    /** Tạo page mới chuẩn schema từ dữ liệu ghi nhanh. */
    function makePage(data) {
        data = data || {};
        const now = new Date().toISOString();
        const source = data.source || 'app';
        return {
            id: data.id || generateId(),
            title: (data.title || '').trim(),
            icon: data.icon || SOURCE_ICONS[source] || '📄',
            blocks: data.blocks || textToBlocks(data.content || '', { forceType: data.forceType }),
            tags: normalizeTags(data.tags),
            source: source,
            inbox: data.inbox !== undefined ? !!data.inbox : source !== 'app',
            createdAt: data.createdAt || now,
            updatedAt: now
        };
    }

    /**
     * Nhận doc từ Firestore (kể cả định dạng cũ {title, content, tldr, date} do Mini/CLI cũ gửi)
     * và trả về page hợp lệ. Trả về null nếu không phải ghi chú.
     * @returns {{page: object, migrated: boolean} | null}
     */
    function normalizeRemoteNote(docId, data) {
        if (!data) return null;
        if (Array.isArray(data.blocks)) {
            const page = Object.assign({}, data, { id: data.id || docId });
            if (page.updatedAt && typeof page.updatedAt.toDate === 'function') {
                page.updatedAt = page.updatedAt.toDate().toISOString();
            }
            return { page: page, migrated: !data.id };
        }
        if (typeof data.content === 'string') {
            const page = makePage({
                id: docId,
                title: data.title || 'Ghi chú nhanh',
                content: data.content,
                tags: data.tags,
                source: data.source || 'mini',
                inbox: true,
                createdAt: data.date || data.createdAt
            });
            return { page: page, migrated: true };
        }
        return null;
    }

    /** Tạo item từ vựng chuẩn của Kho từ vựng. */
    function makeVocabItem(data) {
        const allowed = ['TechAdvanced', 'TechCommon', 'TOEIC', 'Other'];
        return {
            id: 'v_' + generateId(),
            word: String(data.word || '').trim(),
            phonetic: String(data.phonetic || '').trim(),
            meaning: String(data.meaning || '').trim(),
            example: String(data.example || '').trim(),
            tag: allowed.indexOf(data.tag) >= 0 ? data.tag : 'Other',
            status: 'learning',
            createdAt: Date.now()
        };
    }

    return {
        STORAGE_KEYS: {
            pages: 'schooldb_pages',
            vocab: 'schooldb_vocab_items',
            theme: 'theme',
            miniDrafts: 'mini_drafts',
            miniOutbox: 'mini_outbox'
        },
        CHANNEL: 'schooldb',
        generateId: generateId,
        escapeHtml: escapeHtml,
        textToBlocks: textToBlocks,
        normalizeTags: normalizeTags,
        makePage: makePage,
        normalizeRemoteNote: normalizeRemoteNote,
        makeVocabItem: makeVocabItem
    };
});
