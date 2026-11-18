/**
 * School NoteBook — AI Service (Google Gemini Integration)
 * Hỗ trợ AI toàn diện cho Sổ tay ghi chú & Kho từ vựng tiếng Anh.
 */

const aiService = {
    STORAGE_KEYS: {
        apiKey: 'schooldb_gemini_api_key',
        model: 'schooldb_gemini_model',
        discoveredModels: 'schooldb_gemini_discovered_models',
        chatHistory: 'schooldb_ai_chat_history'
    },
    defaultModel: 'auto',
    fallbackModels: [
        'gemini-2.0-flash',
        'gemini-2.0-flash-thinking-exp-01-21',
        'gemini-2.0-pro-exp-02-05',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-pro'
    ],
    apiVersions: ['v1beta', 'v1'],

    chatMessages: [],
    currentInlineResult: null,
    lastInlineAction: null,
    lastUsedModel: null,
    activeQuiz: null,
    currentQuizIndex: 0,
    quizScore: 0,
    userAnswers: [],

    cleanModelName(name) {
        if (!name) return 'auto';
        if (name === 'auto' || name === 'smart') return 'auto';
        return String(name).replace(/^models\//, '').trim();
    },

    getDiscoveredModels() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEYS.discoveredModels);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return null;
    },

    setDiscoveredModels(models) {
        try {
            if (Array.isArray(models) && models.length > 0) {
                localStorage.setItem(this.STORAGE_KEYS.discoveredModels, JSON.stringify(models));
            }
        } catch (e) {}
    },

    // Điều phối thông minh mô hình phù hợp nhất theo tính chất tác vụ
    resolveModelForTask(taskType) {
        const mode = this.getModel();
        if (mode && mode !== 'auto' && mode !== 'smart') {
            return this.cleanModelName(mode);
        }

        // Tác vụ tư duy sâu / phân tích chuyên sâu
        const deepTasks = ['sentence_tutor', 'explain_code', 'explain_concept', 'improve', 'summarize', 'chat'];
        if (deepTasks.includes(taskType)) {
            return this.getBestDeepModel();
        }

        // Mặc định cho tác vụ nhanh (tra từ vựng, tạo bài quiz, dịch ngắn, sửa chính tả)
        return this.getBestFastModel();
    },

    getBestDeepModel() {
        const discovered = this.getDiscoveredModels();
        const deepCandidates = [
            'gemini-2.0-flash-thinking-exp-01-21',
            'gemini-2.0-flash-thinking-exp',
            'gemini-2.0-pro-exp-02-05',
            'gemini-2.0-pro-exp',
            'gemini-1.5-pro',
            'gemini-1.5-pro-latest',
            'gemini-2.0-flash'
        ];

        if (discovered && discovered.length > 0) {
            for (const cand of deepCandidates) {
                if (discovered.includes(cand)) return cand;
            }
            const anyThinking = discovered.find(m => m.includes('thinking'));
            if (anyThinking) return anyThinking;
            const anyPro = discovered.find(m => m.includes('pro'));
            if (anyPro) return anyPro;
        }

        return 'gemini-2.0-flash-thinking-exp-01-21';
    },

    getBestFastModel() {
        const discovered = this.getDiscoveredModels();
        const fastCandidates = [
            'gemini-2.0-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash-002',
            'gemini-1.5-flash-001',
            'gemini-2.0-flash-exp'
        ];

        if (discovered && discovered.length > 0) {
            for (const cand of fastCandidates) {
                if (discovered.includes(cand)) return cand;
            }
            const anyFlash = discovered.find(m => m.includes('flash') && !m.includes('thinking'));
            if (anyFlash) return anyFlash;
        }

        return 'gemini-2.0-flash';
    },

    getModelDisplayName(model) {
        const m = model || this.getModel();
        if (m === 'auto' || m === 'smart') return '🤖 Tự động thông minh (Smart Router)';
        const clean = this.cleanModelName(m);
        if (clean.includes('thinking')) return '🧠 Gemini 2.0 Flash Thinking';
        if (clean.includes('2.0-pro')) return '👑 Gemini 2.0 Pro';
        if (clean.includes('2.0-flash')) return '⚡ Gemini 2.0 Flash';
        if (clean.includes('1.5-pro')) return '📚 Gemini 1.5 Pro';
        if (clean.includes('1.5-flash')) return '🛡️ Gemini 1.5 Flash';
        if (clean.includes('pro')) return 'Gemini Pro';
        return clean;
    },

    pickBestModel(modelsList) {
        if (!modelsList || !modelsList.length) return this.defaultModel;
        for (const pref of this.fallbackModels) {
            if (modelsList.includes(pref)) return pref;
        }
        const flash = modelsList.find(m => m.includes('flash') && !m.includes('thinking'));
        if (flash) return flash;
        const anyFlash = modelsList.find(m => m.includes('flash'));
        if (anyFlash) return anyFlash;
        const pro = modelsList.find(m => m.includes('pro'));
        if (pro) return pro;
        return modelsList[0];
    },

    updateModelSelectUI(models = null) {
        const select = document.getElementById('setting-gemini-model');
        const current = this.getModel();
        const discovered = models || this.getDiscoveredModels();

        if (select) {
            select.innerHTML = '';

            // Tùy chọn Tự động thông minh
            const autoOpt = document.createElement('option');
            autoOpt.value = 'auto';
            autoOpt.textContent = '🤖 Tự động thông minh (Khuyên dùng - Nhanh cho việc nhẹ, Tư duy sâu cho việc nặng)';
            if (current === 'auto') autoOpt.selected = true;
            select.appendChild(autoOpt);

            // Các mô hình chuẩn
            const presetModels = [
                { id: 'gemini-2.0-flash', label: '⚡ Gemini 2.0 Flash (Ghim cố định - Siêu tốc độ)' },
                { id: 'gemini-2.0-flash-thinking-exp-01-21', label: '🧠 Gemini 2.0 Flash Thinking (Ghim cố định - Suy nghĩ từng bước)' },
                { id: 'gemini-2.0-pro-exp-02-05', label: '👑 Gemini 2.0 Pro Experimental (Ghim cố định - Flagship mạnh nhất)' },
                { id: 'gemini-1.5-pro', label: '📚 Gemini 1.5 Pro (Ghim cố định - Cửa sổ 2M tokens)' },
                { id: 'gemini-1.5-flash', label: '🛡️ Gemini 1.5 Flash (Ghim cố định - Ổn định cơ bản)' }
            ];

            const presetIds = presetModels.map(p => p.id);
            if (discovered && Array.isArray(discovered)) {
                discovered.forEach(d => {
                    if (!presetIds.includes(d)) {
                        presetModels.push({ id: d, label: `🔹 ${d} (Từ tài khoản của bạn)` });
                    }
                });
            }

            presetModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.label;
                if (current === m.id) opt.selected = true;
                select.appendChild(opt);
            });
        }

        const badge = document.getElementById('ai-sidebar-model-badge');
        if (badge) {
            badge.textContent = this.getModelDisplayName(current);
        }
    },

    getApiKey() {
        if (typeof localStorage === 'undefined') return '';
        return (localStorage.getItem(this.STORAGE_KEYS.apiKey) || '').trim();
    },

    setApiKey(key) {
        if (typeof localStorage === 'undefined') return;
        localStorage.setItem(this.STORAGE_KEYS.apiKey, (key || '').trim());
    },

    getModel() {
        if (typeof localStorage === 'undefined') return this.defaultModel;
        const stored = localStorage.getItem(this.STORAGE_KEYS.model);
        if (!stored) return 'auto';
        if (stored === 'auto') return 'auto';
        return this.cleanModelName(stored) || 'auto';
    },

    setModel(model) {
        if (!model) return;
        const clean = this.cleanModelName(model);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.STORAGE_KEYS.model, clean);
        }
        if (typeof document !== 'undefined') {
            const badge = document.getElementById('ai-sidebar-model-badge');
            if (badge) badge.textContent = this.getModelDisplayName(clean);
            const select = document.getElementById('setting-gemini-model');
            if (select && select.value !== clean) select.value = clean;
        }
    },

    hasKey() {
        return this.getApiKey().length > 10;
    },

    // Kiểm tra và hiển thị modal nhập API Key nếu chưa có
    ensureApiKey() {
        if (this.hasKey()) return true;
        this.openApiKeyModal();
        return false;
    },

    openApiKeyModal() {
        let modal = document.getElementById('ai-key-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ai-key-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content ai-key-modal-content">
                    <div class="modal-header">
                        <h3><i class="ri-sparkling-fill" style="color: #60a5fa;"></i> Kích hoạt Trí tuệ nhân tạo (Gemini AI)</h3>
                        <button class="modal-close-btn" onclick="document.getElementById('ai-key-modal').style.display='none'"><i class="ri-close-line"></i></button>
                    </div>
                    <div class="modal-body" style="padding: 12px 0;">
                        <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
                            School NoteBook sử dụng <strong>Google Gemini API</strong> (Gemini 2.0 Flash) hoàn toàn <strong>miễn phí</strong> với tốc độ cực nhanh, hỗ trợ tiếng Việt & tiếng Anh chuyên sâu.
                        </p>
                        <div class="ai-key-guide-box">
                            <i class="ri-information-line"></i>
                            <div>
                                <span>Lấy API Key miễn phí 100% trong 30 giây:</span>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="color: var(--accent); font-weight: 600; text-decoration: underline;">
                                    Truy cập Google AI Studio <i class="ri-external-link-line"></i>
                                </a>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 14px;">
                            <label style="font-weight: 600; font-size: 12.5px;">Google Gemini API Key <span style="color:#ef4444;">*</span></label>
                            <div style="position: relative;">
                                <input type="password" id="modal-gemini-key-input" placeholder="AIzaSy..." style="width: 100%; padding-right: 40px; font-family: monospace;">
                                <button type="button" class="btn-toggle-key-visibility" onclick="aiService.toggleKeyVisibility('modal-gemini-key-input', this)" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-placeholder); cursor: pointer;">
                                    <i class="ri-eye-line"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('ai-key-modal').style.display='none'">Để sau</button>
                        <button type="button" class="btn btn-primary" onclick="aiService.saveKeyFromModal()">Lưu & Kích hoạt</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        const input = document.getElementById('modal-gemini-key-input');
        if (input) input.value = this.getApiKey();
        modal.style.display = 'flex';
        if (input) setTimeout(() => input.focus(), 60);
    },

    toggleKeyVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (btn) btn.innerHTML = '<i class="ri-eye-off-line"></i>';
        } else {
            input.type = 'password';
            if (btn) btn.innerHTML = '<i class="ri-eye-line"></i>';
        }
    },

    saveKeyFromModal() {
        const input = document.getElementById('modal-gemini-key-input');
        const key = input ? input.value.trim() : '';
        if (!key) {
            showToast('⚠️ Vui lòng nhập API Key để tiếp tục.');
            return;
        }
        this.setApiKey(key);
        const modal = document.getElementById('ai-key-modal');
        if (modal) modal.style.display = 'none';
        
        // Sync into settings modal if open
        const settingInput = document.getElementById('setting-gemini-api-key');
        if (settingInput) settingInput.value = key;

        showToast('✅ Đã lưu Gemini API Key! Đang kiểm tra kết nối...');
        this.testConnection(key);
    },

    // Tự động truy vấn ModelService.ListModels từ Google để xác định các model khả dụng cho API Key
    async discoverAvailableModels(apiKey = null, force = false) {
        const key = (apiKey || this.getApiKey()).trim();
        if (!key) return { success: false, error: 'Chưa cấu hình API Key' };

        if (!force) {
            const cached = this.getDiscoveredModels();
            if (cached && cached.length > 0) {
                return { success: true, models: cached, fromCache: true };
            }
        }

        let lastErr = null;
        let lastStatus = 0;

        for (const ver of this.apiVersions) {
            try {
                const url = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(key)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && Array.isArray(data.models)) {
                        const valid = data.models
                            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                            .map(m => this.cleanModelName(m.name))
                            .filter(name => name.startsWith('gemini'));
                        
                        if (valid.length > 0) {
                            this.setDiscoveredModels(valid);
                            this.updateModelSelectUI(valid);
                            return { success: true, models: valid, apiVersion: ver };
                        }
                    }
                } else {
                    lastStatus = res.status;
                    const errData = await res.json().catch(() => ({}));
                    lastErr = errData?.error?.message || `HTTP ${res.status}`;
                }
            } catch (netErr) {
                lastErr = netErr.message;
            }
        }

        return { success: false, error: lastErr, status: lastStatus };
    },

    // Gọi endpoint đơn lẻ với một API Version và Model cụ thể
    async _callGeminiSingle(apiVersion, model, apiKey, prompt, systemInstruction, options = {}) {
        const cleanModel = this.cleanModelName(model);
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const bodyData = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: options.temperature !== undefined ? options.temperature : 0.7,
                topK: 40,
                topP: 0.95
            }
        };

        // System instruction hỗ trợ trên gemini-1.5 và gemini-2.0
        if (systemInstruction) {
            if (cleanModel.startsWith('gemini-1.0') || cleanModel === 'gemini-pro') {
                bodyData.contents[0].parts[0].text = `${systemInstruction}\n\n---\n\n${prompt}`;
            } else {
                bodyData.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }
        }

        if (options.jsonMode && !cleanModel.startsWith('gemini-1.0') && cleanModel !== 'gemini-pro') {
            bodyData.generationConfig.responseMimeType = 'application/json';
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            const errMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            const err = new Error(errMsg);
            err.status = res.status;
            err.code = errJson?.error?.code || res.status;
            err.details = errJson?.error;
            err.model = cleanModel;
            err.apiVersion = apiVersion;
            throw err;
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || '';
        return text;
    },

    formatErrorMessage(err) {
        if (!err) return 'Không thể kết nối đến Gemini AI. Vui lòng kiểm tra lại kết nối mạng.';
        const msg = String(err.message || err);
        const status = err.status || err.code;

        if (status === 400 && msg.toLowerCase().includes('api_key_invalid')) {
            return 'API Key không hợp lệ. Vui lòng kiểm tra lại mã API Key từ Google AI Studio.';
        }
        if (status === 403 || msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('permission_denied') || msg.toLowerCase().includes('service_blocked')) {
            return 'API Key này chưa được cấp quyền Generative Language API (thường do dùng nhầm Firebase Web Key hoặc Google Cloud Key bị hạn chế). Vui lòng tạo key mới miễn phí tại Google AI Studio (https://aistudio.google.com/app/apikey).';
        }
        if (status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
            return 'Đã đạt giới hạn tần suất gọi API miễn phí (Rate limit). Vui lòng đợi 30 giây rồi thử lại.';
        }
        if (status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported')) {
            // Tự động gỡ bỏ thiết lập lỗi và trả về chế độ Tự động thông minh
            this.setModel('auto');
            return `Mô hình AI (${err.model || 'Gemini'}) chưa khả dụng hoặc đã dừng hỗ trợ đối với API Key này. Hệ thống đã tự động chuyển sang mô hình Gemini 2.0 Flash mới nhất. Vui lòng bấm "Thử lại"!`;
        }
        return msg;
    },

    // Gọi API tới Google Gemini REST API với khả năng tự động fallback đa endpoint (v1beta / v1) và tự dò model phù hợp
    async generateContent(prompt, systemInstruction = '', options = {}) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            this.openApiKeyModal();
            throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key để sử dụng.');
        }

        const requestedModel = options.model || this.resolveModelForTask(options.task);
        const primaryModel = this.cleanModelName(requestedModel);
        this.lastUsedModel = primaryModel;

        // Chuỗi thử nghiệm 1: Model chính qua v1beta rồi v1
        const initialAttempts = [
            { apiVersion: 'v1beta', model: primaryModel },
            { apiVersion: 'v1', model: primaryModel }
        ];

        let lastError = null;

        for (const attempt of initialAttempts) {
            try {
                const res = await this._callGeminiSingle(
                    attempt.apiVersion,
                    attempt.model,
                    apiKey,
                    prompt,
                    systemInstruction,
                    options
                );
                this.lastUsedModel = attempt.model;
                return res;
            } catch (err) {
                lastError = err;
                // Nếu là lỗi 403 (bị chặn quyền) hoặc 400 (sai key), không thử thêm endpoint khác
                if (err.status === 403) break;
            }
        }

        // Nếu model chính trả về 404 / "not found" / "not supported" trên cả 2 version:
        const isNotFoundOrUnsupported = lastError && (
            lastError.status === 404 ||
            (lastError.message && (
                lastError.message.toLowerCase().includes('not found') ||
                lastError.message.toLowerCase().includes('not supported')
            ))
        );

        if (isNotFoundOrUnsupported) {
            console.warn(`Model "${primaryModel}" không khả dụng cho key này (${lastError.message}). Đang tự động quét model hợp lệ...`);
            
            // Tự động quét ModelService.ListModels từ Google
            const discovery = await this.discoverAvailableModels(apiKey, true);
            let candidateModels = [];

            if (discovery.success && discovery.models && discovery.models.length > 0) {
                // Lọc bỏ model vừa lỗi và sắp xếp theo độ ưu tiên
                candidateModels = discovery.models.filter(m => m !== primaryModel);
                candidateModels.sort((a, b) => {
                    const idxA = this.fallbackModels.indexOf(a);
                    const idxB = this.fallbackModels.indexOf(b);
                    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                });
            }

            // Danh sách fallback dựng sẵn phòng trường hợp ListModels bị chặn
            if (candidateModels.length === 0) {
                candidateModels = this.fallbackModels.filter(m => m !== primaryModel);
            }

            // Thử lần lượt các model ứng viên trên cả v1beta và v1
            for (const fallbackModel of candidateModels) {
                for (const ver of this.apiVersions) {
                    try {
                        console.info(`Đang thử nghiệm model "${fallbackModel}" trên ${ver}...`);
                        const result = await this._callGeminiSingle(
                            ver,
                            fallbackModel,
                            apiKey,
                            prompt,
                            systemInstruction,
                            options
                        );
                        // Thành công!
                        console.info(`Tự động phục hồi thành công! Đã chuyển sang model "${fallbackModel}".`);
                        this.lastUsedModel = fallbackModel;
                        if (this.getModel() !== 'auto') {
                            this.setModel(fallbackModel);
                            this.updateModelSelectUI();
                        }
                        return result;
                    } catch (fbErr) {
                        lastError = fbErr;
                        if (fbErr.status === 403) break;
                    }
                }
            }
        }

        // Định dạng thông báo lỗi dễ hiểu và có chỉ dẫn cụ thể
        const friendlyMsg = this.formatErrorMessage(lastError);
        throw new Error(friendlyMsg);
    },

    // Kiểm tra kết nối API Key và tự động dò tìm danh sách mô hình
    async testConnection(testKey = null) {
        const key = (testKey || this.getApiKey()).trim();
        const statusEl = document.getElementById('ai-connection-status');
        if (statusEl) {
            statusEl.innerHTML = '<span style="color: var(--accent);"><i class="ri-loader-4-line ri-spin"></i> Đang kết nối và quét danh sách mô hình từ Google...</span>';
        }

        if (!key) {
            if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444;"><i class="ri-error-warning-line"></i> Vui lòng nhập API Key trước khi kiểm tra.</span>';
            return false;
        }

        try {
            const res = await this.discoverAvailableModels(key, true);

            if (res.success && res.models && res.models.length > 0) {
                let activeModel = this.getModel();
                if (activeModel === 'auto') {
                    activeModel = this.resolveModelForTask('vocab_autofill');
                } else if (!res.models.includes(activeModel)) {
                    activeModel = this.pickBestModel(res.models);
                    this.setModel(activeModel);
                }
                this.updateModelSelectUI(res.models);

                // Thử tạo một đoạn test ngắn để xác thực 100%
                for (const ver of this.apiVersions) {
                    try {
                        await this._callGeminiSingle(ver, activeModel, key, 'Hi', '', { temperature: 0.1 });
                        break;
                    } catch (e) {
                        // Tiếp tục thử version tiếp theo
                    }
                }

                if (statusEl) {
                    const modeDesc = this.getModel() === 'auto' 
                        ? 'Chế độ: <strong>Tự động thông minh</strong> (Flash cho việc nhanh, Thinking/Pro cho việc sâu)'
                        : `Mô hình ghim: <strong>${activeModel}</strong>`;
                    statusEl.innerHTML = `
                        <div style="color: #10b981; font-weight: 500; margin-top: 4px; line-height: 1.4;">
                            <i class="ri-checkbox-circle-fill"></i> Kết nối thành công! Khả dụng <strong>${res.models.length}</strong> mô hình.<br>
                            <span style="font-size: 11.5px; color: var(--text-secondary);">${modeDesc}</span>
                        </div>
                    `;
                }
                return true;
            } else {
                const friendlyErr = this.formatErrorMessage({ status: res.status, message: res.error });
                if (statusEl) {
                    statusEl.innerHTML = `
                        <div style="color: #ef4444; margin-top: 4px; line-height: 1.4;">
                            <i class="ri-close-circle-fill"></i> <strong>Lỗi kết nối:</strong> ${escapeHtml(friendlyErr)}
                        </div>
                    `;
                }
                return false;
            }
        } catch (e) {
            if (statusEl) {
                statusEl.innerHTML = `<span style="color: #ef4444;"><i class="ri-close-circle-fill"></i> Không thể kết nối mạng: ${escapeHtml(e.message)}</span>`;
            }
            return false;
        }
    },

    // =========================================================================
    // 1. TÍNH NĂNG TỪ VỰNG & FLASHCARD
    // =========================================================================

    // 1-Click Tự động tra từ (Auto-fill Vocab with AI - Hỗ trợ Từ viết tắt/Acronym & Từ thông dụng)
    async autoFillVocab() {
        if (!this.ensureApiKey()) return;

        const acronymInput = document.getElementById('vocab-input-acronym') || document.getElementById('new-acronym-input');
        const wordInput = document.getElementById('vocab-input-word') || document.getElementById('new-word-input');
        const isAcronymCheck = document.getElementById('vocab-is-acronym') || document.getElementById('pocket-is-acronym');
        const phoneticInput = document.getElementById('vocab-input-phonetic') || document.getElementById('new-ipa-input');
        const meaningInput = document.getElementById('vocab-input-meaning') || document.getElementById('new-meaning-input');
        const exampleInput = document.getElementById('vocab-input-example') || document.getElementById('new-example-input');
        const tagInput = document.getElementById('vocab-input-tag') || document.getElementById('new-tag-input');
        const btn = document.getElementById('btn-vocab-ai-fill') || document.getElementById('btn-vocab-ai-fill-pocket');

        let word = '';
        if (acronymInput && acronymInput.value.trim()) {
            word = acronymInput.value.trim();
        } else if (wordInput && wordInput.value.trim()) {
            word = wordInput.value.trim();
        }

        if (!word) {
            showToast('⚠️ Vui lòng nhập từ hoặc cụm từ tiếng Anh trước.');
            if (wordInput) wordInput.focus();
            return;
        }

        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Đang tra...';
        }

        const prompt = `Bạn là từ điển Anh-Việt chuyên sâu và chuyên gia về thuật ngữ công nghệ, từ viết tắt kỹ thuật (Acronym/Abbreviation). Hãy tra cứu từ/cụm từ tiếng Anh sau: "${word}".
QUY TẮC PHÂN TÍCH:
- Nếu "${word}" là một từ viết tắt (Acronym / Abbreviation) trong công nghệ, kỹ thuật, xe hơi ô tô hoặc giao tiếp (ví dụ: MHU, ECU, OTA, API, CAN, RAM, CPU, HTML, IoT, ADAS, HVAC, v.v.):
  + "fullform": Cụm từ tiếng Anh viết đầy đủ (ví dụ: "Media Head Unit", "Electronic Control Unit", "Over-The-Air", "Application Programming Interface").
  + "tag": Bắt buộc chọn "Acronym".
  + "meaning": Nghĩa tiếng Việt chính xác, súc tích và nêu rõ ngữ cảnh chuyên ngành (ví dụ: "Đầu phát đa phương tiện trên ô tô (thiết bị điều khiển màn hình và âm thanh giải trí)").
  + "phonetic": Phiên âm cách đọc chữ cái hoặc từ (ví dụ: "/ˌem.eɪtʃˈjuː/").
  + "example": 1 câu ví dụ tiếng Anh thực tế trong kỹ thuật/công việc kèm bản dịch tiếng Việt trong ngoặc đơn.
- Nếu "${word}" là từ vựng bình thường (không phải từ viết tắt):
  + "fullform": Để chuỗi rỗng "".
  + "tag": Chọn 1 trong 4 giá trị: 'TechAdvanced' (kỹ thuật chuyên sâu), 'TechCommon' (kỹ thuật IT thông dụng), 'TOEIC' (công sở/kinh doanh), 'Other' (khác).
  + "meaning": Nghĩa tiếng Việt chính xác, súc tích, tự nhiên.
  + "phonetic": Phiên âm IPA chuẩn quốc tế.
  + "example": 1 câu ví dụ thực tế kèm bản dịch tiếng Việt trong ngoặc đơn.

Hãy trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm giải thích ngoài JSON) theo cấu trúc:
{
  "fullform": "cụm từ tiếng Anh viết đầy đủ nếu là từ viết tắt, hoặc để rỗng",
  "phonetic": "phiên âm IPA hoặc đọc từng chữ cái",
  "tag": "chọn 1 trong 5 giá trị: 'Acronym', 'TechAdvanced', 'TechCommon', 'TOEIC', 'Other'",
  "meaning": "nghĩa tiếng Việt chính xác, súc tích, tự nhiên",
  "example": "1 câu ví dụ tiếng Anh thực tế kèm bản dịch tiếng Việt trong ngoặc đơn"
}`;

        try {
            const raw = await this.generateContent(prompt, 'Trả về JSON thuần tuý hợp lệ.', { jsonMode: true, task: 'vocab_autofill' });
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (pe) {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }

            if (!parsed) throw new Error('Không thể phân tích dữ liệu trả về từ AI.');

            if (parsed.fullform) {
                if (isAcronymCheck) {
                    isAcronymCheck.checked = true;
                    if (typeof vocab !== 'undefined' && vocab.toggleAcronymMode) vocab.toggleAcronymMode(true);
                    else if (typeof togglePocketAcronymMode === 'function') togglePocketAcronymMode(true);
                }
                if (acronymInput) acronymInput.value = word;
                if (wordInput) wordInput.value = parsed.fullform;
            } else {
                if (isAcronymCheck) {
                    isAcronymCheck.checked = false;
                    if (typeof vocab !== 'undefined' && vocab.toggleAcronymMode) vocab.toggleAcronymMode(false);
                    else if (typeof togglePocketAcronymMode === 'function') togglePocketAcronymMode(false);
                }
                if (wordInput) wordInput.value = word;
            }

            if (phoneticInput && parsed.phonetic) phoneticInput.value = parsed.phonetic;
            if (meaningInput && parsed.meaning) meaningInput.value = parsed.meaning;
            if (exampleInput && parsed.example) exampleInput.value = parsed.example;
            if (tagInput && parsed.tag && ['Acronym', 'TechAdvanced', 'TechCommon', 'TOEIC', 'Other'].includes(parsed.tag)) {
                tagInput.value = parsed.tag;
            }

            const successMsg = parsed.fullform 
                ? `✨ Đã tra từ viết tắt "${word}": ${parsed.fullform}!`
                : `✨ Đã tự động tra cứu từ "${word}" thành công!`;
            showToast(successMsg);
            if (meaningInput) meaningInput.focus();
        } catch (err) {
            console.error('AutoFill Vocab error:', err);
            showToast(`❌ Lỗi tra từ: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }
    },

    // Tự động tạo phiên âm IPA hàng loạt cho danh sách từ vựng (Bulk Phonetics Generator)
    async generateBatchPhonetics(wordList) {
        if (!this.ensureApiKey()) return {};
        if (!wordList || wordList.length === 0) return {};

        const prompt = `Bạn là chuyên gia từ điển Anh-Việt và ngữ âm học quốc tế IPA.
Hãy cung cấp phiên âm IPA chuẩn xác cho danh sách các từ/từ viết tắt tiếng Anh sau:
${JSON.stringify(wordList)}

QUY TẮC:
- Với từ thông dụng: trả về phiên âm IPA quốc tế chuẩn Anh-Mỹ (ví dụ: "Resilience" -> "/rɪˈzɪl.jəns/", "Include" -> "/ɪnˈkluːd/", "Microcontroller" -> "/ˌmaɪ.kroʊ.kənˈtroʊ.lɚ/").
- Với từ viết tắt (Acronym như "MHU", "ECU", "OTA", "API"): trả về cách đọc phát âm từng chữ cái (ví dụ: "MHU" -> "/ˌem.eɪtʃˈjuː/", "ECU" -> "/ˌiː.siːˈjuː/", "API" -> "/ˌeɪ.piːˈaɪ/").

Hãy trả về DUY NHẤT một JSON Object dạng key-value: { "từ": "/phiên_âm_ipa/" }. Không kèm văn bản giải thích ngoài JSON.`;

        try {
            const raw = await this.generateContent(prompt, 'Trả về JSON thuần tuý hợp lệ.', { jsonMode: true, task: 'batch_phonetics' });
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (pe) {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }
            return parsed || {};
        } catch (err) {
            console.error('Batch phonetics error:', err);
            showToast(`⚠️ Không thể tạo phiên âm bằng AI: ${err.message}`);
            return {};
        }
    },

    // AI Gia sư chấm bài luyện đặt câu (AI Sentence Tutor)
    openSentenceTutor(vocabId) {
        if (!this.ensureApiKey()) return;

        const item = vocab.items.find(i => i.id === vocabId);
        if (!item) {
            showToast('Không tìm thấy từ vựng này.');
            return;
        }

        let modal = document.getElementById('ai-tutor-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ai-tutor-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content ai-tutor-modal-content">
                    <div class="modal-header">
                        <h3><i class="ri-sparkling-fill" style="color: #60a5fa;"></i> AI Gia sư: Luyện đặt câu tiếng Anh</h3>
                        <button class="modal-close-btn" onclick="document.getElementById('ai-tutor-modal').style.display='none'"><i class="ri-close-line"></i></button>
                    </div>
                    <div class="modal-body">
                        <div class="tutor-target-card" id="tutor-target-card">
                            <!-- Injected by JS -->
                        </div>

                        <div class="form-group" style="margin-top: 14px;">
                            <label style="font-weight: 600; font-size: 13px;">Câu tiếng Anh của bạn với từ này:</label>
                            <textarea id="tutor-user-sentence" rows="3" placeholder="Nhập câu tiếng Anh bạn tự đặt ở đây... (ví dụ: The team applied a resilient pattern to survive traffic spikes.)" style="width: 100%; border-radius: 8px;"></textarea>
                        </div>

                        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                            <button type="button" class="btn btn-primary" id="btn-tutor-submit" onclick="aiService.submitSentenceToTutor()">
                                <i class="ri-sparkling-fill"></i> Chấm điểm & Nhận xét
                            </button>
                        </div>

                        <div class="tutor-feedback-area" id="tutor-feedback-area" style="display: none; margin-top: 14px;">
                            <!-- Injected result -->
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        this.activeTutorVocab = item;
        const targetCard = document.getElementById('tutor-target-card');
        if (targetCard) {
            targetCard.innerHTML = `
                <div style="display: flex; align-items: baseline; justify-content: space-between;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${escapeHtml(item.word)}</div>
                    <div style="font-size: 13px; color: var(--accent); font-family: monospace;">${escapeHtml(item.phonetic || '')}</div>
                </div>
                <div style="font-size: 13.5px; color: var(--text-secondary); margin-top: 4px;"><strong>Nghĩa:</strong> ${escapeHtml(item.meaning)}</div>
                ${item.example ? `<div style="font-size: 12px; color: var(--text-placeholder); margin-top: 4px; font-style: italic;">Gợi ý mẫu: ${escapeHtml(item.example)}</div>` : ''}
            `;
        }

        const sentenceInput = document.getElementById('tutor-user-sentence');
        if (sentenceInput) sentenceInput.value = '';

        const feedbackArea = document.getElementById('tutor-feedback-area');
        if (feedbackArea) {
            feedbackArea.style.display = 'none';
            feedbackArea.innerHTML = '';
        }

        modal.style.display = 'flex';
        if (sentenceInput) setTimeout(() => sentenceInput.focus(), 60);
    },

    async submitSentenceToTutor() {
        if (!this.activeTutorVocab) return;
        const input = document.getElementById('tutor-user-sentence');
        const feedbackArea = document.getElementById('tutor-feedback-area');
        const btn = document.getElementById('btn-tutor-submit');

        const userSentence = input ? input.value.trim() : '';
        if (!userSentence) {
            showToast('⚠️ Vui lòng nhập câu tiếng Anh của bạn.');
            if (input) input.focus();
            return;
        }

        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> AI đang chấm bài...';
        }

        const item = this.activeTutorVocab;
        const prompt = `Bạn là giáo viên tiếng Anh bản xứ chấm bài đặt câu của học viên.
Từ vựng mục tiêu: "${item.word}" (Nghĩa: "${item.meaning}").
Câu của học viên: "${userSentence}".

Hãy chấm điểm và đánh giá chi tiết. Trả về DUY NHẤT một chuỗi JSON hợp lệ theo định dạng:
{
  "score": 9.0, // Thang điểm 10 (số thực từ 1.0 đến 10.0)
  "evaluation": "nhận xét ngắn gọn tiếng Việt (1-2 câu) về ngữ pháp, cách dùng từ và độ tự nhiên",
  "correctedSentence": "câu hoàn chỉnh đã được sửa lỗi chính tả, ngữ pháp (nếu câu của học viên đã chuẩn thì giữ nguyên)",
  "naturalAlternative": "câu viết lại tự nhiên hơn chuẩn phong cách người bản xứ / chuyên nghiệp",
  "translation": "bản dịch tiếng Việt của câu đã sửa"
}`;

        try {
            const raw = await this.generateContent(prompt, 'Trả về JSON thuần tuý hợp lệ.', { jsonMode: true, task: 'sentence_tutor' });
            let parsed = null;
            try {
                parsed = JSON.parse(raw);
            } catch (pe) {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }

            if (!parsed) throw new Error('Không thể phân tích phản hồi chấm điểm.');

            const score = typeof parsed.score === 'number' ? parsed.score : 8;
            const scoreColor = score >= 8.5 ? '#10b981' : (score >= 6.5 ? '#f59e0b' : '#ef4444');

            if (feedbackArea) {
                const modelBadge = this.lastUsedModel ? `
                    <div style="font-size: 11px; color: var(--text-placeholder); margin-top: 8px; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                        <i class="ri-sparkling-fill" style="color: #60a5fa;"></i> Đã chấm bởi: <strong>${escapeHtml(this.getModelDisplayName(this.lastUsedModel))}</strong>
                    </div>
                ` : '';

                feedbackArea.innerHTML = `
                    <div class="tutor-result-card">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 10px;">
                            <span style="font-weight: 700; font-size: 14px;"><i class="ri-award-line"></i> Kết quả chấm bài:</span>
                            <span class="tutor-score-badge" style="background: ${scoreColor}; color: white; padding: 3px 10px; border-radius: 20px; font-weight: 700; font-size: 14px;">${score} / 10</span>
                        </div>
                        <div style="margin-bottom: 8px; font-size: 13.5px; color: var(--text-primary); line-height: 1.45;">
                            <strong>Nhận xét:</strong> ${escapeHtml(parsed.evaluation || 'Tốt!')}
                        </div>
                        <div style="margin-bottom: 8px; font-size: 13.5px; background: var(--bg-surface); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                            <div style="font-size: 11.5px; font-weight: 600; color: #10b981; text-transform: uppercase;">Câu chuẩn đã sửa:</div>
                            <div style="font-weight: 600; margin-top: 2px;">${escapeHtml(parsed.correctedSentence || userSentence)}</div>
                            <div style="font-size: 12px; color: var(--text-placeholder); margin-top: 3px; font-style: italic;">${escapeHtml(parsed.translation || '')}</div>
                        </div>
                        ${parsed.naturalAlternative ? `
                        <div style="font-size: 13px; background: rgba(96, 165, 250, 0.12); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #60a5fa;">
                            <div style="font-size: 11.5px; font-weight: 600; color: #60a5fa; text-transform: uppercase;">Gợi ý câu phong cách bản xứ:</div>
                            <div style="font-weight: 500; margin-top: 2px;">${escapeHtml(parsed.naturalAlternative)}</div>
                        </div>
                        ` : ''}
                        ${modelBadge}
                    </div>
                `;
                feedbackArea.style.display = 'block';
            }
            showToast(`🎉 Chấm điểm hoàn tất: ${score}/10!`);
        } catch (err) {
            console.error('Tutor submit error:', err);
            showToast(`❌ Lỗi chấm bài: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }
    },

    // AI Tự động tạo bài tập trắc nghiệm Flashcard (AI Quiz Mode)
    async startVocabQuiz(count = 5) {
        if (!this.ensureApiKey()) return;

        if (!vocab.items || vocab.items.length < 3) {
            showToast('⚠️ Bạn cần có ít nhất 3 từ vựng trong kho để tạo bài trắc nghiệm.');
            return;
        }

        const quizContainer = document.getElementById('vocab-quiz-container');
        if (!quizContainer) return;

        quizContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <i class="ri-sparkling-fill ri-spin" style="font-size: 36px; color: var(--accent);"></i>
                <div style="font-size: 16px; font-weight: 600; margin-top: 14px;">Gemini AI đang soạn bộ câu hỏi trắc nghiệm...</div>
                <div style="font-size: 13px; color: var(--text-placeholder); margin-top: 6px;">Dựa trên danh sách từ vựng cá nhân của bạn.</div>
            </div>
        `;

        // Lấy ngẫu nhiên từ vựng trong kho
        const shuffled = [...vocab.items].sort(() => 0.5 - Math.random());
        const sampleWords = shuffled.slice(0, Math.min(count * 2, 20)).map(w => ({
            word: w.word,
            fullform: w.fullform || '',
            meaning: w.meaning,
            tag: w.tag,
            example: w.example || ''
        }));

        const prompt = `Bạn là chuyên gia khảo thí tiếng Anh. Dựa trên danh sách các từ vựng sau:
${JSON.stringify(sampleWords, null, 2)}

Hãy soạn ${count} câu hỏi trắc nghiệm tiếng Anh thông minh giúp học viên kiểm tra khả năng nhớ từ.
Các dạng câu hỏi phong phú:
- Dạng 1: Chọn nghĩa tiếng Việt đúng của từ
- Dạng 2: Với từ viết tắt (Acronym có trường fullform): Hỏi dạng đầy đủ tiếng Anh (English Full Form) hoặc nghĩa chuyên ngành (ví dụ: "Trong ô tô/kỹ thuật, MHU là viết tắt của cụm từ nào?")
- Dạng 3: Điền từ thích hợp vào chỗ trống trong câu ví dụ
- Dạng 4: Chọn từ đồng nghĩa / ngữ cảnh phù hợp

Trả về DUY NHẤT một mảng JSON hợp lệ chứa ${count} câu hỏi theo định dạng:
[
  {
    "question": "Nội dung câu hỏi rõ ràng...",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "answer": 0, // số nguyên từ 0 đến 3 biểu thị chỉ số đáp án đúng trong mảng options
    "explanation": "Giải thích ngắn gọn bằng tiếng Việt tại sao đáp án này đúng"
  }
]`;

        try {
            const raw = await this.generateContent(prompt, 'Trả về JSON thuần tuý hợp lệ.', { jsonMode: true, task: 'vocab_quiz' });
            let questions = null;
            try {
                questions = JSON.parse(raw);
            } catch (pe) {
                const match = raw.match(/\[[\s\S]*\]/);
                if (match) questions = JSON.parse(match[0]);
            }

            if (!questions || !Array.isArray(questions) || questions.length === 0) {
                throw new Error('AI không trả về danh sách câu hỏi hợp lệ.');
            }

            this.activeQuiz = questions;
            this.currentQuizIndex = 0;
            this.quizScore = 0;
            this.userAnswers = [];

            this.renderQuizQuestion();
        } catch (err) {
            console.error('Quiz generate error:', err);
            quizContainer.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: #ef4444;">
                    <i class="ri-error-warning-line" style="font-size: 32px;"></i>
                    <div style="font-weight: 600; margin-top: 8px;">Không thể tạo bài trắc nghiệm: ${escapeHtml(err.message)}</div>
                    <button class="btn btn-secondary" onclick="aiService.startVocabQuiz(${count})" style="margin-top: 14px;">Thử lại</button>
                </div>
            `;
        }
    },

    renderQuizQuestion() {
        const container = document.getElementById('vocab-quiz-container');
        if (!container || !this.activeQuiz) return;

        const qIdx = this.currentQuizIndex;
        const total = this.activeQuiz.length;

        if (qIdx >= total) {
            // Render kết quả tổng kết
            this.renderQuizResults();
            return;
        }

        const q = this.activeQuiz[qIdx];
        const progressPct = ((qIdx + 1) / total) * 100;

        container.innerHTML = `
            <div class="quiz-card-wrapper">
                <div class="quiz-header-bar">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: var(--accent);">CÂU HỎI ${qIdx + 1} / ${total}</span>
                        <span style="font-size: 13px; color: var(--text-secondary); font-weight: 600;">Điểm hiện tại: ${this.quizScore}</span>
                    </div>
                    <div class="quiz-progress-track">
                        <div class="quiz-progress-fill" style="width: ${progressPct}%;"></div>
                    </div>
                </div>

                <div class="quiz-question-text">${escapeHtml(q.question)}</div>

                <div class="quiz-options-list">
                    ${q.options.map((opt, oIdx) => `
                        <button type="button" class="quiz-option-btn" data-index="${oIdx}" onclick="aiService.handleAnswerChoice(${oIdx})">
                            <span class="quiz-option-letter">${['A', 'B', 'C', 'D'][oIdx] || ''}</span>
                            <span class="quiz-option-text">${escapeHtml(opt)}</span>
                        </button>
                    `).join('')}
                </div>

                <div id="quiz-explanation-box" class="quiz-explanation-box" style="display: none;">
                    <!-- Explanation injected after answer -->
                </div>

                <div id="quiz-next-actions" style="display: none; justify-content: flex-end; margin-top: 16px;">
                    <button type="button" class="btn btn-primary" onclick="aiService.nextQuizQuestion()">
                        ${qIdx + 1 < total ? 'Câu tiếp theo <i class="ri-arrow-right-line"></i>' : 'Xem kết quả bài thi <i class="ri-trophy-line"></i>'}
                    </button>
                </div>
            </div>
        `;
    },

    handleAnswerChoice(chosenIdx) {
        if (!this.activeQuiz) return;
        const q = this.activeQuiz[this.currentQuizIndex];
        const optionBtns = document.querySelectorAll('.quiz-option-btn');
        optionBtns.forEach(btn => btn.disabled = true);

        const isCorrect = chosenIdx === q.answer;
        if (isCorrect) this.quizScore++;

        this.userAnswers.push({
            question: q.question,
            chosen: chosenIdx,
            correct: q.answer,
            isCorrect: isCorrect
        });

        optionBtns.forEach(btn => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            if (idx === q.answer) {
                btn.classList.add('correct');
            } else if (idx === chosenIdx && !isCorrect) {
                btn.classList.add('wrong');
            }
        });

        const explainBox = document.getElementById('quiz-explanation-box');
        if (explainBox) {
            explainBox.innerHTML = `
                <div style="font-weight: 700; color: ${isCorrect ? '#10b981' : '#ef4444'}; margin-bottom: 4px;">
                    <i class="${isCorrect ? 'ri-checkbox-circle-fill' : 'ri-close-circle-fill'}"></i> ${isCorrect ? 'Chính xác!' : 'Chưa đúng rồi!'}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.45;">${escapeHtml(q.explanation || '')}</div>
            `;
            explainBox.style.display = 'block';
        }

        const nextAction = document.getElementById('quiz-next-actions');
        if (nextAction) nextAction.style.display = 'flex';
    },

    nextQuizQuestion() {
        this.currentQuizIndex++;
        this.renderQuizQuestion();
    },

    renderQuizResults() {
        const container = document.getElementById('vocab-quiz-container');
        if (!container || !this.activeQuiz) return;

        const total = this.activeQuiz.length;
        const score = this.quizScore;
        const pct = Math.round((score / total) * 100);
        const trophyIcon = pct >= 80 ? '🏆' : (pct >= 50 ? '🌟' : '💪');

        container.innerHTML = `
            <div class="quiz-results-card">
                <div style="font-size: 48px; margin-bottom: 8px;">${trophyIcon}</div>
                <h2 style="margin: 0; font-size: 22px;">Hoàn thành bài kiểm tra!</h2>
                <div style="font-size: 14px; color: var(--text-secondary); margin-top: 6px;">Bạn đã trả lời đúng <strong>${score} / ${total}</strong> câu (${pct}%)</div>
                
                <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary" onclick="aiService.startVocabQuiz(${total})">
                        <i class="ri-refresh-line"></i> Làm bài kiểm tra khác
                    </button>
                    <button class="btn btn-secondary" onclick="vocab.switchView('list')">
                        <i class="ri-book-open-line"></i> Về kho từ vựng
                    </button>
                </div>
            </div>
        `;
    },

    // =========================================================================
    // 2. TÍNH NĂNG AI TRONG NOTE EDITOR
    // =========================================================================

    // Chạy các lệnh AI khi bôi đen văn bản
    async runInlineAction(actionType, text) {
        if (!this.ensureApiKey()) return;

        const selectedText = text || (window.getSelection() ? window.getSelection().toString().trim() : '');
        if (!selectedText) {
            showToast('⚠️ Vui lòng bôi đen đoạn văn bản cần xử lý.');
            return;
        }

        this.lastInlineAction = { actionType, text: selectedText };
        this.openInlineResultModal(actionType, selectedText);
        const resultContainer = document.getElementById('ai-inline-result-text');

        const deepTasks = ['sentence_tutor', 'explain_code', 'explain_concept', 'improve', 'summarize', 'chat'];
        const isDeep = deepTasks.includes(actionType);
        const resolvedModel = this.resolveModelForTask(actionType);
        const modelLabel = this.getModelDisplayName(resolvedModel);

        const loadingMsg = isDeep 
            ? `Gemini AI đang suy luận & phân tích chuyên sâu... (${modelLabel})`
            : `Gemini AI đang xử lý văn bản siêu tốc... (${modelLabel})`;

        if (resultContainer) {
            resultContainer.innerHTML = `
                <div style="text-align: center; padding: 24px; color: var(--accent);">
                    <i class="ri-loader-4-line ri-spin" style="font-size: 28px;"></i>
                    <div style="margin-top: 8px; font-weight: 600; font-size: 13.5px;">${escapeHtml(loadingMsg)}</div>
                    <div style="font-size: 12px; color: var(--text-placeholder); margin-top: 4px;">Tự động điều phối theo tính chất tác vụ</div>
                </div>
            `;
        }

        let prompt = '';
        let systemPrompt = 'Bạn là chuyên gia biên tập và trợ lý học tập xuất sắc.';

        switch (actionType) {
            case 'summarize':
                prompt = `Tóm tắt ngắn gọn, súc tích và mạch lạc đoạn văn bản sau bằng tiếng Việt:\n\n"""\n${selectedText}\n"""`;
                break;
            case 'improve':
                prompt = `Hãy viết lại đoạn văn bản sau cho tự nhiên, mượt mà, chuẩn văn phong hơn nhưng giữ nguyên ý nghĩa cốt lõi:\n\n"""\n${selectedText}\n"""`;
                break;
            case 'translate':
                prompt = `Hãy tự động phát hiện ngôn ngữ của đoạn văn bản sau: nếu là tiếng Việt hãy dịch sang tiếng Anh tự nhiên; nếu là tiếng Anh hãy dịch sang tiếng Việt chuẩn xác và tự nhiên:\n\n"""\n${selectedText}\n"""`;
                break;
            case 'grammar':
                prompt = `Hãy kiểm tra và sửa toàn bộ lỗi chính tả, ngữ pháp, diễn đạt trong đoạn văn bản sau. Trả về đoạn văn bản đã được sửa hoàn chỉnh:\n\n"""\n${selectedText}\n"""`;
                break;
            case 'explain_code':
                prompt = `Giải thích đoạn mã nguồn sau một cách dễ hiểu, chỉ ra luồng hoạt động chính và lưu ý quan trọng (nếu có):\n\n\`\`\`\n${selectedText}\n\`\`\``;
                break;
            case 'explain_concept':
                prompt = `Hãy giải thích thuật ngữ / khái niệm sau một cách dễ hiểu, trực quan, kèm ví dụ minh họa ngắn gọn:\n\n"${selectedText}"`;
                break;
            default:
                prompt = `Xử lý đoạn văn bản sau:\n\n"""\n${selectedText}\n"""`;
        }

        try {
            const aiOutput = await this.generateContent(prompt, systemPrompt, { task: actionType });
            this.currentInlineResult = {
                actionType: actionType,
                originalText: selectedText,
                aiOutput: aiOutput
            };

            const usedModelName = this.lastUsedModel || resolvedModel;
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: flex-end;">
                        <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(96, 165, 250, 0.12); color: #60a5fa; font-weight: 500;">
                            <i class="ri-sparkling-fill"></i> ${escapeHtml(this.getModelDisplayName(usedModelName))}
                        </span>
                    </div>
                    <div class="ai-rendered-output">${this.formatAiMarkdown(aiOutput)}</div>
                `;
            }
        } catch (err) {
            console.error('Inline action error:', err);
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div style="color: #ef4444; padding: 12px; line-height: 1.5;">
                        <div style="font-weight: 600; margin-bottom: 6px;"><i class="ri-error-warning-line"></i> Lỗi xử lý AI:</div>
                        <div style="font-size: 13px; margin-bottom: 12px; color: var(--text-primary); background: rgba(239, 68, 68, 0.08); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #ef4444;">
                            ${escapeHtml(err.message)}
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="btn btn-primary" onclick="aiService.setModel('auto'); aiService.retryLastInlineAction();" style="font-size: 12px; padding: 5px 12px;">
                                <i class="ri-sparkling-fill"></i> Tự động dùng Gemini 2.0 Flash & Thử lại
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="aiService.retryLastInlineAction()" style="font-size: 12px; padding: 5px 12px;">
                                <i class="ri-refresh-line"></i> Thử lại
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="aiService.openApiKeyModal()" style="font-size: 12px; padding: 5px 12px;">
                                <i class="ri-key-2-line"></i> Cấu hình lại Key
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    },

    retryLastInlineAction() {
        if (this.lastInlineAction) {
            this.runInlineAction(this.lastInlineAction.actionType, this.lastInlineAction.text);
        }
    },

    openInlineResultModal(actionType, originalText) {
        let modal = document.getElementById('ai-inline-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ai-inline-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content ai-inline-modal-content">
                    <div class="modal-header">
                        <h3 id="ai-inline-modal-title"><i class="ri-sparkling-fill" style="color: #60a5fa;"></i> Kết quả AI Assistant</h3>
                        <button class="modal-close-btn" onclick="document.getElementById('ai-inline-modal').style.display='none'"><i class="ri-close-line"></i></button>
                    </div>
                    <div class="modal-body" style="padding: 10px 0;">
                        <div class="ai-inline-result-text" id="ai-inline-result-text">
                            <!-- Injected by JS -->
                        </div>
                    </div>
                    <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('ai-inline-modal').style.display='none'">Đóng</button>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="btn btn-secondary" onclick="aiService.applyInlineResult('copy')" title="Sao chép nội dung">
                                <i class="ri-file-copy-line"></i> Sao chép
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="aiService.applyInlineResult('insertBelow')" title="Chèn xuống dòng bên dưới">
                                <i class="ri-text-wrap"></i> Chèn xuống dưới
                            </button>
                            <button type="button" class="btn btn-primary" onclick="aiService.applyInlineResult('replace')" title="Thay thế đoạn bôi đen ban đầu">
                                <i class="ri-check-line"></i> Thay thế chữ
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const titleMap = {
            summarize: '📝 Tóm tắt nội dung',
            improve: '✍️ Viết lại hay hơn',
            translate: '🌐 Dịch thuật Anh ↔ Việt',
            grammar: '🔤 Sửa lỗi chính tả & ngữ pháp',
            explain_code: '💻 Giải thích đoạn Code',
            explain_concept: '💡 Giải thích khái niệm'
        };

        const titleEl = document.getElementById('ai-inline-modal-title');
        if (titleEl) {
            titleEl.innerHTML = `<i class="ri-sparkling-fill" style="color: #60a5fa;"></i> ${titleMap[actionType] || 'Kết quả AI'}`;
        }

        modal.style.display = 'flex';
    },

    applyInlineResult(mode) {
        if (!this.currentInlineResult || !this.currentInlineResult.aiOutput) return;
        const output = this.currentInlineResult.aiOutput;

        if (mode === 'copy') {
            navigator.clipboard.writeText(output).then(() => {
                showToast('📋 Đã sao chép kết quả AI vào bộ nhớ tạm!');
            }).catch(() => {
                showToast('⚠️ Không thể sao chép tự động.');
            });
            return;
        }

        const modal = document.getElementById('ai-inline-modal');
        if (modal) modal.style.display = 'none';

        if (mode === 'replace') {
            document.execCommand('insertText', false, output);
            showToast('✅ Đã thay thế đoạn chữ bằng kết quả AI!');
            triggerSave();
        } else if (mode === 'insertBelow') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let container = range.commonAncestorContainer;
                if (container && container.nodeType === Node.TEXT_NODE) container = container.parentElement;
                const wrapper = container ? container.closest('.block-wrapper') : null;
                if (wrapper && wrapper.parentNode) {
                    const indent = parseInt(wrapper.getAttribute('data-indent') || '0', 10);
                    const newWrapper = createBlockElement('text', escapeHtml(output).replace(/\n/g, '<br>'), generateId(), indent);
                    wrapper.parentNode.insertBefore(newWrapper, wrapper.nextSibling);
                    triggerSave();
                    showToast('⬇️ Đã chèn kết quả AI xuống dòng bên dưới!');
                    return;
                }
            }
            // Fallback: paste at caret
            document.execCommand('insertText', false, '\n' + output);
            showToast('⬇️ Đã chèn kết quả AI!');
            triggerSave();
        }
    },

    // =========================================================================
    // 3. THANH AI TRỢ LÝ BÊN CẠNH (AI ASSISTANT SIDEBAR)
    // =========================================================================

    toggleSidebar(forceState = null) {
        let sidebar = document.getElementById('ai-assistant-sidebar');
        if (!sidebar) {
            this.createSidebarElement();
            sidebar = document.getElementById('ai-assistant-sidebar');
        }

        const isOpen = sidebar.classList.contains('open');
        const shouldOpen = forceState !== null ? forceState : !isOpen;

        if (shouldOpen) {
            if (!this.ensureApiKey()) return;
            sidebar.classList.add('open');
            document.body.classList.add('ai-sidebar-open');
            this.updateSidebarNoteContext();
            const input = document.getElementById('ai-chat-input');
            if (input) setTimeout(() => input.focus(), 150);
        } else {
            sidebar.classList.remove('open');
            document.body.classList.remove('ai-sidebar-open');
        }
    },

    createSidebarElement() {
        const sidebar = document.createElement('aside');
        sidebar.id = 'ai-assistant-sidebar';
        sidebar.className = 'ai-assistant-sidebar';
        sidebar.innerHTML = `
            <!-- Left Resizer Handle -->
            <div class="ai-sidebar-resizer" id="ai-sidebar-resizer" title="Kéo để điều chỉnh độ rộng bảng AI"></div>

            <div class="ai-sidebar-header">
                <div class="ai-sidebar-title-group">
                    <div class="ai-sidebar-icon"><i class="ri-sparkling-fill"></i></div>
                    <div>
                        <div class="ai-sidebar-title">Trợ lý AI Gemini</div>
                        <div class="ai-sidebar-subtitle" id="ai-sidebar-model-badge">Gemini 2.0 Flash</div>
                    </div>
                </div>
                <div class="ai-sidebar-header-actions">
                    <button class="ai-icon-btn" onclick="aiService.clearChat()" title="Làm mới cuộc trò chuyện"><i class="ri-delete-bin-line"></i></button>
                    <button class="ai-icon-btn" onclick="aiService.toggleSidebar(false)" title="Đóng panel"><i class="ri-close-line"></i></button>
                </div>
            </div>

            <!-- Note Context Bar -->
            <div class="ai-context-indicator" id="ai-context-indicator">
                <i class="ri-file-text-line"></i>
                <span class="ai-context-title" id="ai-context-title">Đang kết nối trang ghi chú...</span>
            </div>

            <!-- Quick Action Chips -->
            <div class="ai-quick-chips-row">
                <button type="button" class="ai-chip-btn" onclick="aiService.sendQuickPrompt('Tóm tắt các điểm chính của trang ghi chú này một cách ngắn gọn, dễ hiểu.')">
                    📝 Tóm tắt trang này
                </button>
                <button type="button" class="ai-chip-btn" onclick="aiService.sendQuickPrompt('Giải thích các thuật ngữ / khái niệm kỹ thuật trọng tâm trong bài viết này.')">
                    💡 Giải thích thuật ngữ
                </button>
                <button type="button" class="ai-chip-btn" onclick="aiService.sendQuickPrompt('Tạo 3 câu hỏi ôn tập kèm đáp án dựa trên nội dung ghi chú này.')">
                    ❓ 3 câu hỏi ôn tập
                </button>
                <button type="button" class="ai-chip-btn" onclick="aiService.sendQuickPrompt('Đánh giá và gợi ý bổ sung các ý còn thiếu để trang ghi chú hoàn thiện hơn.')">
                    🔍 Gợi ý bổ sung ý
                </button>
            </div>

            <!-- Messages List -->
            <div class="ai-chat-messages" id="ai-chat-messages">
                <div class="ai-welcome-card">
                    <div style="font-size: 24px; margin-bottom: 6px;">✨</div>
                    <div style="font-weight: 600; font-size: 14px;">Xin chào! Tôi có thể giúp gì cho bài học của bạn?</div>
                    <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                        Tôi có thể giải đáp kiến thức, tóm tắt bài giảng, giải thích code, hoặc luyện tiếng Anh trực tiếp dựa trên ghi chú đang mở.
                    </div>
                </div>
            </div>

            <!-- Chat Input Area -->
            <div class="ai-chat-input-area">
                <textarea id="ai-chat-input" rows="2" placeholder="Hỏi AI về bài này hoặc kiến thức bất kỳ... (Enter để gửi, Shift+Enter xuống dòng)"></textarea>
                <button type="button" id="ai-chat-send-btn" class="ai-send-btn" onclick="aiService.sendChatMessage()" title="Gửi tin nhắn">
                    <i class="ri-send-plane-2-fill"></i>
                </button>
            </div>
        `;
        document.body.appendChild(sidebar);
        this.initAiSidebarResizer();

        // Enter key to send
        const input = document.getElementById('ai-chat-input');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    aiService.sendChatMessage();
                }
            });
        }

        // Bấm vào phần nội dung chính trên màn hình nhỏ để tự động đóng thanh AI
        const mainContent = document.querySelector('.main-content');
        if (mainContent && !mainContent.__aiListenerAttached) {
            mainContent.__aiListenerAttached = true;
            mainContent.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && document.body.classList.contains('ai-sidebar-open')) {
                    if (!e.target.closest('#topbar-ai-btn')) {
                        aiService.toggleSidebar(false);
                    }
                }
            });
        }
    },

    initAiSidebarResizer() {
        const resizer = document.getElementById('ai-sidebar-resizer');
        const sidebar = document.getElementById('ai-assistant-sidebar');
        if (!resizer || !sidebar) return;

        // Khôi phục độ rộng đã lưu nếu có
        try {
            const savedWidth = localStorage.getItem('schooldb_ai_sidebar_width');
            if (savedWidth) {
                const parsed = parseInt(savedWidth, 10);
                if (!isNaN(parsed) && parsed >= 320 && parsed <= 800) {
                    document.documentElement.style.setProperty('--ai-sidebar-width', `${parsed}px`);
                }
            }
        } catch (e) {}

        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            resizer.classList.add('is-resizing');
            document.body.classList.add('is-resizing-ai');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            const maxAllowed = Math.min(750, Math.floor(window.innerWidth * 0.65));
            const clamped = Math.max(320, Math.min(newWidth, maxAllowed));
            document.documentElement.style.setProperty('--ai-sidebar-width', `${clamped}px`);
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('is-resizing');
                document.body.classList.remove('is-resizing-ai');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                try {
                    const currentWidth = getComputedStyle(document.documentElement).getPropertyValue('--ai-sidebar-width').trim();
                    const parsed = parseInt(currentWidth, 10);
                    if (!isNaN(parsed)) {
                        localStorage.setItem('schooldb_ai_sidebar_width', parsed);
                    }
                } catch (e) {}
            }
        });
    },

    updateSidebarNoteContext() {
        const titleEl = document.getElementById('ai-context-title');
        const pageTitle = (elements.pageTitleInput ? elements.pageTitleInput.value.trim() : '') || 'Ghi chú hiện tại';
        if (titleEl) {
            titleEl.textContent = `Ngữ cảnh: "${pageTitle}"`;
        }
    },

    getNoteContentContext() {
        const title = (elements.pageTitleInput ? elements.pageTitleInput.value.trim() : '') || 'Untitled';
        let bodyText = '';
        if (elements.blockEditor) {
            const blocks = Array.from(elements.blockEditor.querySelectorAll('.block-content'));
            bodyText = blocks.map(b => b.innerText.trim()).filter(Boolean).join('\n');
        }
        return { title, bodyText };
    },

    sendQuickPrompt(promptText) {
        const input = document.getElementById('ai-chat-input');
        if (input) input.value = promptText;
        this.sendChatMessage(promptText);
    },

    async sendChatMessage(customPrompt = null) {
        if (!this.ensureApiKey()) return;

        const input = document.getElementById('ai-chat-input');
        const sendBtn = document.getElementById('ai-chat-send-btn');
        const messagesContainer = document.getElementById('ai-chat-messages');

        const messageText = customPrompt || (input ? input.value.trim() : '');
        if (!messageText) return;

        if (input) input.value = '';

        // Render User Message
        this.appendChatMessage('user', messageText);

        // Render Loading Bubble
        const loadingId = 'ai-loading-' + Date.now();
        this.appendLoadingBubble(loadingId);

        if (sendBtn) sendBtn.disabled = true;

        const { title, bodyText } = this.getNoteContentContext();
        const systemPrompt = `Bạn là Trợ lý AI học tập thông minh trong ứng dụng School NoteBook.
Bạn đang hỗ trợ người dùng dựa trên trang ghi chú hiện tại:
Tiêu đề: "${title}"
Nội dung ghi chú:
"""
${bodyText.slice(0, 8000)}
"""

Hãy trả lời một cách tự nhiên, chính xác, súc tích và có ích bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh).
Sử dụng Markdown đẹp mắt: in đậm từ khóa, gạch đầu dòng, khối code có cú pháp rõ ràng nếu liên quan tới lập trình.`;

        try {
            const aiReply = await this.generateContent(messageText, systemPrompt, { task: 'chat' });
            this.removeLoadingBubble(loadingId);
            this.appendChatMessage('assistant', aiReply, this.lastUsedModel);
        } catch (err) {
            console.error('Chat error:', err);
            this.removeLoadingBubble(loadingId);
            this.appendChatMessage('assistant', `⚠️ Lỗi: ${err.message}`);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            if (input) input.focus();
        }
    },

    appendChatMessage(role, content, modelUsed = null) {
        const container = document.getElementById('ai-chat-messages');
        if (!container) return;

        // Remove welcome card on first message
        const welcome = container.querySelector('.ai-welcome-card');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message-row ${role === 'user' ? 'user-msg' : 'assistant-msg'}`;

        if (role === 'user') {
            msgDiv.innerHTML = `
                <div class="ai-msg-bubble user-bubble">${escapeHtml(content)}</div>
            `;
        } else {
            const badgeHtml = modelUsed ? `
                <div style="font-size: 11px; color: var(--text-placeholder); margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                    <i class="ri-sparkling-fill" style="font-size: 11px; color: #60a5fa;"></i> ${escapeHtml(this.getModelDisplayName(modelUsed))}
                </div>
            ` : '';

            msgDiv.innerHTML = `
                <div class="ai-msg-avatar"><i class="ri-sparkling-fill"></i></div>
                <div class="ai-msg-content-wrapper">
                    <div class="ai-msg-bubble assistant-bubble">${this.formatAiMarkdown(content)}</div>
                    ${badgeHtml}
                    <div class="ai-msg-actions">
                        <button type="button" class="ai-msg-action-btn" onclick="aiService.copyText(this, ${JSON.stringify(content)})" title="Sao chép">
                            <i class="ri-file-copy-line"></i> Sao chép
                        </button>
                        <button type="button" class="ai-msg-action-btn" onclick="aiService.insertChatToNote(${JSON.stringify(content)})" title="Chèn vào trang ghi chú">
                            <i class="ri-add-box-line"></i> Chèn vào bài
                        </button>
                    </div>
                </div>
            `;
        }

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    },

    appendLoadingBubble(id) {
        const container = document.getElementById('ai-chat-messages');
        if (!container) return;
        const loadingDiv = document.createElement('div');
        loadingDiv.id = id;
        loadingDiv.className = 'ai-message-row assistant-msg';
        loadingDiv.innerHTML = `
            <div class="ai-msg-avatar"><i class="ri-sparkling-fill"></i></div>
            <div class="ai-msg-bubble assistant-bubble loading-bubble">
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
                <span class="ai-typing-dot"></span>
            </div>
        `;
        container.appendChild(loadingDiv);
        container.scrollTop = container.scrollHeight;
    },

    removeLoadingBubble(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    clearChat() {
        const container = document.getElementById('ai-chat-messages');
        if (container) {
            container.innerHTML = `
                <div class="ai-welcome-card">
                    <div style="font-size: 24px; margin-bottom: 6px;">✨</div>
                    <div style="font-weight: 600; font-size: 14px;">Cuộc trò chuyện đã được làm mới!</div>
                    <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                        Bạn có thể hỏi bất cứ điều gì liên quan đến ghi chú hiện tại.
                    </div>
                </div>
            `;
        }
        showToast('🧹 Đã xóa lịch sử trò chuyện.');
    },

    copyText(btn, text) {
        navigator.clipboard.writeText(text).then(() => {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="ri-check-line"></i> Đã chép';
                setTimeout(() => btn.innerHTML = orig, 1500);
            }
            showToast('📋 Đã sao chép vào bộ nhớ tạm!');
        });
    },

    insertChatToNote(content) {
        if (!elements.blockEditor) return;
        const newBlock = createBlockElement('text', escapeHtml(content).replace(/\n/g, '<br>'), generateId(), 0);
        elements.blockEditor.appendChild(newBlock);
        triggerSave();
        showToast('📥 Đã chèn phản hồi của AI vào cuối bài viết!');
    },

    // Format Markdown cơ bản sang HTML an toàn
    formatAiMarkdown(md) {
        if (!md) return '';
        let html = escapeHtml(md);

        // Code blocks: ```code```
        html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
            return `<pre class="ai-code-block"><code>${p1.trim()}</code></pre>`;
        });

        // Inline code: `code`
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Bold: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px; font-size: 14px;">$1</h4>');
        html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 4px; font-size: 15px;">$1</h3>');
        html = html.replace(/^# (.*$)/gim, '<h2 style="margin: 12px 0 6px; font-size: 16px;">$1</h2>');

        // Bullets
        html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-left: 16px;">$1</li>');
        html = html.replace(/(<li.*<\/li>)/gims, '<ul style="margin: 4px 0; padding-left: 8px;">$1</ul>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    },

    init() {
        // Tự động kích hoạt chế độ Tự động thông minh (Smart Auto Router)
        const currentStored = localStorage.getItem(this.STORAGE_KEYS.model);
        if (!currentStored || currentStored === 'gemini-2.0-flash' || currentStored === 'gemini-1.5-flash' || currentStored === 'gemini-1.5-pro') {
            this.setModel('auto');
        }

        // Tự động quét các model khả dụng cho API Key trong nền
        const apiKey = this.getApiKey();
        if (apiKey && !this.getDiscoveredModels()) {
            this.discoverAvailableModels(apiKey, false).catch(() => {});
        }

        this.updateModelSelectUI();
        const badge = document.getElementById('ai-sidebar-model-badge');
        if (badge) {
            badge.textContent = this.getModelDisplayName(this.getModel());
        }
    }
};

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => aiService.init());
    } else {
        setTimeout(() => aiService.init(), 100);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { aiService };
} else {
    window.aiService = aiService;
}
