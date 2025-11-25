class UI {
    constructor(app) {
        this.app = app;
        this.activeRequestIndex = 0;
        this.requestInnerTabs = {};
        this.activeProtocol = 'HTTP'; // Default
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttribute(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    renderTemplatesList(searchQuery = '') {
        const container = document.getElementById('templates-list');
        const templates = searchQuery ?
            this.app.templateManager.searchTemplates(searchQuery) :
            this.app.templateManager.getAllTemplates();

        if (templates.length === 0) {
            container.innerHTML = `
                <div class="templates-empty">
                    <h3>No templates found</h3>
                    <p>${searchQuery ? 'Try a different search term' : 'Create your first template to get started'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map(template => {
            const isActive = template.internalId === this.app.currentTemplateId;
            const info = template.content.info;

            // Detect protocol
            let protocol = 'HTTP';
            const content = template.content;
            if (content.dns) protocol = 'DNS';
            else if (content.network) protocol = 'Network';
            else if (content.file) protocol = 'File';
            else if (content.headless) protocol = 'Headless';
            else if (content.javascript) protocol = 'JavaScript';
            else if (content.code) protocol = 'Code';
            else if (content.flow) protocol = 'Flow';

            return `
                <div class="template-item ${isActive ? 'active' : ''}" data-internal-id="${template.internalId}">
                    <div class="template-info">
                        <div class="template-name-row">
                            <span class="template-name-display">${this.escapeHtml(template.name)}</span>
                            <span class="template-id-display">${this.escapeHtml(info.id || '')}</span>
                        </div>
                        <div class="template-meta">
                            <span class="meta-item author">${this.escapeHtml(info.author || 'Unknown')}</span>
                            <span class="meta-item severity ${info.severity || 'info'}">${(info.severity || 'info').toUpperCase()}</span>
                            <span class="template-badge protocol ${protocol.toLowerCase()}">${protocol}</span>
                            <span class="meta-item date">${new Date(template.modified).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="template-item-actions">
                        <button class="btn-icon duplicate-template" title="Duplicate">⧉</button>
                        <button class="btn-icon download-template" title="Download">↓</button>
                        <button class="btn-icon delete-template" title="Delete">×</button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind events
        container.querySelectorAll('.template-item').forEach(item => {
            const id = parseInt(item.dataset.internalId);

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.template-item-actions')) {
                    this.app.loadTemplate(id);
                }
            });

            item.querySelector('.duplicate-template').addEventListener('click', (e) => {
                e.stopPropagation();
                const newTemplate = this.app.templateManager.duplicateTemplate(id);
                this.app.renderTemplatesList();
                this.app.updateTemplateStats();
            });

            item.querySelector('.delete-template').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this template?')) {
                    this.app.templateManager.deleteTemplate(id);
                    if (this.app.currentTemplateId === id) {
                        this.app.currentTemplateId = null;
                        this.app.currentTemplate = null;
                        this.app.showPage('templates');
                    }
                    this.app.renderTemplatesList();
                    this.app.updateTemplateStats();
                }
            });

            item.querySelector('.download-template').addEventListener('click', (e) => {
                e.stopPropagation();
                this.app.templateManager.downloadTemplate(id);
            });
        });
    }

    renderNewTemplateModal() {
        const grid = document.querySelector('.protocol-grid');
        grid.innerHTML = protocolTypes.map(p => `
            <div class="protocol-option ${this.activeProtocol === p ? 'active' : ''}" data-protocol="${p}">
                <div class="protocol-icon">${p[0]}</div>
                <div class="protocol-name">${p}</div>
            </div>
        `).join('');

        grid.querySelectorAll('.protocol-option').forEach(opt => {
            opt.addEventListener('click', () => {
                grid.querySelectorAll('.protocol-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.activeProtocol = opt.dataset.protocol;
            });
        });

        const modal = document.getElementById('new-template-modal');
        modal.style.display = 'flex';

        const closeBtn = modal.querySelector('.btn-close-modal');
        const createBtn = document.getElementById('btn-create-confirm');
        const nameInput = document.getElementById('new-template-name');

        const close = () => {
            modal.style.display = 'none';
            nameInput.value = '';
        };

        closeBtn.onclick = close;

        createBtn.onclick = () => {
            const name = nameInput.value || 'New Template';
            this.app.createTemplate(name, this.activeProtocol);
            close();
        };
    }

    renderForm() {
        if (!this.app.currentTemplate) return;

        const info = this.app.currentTemplate.content.info;

        // Populate Info Fields
        document.getElementById('template-id').value = info.id || '';
        document.getElementById('info-name').value = info.name || '';
        document.getElementById('info-author').value = info.author || '';
        document.getElementById('info-description').value = info.description || '';
        document.getElementById('info-tags').value = info.tags || '';
        document.getElementById('info-reference').value = Array.isArray(info.reference) ? info.reference.join('\n') : (info.reference || '');

        // Severity Dropdown
        const severitySelect = document.getElementById('info-severity');
        severitySelect.innerHTML = severities.map(s =>
            `<option value="${s}" ${info.severity === s ? 'selected' : ''}>${s}</option>`
        ).join('');

        this.renderProtocolEditor();
    }

    renderProtocolEditor() {
        const container = document.getElementById('requests-container');
        container.innerHTML = '';

        const content = this.app.currentTemplate.content;
        let protocol = 'HTTP';

        // Detect protocol
        if (content.dns) protocol = 'DNS';
        else if (content.network) protocol = 'Network';
        else if (content.file) protocol = 'File';
        else if (content.headless) protocol = 'Headless';
        else if (content.javascript) protocol = 'JavaScript';
        else if (content.code) protocol = 'Code';
        else if (content.flow) protocol = 'Flow';
        else if (content.http) protocol = 'HTTP';

        const header = document.querySelector('.section-header h2');
        if (header) header.textContent = `${protocol} Requests/Steps`;

        switch (protocol) {
            case 'HTTP': this.renderHttpEditor(container, content.http); break;
            case 'DNS': this.renderDnsEditor(container, content.dns); break;
            case 'Network': this.renderNetworkEditor(container, content.network); break;
            case 'Headless': this.renderHeadlessEditor(container, content.headless); break;
            case 'File': this.renderFileEditor(container, content.file); break;
            // ... implement others
            default: container.innerHTML = '<p>Protocol editor not implemented yet.</p>';
        }
    }

    // --- HTTP Editor ---
    renderHttpEditor(container, requests) {
        if (!requests) return;

        // Reuse the tabbed logic from before
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'steps-tabs-container';
        container.appendChild(tabsContainer);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'steps-content-container';
        container.appendChild(contentContainer);

        requests.forEach((req, index) => {
            const tab = document.createElement('div');
            tab.className = `step-tab-header ${index === this.activeRequestIndex ? 'active' : ''}`;
            tab.textContent = `Req ${index + 1}`;
            tab.addEventListener('click', () => {
                this.activeRequestIndex = index;
                this.renderProtocolEditor();
            });

            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-step-icon';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.app.removeRequest(index);
            };
            tab.appendChild(removeBtn);
            tabsContainer.appendChild(tab);

            const reqEl = document.createElement('div');
            reqEl.className = `step-content-wrapper ${index === this.activeRequestIndex ? 'active' : ''}`;
            reqEl.innerHTML = this.getHttpRequestTemplate(req, index);
            contentContainer.appendChild(reqEl);

            this.bindHttpRequestEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });

        const addTab = document.createElement('div');
        addTab.className = 'step-tab-header add-step-tab';
        addTab.innerHTML = '+';
        addTab.addEventListener('click', () => {
            this.app.addRequest();
        });
        tabsContainer.appendChild(addTab);
    }

    getHttpRequestTemplate(req, index) {
        const activeTab = this.requestInnerTabs[index] || 'match';
        const requestMode = req.raw ? 'raw' : (req.fuzzing ? 'fuzzing' : 'standard');

        return `
            <div class="form-group">
                <label>Request Mode</label>
                <select class="req-mode-select" data-index="${index}">
                    <option value="standard" ${requestMode === 'standard' ? 'selected' : ''}>Standard (Method/Path/Body)</option>
                    <option value="raw" ${requestMode === 'raw' ? 'selected' : ''}>Raw HTTP Request</option>
                    <option value="fuzzing" ${requestMode === 'fuzzing' ? 'selected' : ''}>Fuzzing (DAST)</option>
                </select>
            </div>
            
            <div id="mode-standard-${index}" class="request-mode-content" style="display: ${requestMode === 'standard' ? 'block' : 'none'}">
                <div class="form-group">
                    <label>Method</label>
                    <select class="req-input" data-field="method">
                        ${methods.map(m => `<option value="${m}" ${m === req.method ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Path (One per line)</label>
                    <textarea class="req-input" data-field="path" rows="3">${(req.path || []).join('\n')}</textarea>
                </div>
                <div class="form-group">
                    <label>Body</label>
                    <textarea class="req-input" data-field="body" rows="5">${this.escapeHtml(req.body || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Headers (Key: Value)</label>
                    <textarea class="req-input" data-field="headers" rows="3">${req.headers ? Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''
            }</textarea>
                </div>
            </div>
            
            <div id="mode-raw-${index}" class="request-mode-content" style="display: ${requestMode === 'raw' ? 'block' : 'none'}">
                <div class="form-group">
                    <label>Raw HTTP Request</label>
                    <small style="color: var(--text-secondary); display: block; margin-bottom: 8px;">
                        Use {{Hostname}}, {{BaseURL}}, and other variables. Separate multiple requests with blank lines.
                    </small>
                    <textarea class="req-input" data-field="raw" rows="15" style="font-family: var(--font-mono);">${req.raw ? (Array.isArray(req.raw) ? req.raw.join('\n\n') : req.raw) :
                'POST /path HTTP/1.1\nHost: {{Hostname}}\nContent-Type: application/x-www-form-urlencoded\n\nkey=value'
            }</textarea>
                </div>
            </div>
            
            <div id="mode-fuzzing-${index}" class="request-mode-content" style="display: ${requestMode === 'fuzzing' ? 'block' : 'none'}">
                <div class="form-group">
                    <label>Fuzzing Configuration (DAST Mode)</label>
                    <small style="color: var(--text-secondary); display: block; margin-bottom: 8px;">
                        Configure fuzzing parameters for dynamic application security testing
                    </small>
                </div>
                <div id="fuzzing-list-${index}"></div>
                <button class="btn small secondary btn-add-fuzzing" style="margin-top:5px">Add Fuzzing Rule</button>
            </div>
            
            <div class="inner-tabs" style="margin-top: 16px;">
                <button class="inner-tab-btn ${activeTab === 'match' ? 'active' : ''}" data-tab="match-${index}">Matchers</button>
                <button class="inner-tab-btn ${activeTab === 'extract' ? 'active' : ''}" data-tab="extract-${index}">Extractors</button>
            </div>
            
            <div id="match-${index}" class="inner-tab-content ${activeTab === 'match' ? 'active' : ''}">
                <div class="section-header">Matchers</div>
                <div class="data-table-container">
                    <div class="table-toolbar">
                        <button class="btn small secondary btn-add-matcher">Add Matcher</button>
                    </div>
                    <div class="data-table-scroll">
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
            </div>
            <div id="extract-${index}" class="inner-tab-content ${activeTab === 'extract' ? 'active' : ''}">
                <div class="section-header">Extractors</div>
                <div class="data-table-container">
                    <div class="table-toolbar">
                        <button class="btn small secondary btn-add-extractor">Add Extractor</button>
                    </div>
                    <div class="data-table-scroll">
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            </div>
        `;
    }

    bindHttpRequestEvents(reqEl, index, req) {
        this.bindInnerTabs(reqEl, index);

        // Request mode selector
        const modeSelect = reqEl.querySelector('.req-mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                const mode = e.target.value;

                // Hide all mode contents
                reqEl.querySelectorAll('.request-mode-content').forEach(el => el.style.display = 'none');

                // Show selected mode
                reqEl.querySelector(`#mode-${mode}-${index}`).style.display = 'block';

                // Update request object based on mode
                if (mode === 'raw') {
                    // When switching to raw, preserve existing data or set default
                    if (!req.raw) {
                        req.raw = ['POST /path HTTP/1.1\nHost: {{Hostname}}\nContent-Type: application/x-www-form-urlencoded\n\nkey=value'];
                    }
                    // Remove standard fields
                    delete req.method;
                    delete req.path;
                    delete req.body;
                    delete req.headers;
                    delete req.fuzzing;
                } else if (mode === 'fuzzing') {
                    // When switching to fuzzing
                    if (!req.fuzzing) {
                        req.fuzzing = [];
                    }
                    delete req.raw;
                } else {
                    // Standard mode
                    if (!req.method) req.method = 'GET';
                    if (!req.path) req.path = ['{{BaseURL}}'];
                    delete req.raw;
                    delete req.fuzzing;
                }

                this.app.updateJsonView();
            });
        }

        reqEl.querySelectorAll('.req-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.dataset.field;
                const value = e.target.value;
                if (field === 'path') {
                    req.path = value.split('\n').filter(l => l.trim() !== '');
                } else if (field === 'headers') {
                    const headers = {};
                    value.split('\n').forEach(line => {
                        const parts = line.split(':');
                        if (parts.length >= 2) headers[parts[0].trim()] = parts.slice(1).join(':').trim();
                    });
                    req.headers = headers;
                } else if (field === 'raw') {
                    // Store raw as array split by double newlines
                    req.raw = value.split('\n\n').filter(r => r.trim() !== '');
                } else {
                    req[field] = value;
                }
                this.app.updateJsonView();
            });
        });

        this.bindMatcherExtractorEvents(reqEl, index, req);

        // Bind fuzzing events
        this.bindFuzzingEvents(reqEl, index, req);
    }

    bindFuzzingEvents(reqEl, index, req) {
        const addFuzzingBtn = reqEl.querySelector('.btn-add-fuzzing');
        if (addFuzzingBtn) {
            addFuzzingBtn.addEventListener('click', () => {
                if (!req.fuzzing) req.fuzzing = [];
                req.fuzzing.push({
                    part: 'query',
                    type: 'postfix',
                    mode: 'single',
                    fuzz: []
                });
                this.renderFuzzingRules(reqEl, index, req);
                this.app.updateJsonView();
            });
        }

        this.renderFuzzingRules(reqEl, index, req);
    }

    renderFuzzingRules(reqEl, reqIndex, req) {
        const container = reqEl.querySelector(`#fuzzing-list-${reqIndex}`);
        if (!container) return;
        container.innerHTML = '';

        (req.fuzzing || []).forEach((fuzzRule, fIndex) => {
            const fEl = document.createElement('div');
            fEl.className = 'fuzzing-rule-item';
            fEl.style.border = '1px solid var(--border-color)';
            fEl.style.padding = '10px';
            fEl.style.marginBottom = '10px';
            fEl.style.borderRadius = '4px';
            fEl.style.backgroundColor = 'var(--bg-color)';

            fEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>Fuzzing Rule #${fIndex + 1}</strong>
                    <button class="btn small danger remove-fuzzing">×</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Part</label>
                        <select class="fuzz-part">
                            <option value="query" ${fuzzRule.part === 'query' ? 'selected' : ''}>Query</option>
                            <option value="path" ${fuzzRule.part === 'path' ? 'selected' : ''}>Path</option>
                            <option value="header" ${fuzzRule.part === 'header' ? 'selected' : ''}>Header</option>
                            <option value="cookie" ${fuzzRule.part === 'cookie' ? 'selected' : ''}>Cookie</option>
                            <option value="body" ${fuzzRule.part === 'body' ? 'selected' : ''}>Body</option>
                            <option value="request" ${fuzzRule.part === 'request' ? 'selected' : ''}>Request (entire)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select class="fuzz-type">
                            <option value="replace" ${fuzzRule.type === 'replace' ? 'selected' : ''}>Replace</option>
                            <option value="prefix" ${fuzzRule.type === 'prefix' ? 'selected' : ''}>Prefix</option>
                            <option value="postfix" ${fuzzRule.type === 'postfix' ? 'selected' : ''}>Postfix</option>
                            <option value="infix" ${fuzzRule.type === 'infix' ? 'selected' : ''}>Infix</option>
                            <option value="replace-regex" ${fuzzRule.type === 'replace-regex' ? 'selected' : ''}>Replace Regex</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Mode</label>
                        <select class="fuzz-mode">
                            <option value="single" ${fuzzRule.mode === 'single' ? 'selected' : ''}>Single</option>
                            <option value="multiple" ${fuzzRule.mode === 'multiple' ? 'selected' : ''}>Multiple</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Keys (optional, comma-separated)</label>
                    <input type="text" class="fuzz-keys" value="${(fuzzRule.keys || []).join(', ')}" placeholder="e.g., redirect, url, path">
                </div>
                <div class="form-group">
                    <label>Keys Regex (optional, comma-separated)</label>
                    <input type="text" class="fuzz-keys-regex" value="${(fuzzRule['keys-regex'] || []).join(', ')}" placeholder="e.g., redirect.*, url.*">
                </div>
                <div class="form-group">
                    <label>Preconditions (one per line)</label>
                    <textarea class="fuzz-preconditions" rows="2">${(fuzzRule.preconditions || []).join('\n')}</textarea>
                </div>
                <div class="form-group">
                    <label>Attack Type</label>
                    <select class="fuzz-attack-type">
                        <option value="battering-ram" ${fuzzRule.attack === 'battering-ram' ? 'selected' : ''}>Battering Ram</option>
                        <option value="pitchfork" ${fuzzRule.attack === 'pitchfork' ? 'selected' : ''}>Pitchfork</option>
                        <option value="sniper" ${fuzzRule.attack === 'sniper' ? 'selected' : ''}>Sniper</option>
                        <option value="clusterbomb" ${fuzzRule.attack === 'clusterbomb' ? 'selected' : ''}>Clusterbomb</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Analyzers (one per line)</label>
                    <textarea class="fuzz-analyzers" rows="2">${(fuzzRule.analyzers || []).join('\n')}</textarea>
                </div>
                <div class="form-group">
                    <label>Fuzz Values (one per line or key:value pairs)</label>
                    <small style="color: var(--text-secondary); display: block; margin-bottom: 4px;">
                        Simple: One value per line, or Key-Value: "Header-Name: value"
                    </small>
                    <textarea class="fuzz-values" rows="4">${this.formatFuzzValues(fuzzRule.fuzz)}</textarea>
                </div>
            `;

            fEl.querySelector('.remove-fuzzing').addEventListener('click', () => {
                req.fuzzing.splice(fIndex, 1);
                this.renderFuzzingRules(reqEl, reqIndex, req);
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-part').addEventListener('change', (e) => {
                fuzzRule.part = e.target.value;
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-type').addEventListener('change', (e) => {
                fuzzRule.type = e.target.value;
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-mode').addEventListener('change', (e) => {
                fuzzRule.mode = e.target.value;
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-keys').addEventListener('input', (e) => {
                const keys = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                if (keys.length > 0) {
                    fuzzRule.keys = keys;
                } else {
                    delete fuzzRule.keys;
                }
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-keys-regex').addEventListener('input', (e) => {
                const keysRegex = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                if (keysRegex.length > 0) {
                    fuzzRule['keys-regex'] = keysRegex;
                } else {
                    delete fuzzRule['keys-regex'];
                }
                this.app.updateJsonView();
            });

            fEl.querySelector('.fuzz-values').addEventListener('input', (e) => {
                fuzzRule.fuzz = this.parseFuzzValues(e.target.value);
                this.app.updateJsonView();
            });

            container.appendChild(fEl);
        });
    }

    formatFuzzValues(fuzz) {
        if (!fuzz) return '';
        if (Array.isArray(fuzz)) {
            return fuzz.join('\n');
        }
        if (typeof fuzz === 'object') {
            return Object.entries(fuzz).map(([k, v]) => `${k}: ${v}`).join('\n');
        }
        return '';
    }

    parseFuzzValues(text) {
        const lines = text.split('\n').filter(l => l.trim() !== '');

        // Check if it's key-value format
        const hasKeyValue = lines.some(line => line.includes(':') && !line.trim().startsWith('{{'));

        if (hasKeyValue) {
            // Parse as object
            const obj = {};
            lines.forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const value = line.substring(colonIndex + 1).trim();
                    obj[key] = value;
                }
            });
            return obj;
        } else {
            // Parse as array
            return lines;
        }
    }

    // --- DNS Editor ---
    renderDnsEditor(container, requests) {
        if (!requests) return;

        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active'; // No tabs for now, just list
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">DNS Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="dns-req-${index}">Request</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                    <button class="inner-tab-btn" data-tab="extract-${index}">Extractors</button>
                </div>
                <div id="dns-req-${index}" class="inner-tab-content active">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" class="dns-input" data-field="name" value="${this.escapeAttribute(req.name || '')}">
                        </div>
                        <div class="form-group">
                            <label>Type</label>
                            <select class="dns-input" data-field="type">
                                ${dnsTypes.map(t => `<option value="${t}" ${t === req.type ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Class</label>
                            <select class="dns-input" data-field="class">
                                ${dnsClasses.map(c => `<option value="${c}" ${c === req.class ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Retries</label>
                            <input type="number" class="dns-input" data-field="retries" value="${req.retries || 3}">
                        </div>
                    </div>
                    <div class="form-group checkbox-group">
                        <input type="checkbox" class="dns-input" data-field="recursion" id="dns-recursion-${index}" ${req.recursion ? 'checked' : ''}>
                        <label for="dns-recursion-${index}">Recursion</label>
                    </div>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
                <div id="extract-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-extractor">Add Extractor</button></div>
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            reqEl.querySelectorAll('.dns-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const field = e.target.dataset.field;
                    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                    req[field] = value;
                    this.app.updateJsonView();
                });
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });
    }

    // --- Network Editor ---
    renderNetworkEditor(container, requests) {
        if (!requests) return;
        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active';
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">Network Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="net-req-${index}">Request</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                </div>
                <div id="net-req-${index}" class="inner-tab-content active">
                    <div class="form-group">
                        <label>Host (One per line)</label>
                        <textarea class="net-input" data-field="host" rows="2">${(req.host || []).join('\n')}</textarea>
                    </div>
                    <div class="section-header">Inputs</div>
                    <div id="net-inputs-${index}"></div>
                    <button class="btn small secondary btn-add-input" style="margin-top:5px">Add Input</button>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            // Host input
            reqEl.querySelector('[data-field="host"]').addEventListener('input', (e) => {
                req.host = e.target.value.split('\n').filter(l => l.trim() !== '');
                this.app.updateJsonView();
            });

            // Inputs list
            const renderInputs = () => {
                const inputsContainer = reqEl.querySelector(`#net-inputs-${index}`);
                inputsContainer.innerHTML = '';
                (req.inputs || []).forEach((inp, iIndex) => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.gap = '10px';
                    div.style.marginBottom = '5px';
                    div.innerHTML = `
                        <input type="text" class="input-data" value="${this.escapeAttribute(inp.data || '')}" placeholder="Data" style="flex:1">
                        <select class="input-type" style="width:80px">
                            <option value="text" ${!inp.type || inp.type === 'text' ? 'selected' : ''}>Text</option>
                            <option value="hex" ${inp.type === 'hex' ? 'selected' : ''}>Hex</option>
                        </select>
                        <button class="btn small danger remove-input">×</button>
                    `;

                    div.querySelector('.input-data').addEventListener('input', (e) => {
                        inp.data = e.target.value;
                        this.app.updateJsonView();
                    });
                    div.querySelector('.input-type').addEventListener('change', (e) => {
                        inp.type = e.target.value;
                        this.app.updateJsonView();
                    });
                    div.querySelector('.remove-input').addEventListener('click', () => {
                        req.inputs.splice(iIndex, 1);
                        renderInputs();
                        this.app.updateJsonView();
                    });
                    inputsContainer.appendChild(div);
                });
            };
            renderInputs();

            reqEl.querySelector('.btn-add-input').addEventListener('click', () => {
                if (!req.inputs) req.inputs = [];
                req.inputs.push({ data: '' });
                renderInputs();
                this.app.updateJsonView();
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
        });
    }

    // --- Shared Logic ---

    bindInnerTabs(el, index) {
        el.querySelectorAll('.inner-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                el.querySelectorAll('.inner-tab-btn').forEach(b => b.classList.remove('active'));
                el.querySelectorAll('.inner-tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                el.querySelector(`#${e.target.dataset.tab}`).classList.add('active');
                this.requestInnerTabs[index] = e.target.dataset.tab.split('-')[0];
            });
        });
    }

    bindMatcherExtractorEvents(reqEl, index, req) {
        const addMatcherBtn = reqEl.querySelector('.btn-add-matcher');
        if (addMatcherBtn) {
            addMatcherBtn.addEventListener('click', () => {
                if (!req.matchers) req.matchers = [];
                req.matchers.push({ type: 'word', words: ['error'] });
                this.renderMatchersTable(reqEl, index, req);
                this.app.updateJsonView();
            });
        }

        const addExtractorBtn = reqEl.querySelector('.btn-add-extractor');
        if (addExtractorBtn) {
            addExtractorBtn.addEventListener('click', () => {
                if (!req.extractors) req.extractors = [];
                req.extractors.push({ type: 'regex', regex: ['[a-z]+'] });
                this.renderExtractorsTable(reqEl, index, req);
                this.app.updateJsonView();
            });
        }
    }

    renderMatchersTable(reqEl, reqIndex, req) {
        const container = reqEl.querySelector(`#matchers-container-${reqIndex}`);
        if (!container) return;
        container.innerHTML = '';

        (req.matchers || []).forEach((matcher, mIndex) => {
            const mEl = document.createElement('div');
            mEl.className = 'matcher-item';
            mEl.style.border = '1px solid var(--border-color)';
            mEl.style.padding = '10px';
            mEl.style.marginBottom = '10px';
            mEl.style.borderRadius = '4px';
            mEl.style.backgroundColor = 'var(--bg-color)';

            // Get the appropriate field based on type
            const getMatcherField = (type) => {
                const fieldMap = {
                    'word': 'words',
                    'regex': 'regex',
                    'binary': 'binary',
                    'status': 'status',
                    'size': 'size',
                    'dsl': 'dsl'
                };
                return fieldMap[type] || 'words';
            };

            const currentField = getMatcherField(matcher.type);
            const currentValue = matcher[currentField] || [];

            mEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>Matcher #${mIndex + 1}</strong>
                    <button class="btn small danger remove-matcher">×</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select class="matcher-type">
                            ${matcherTypes.map(t => `<option value="${t}" ${t === matcher.type ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Part</label>
                        <select class="matcher-part">
                            <option value="">Default</option>
                            ${matcherParts.map(p => `<option value="${p}" ${p === matcher.part ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group matcher-value-field">
                    <label>${currentField.charAt(0).toUpperCase() + currentField.slice(1)} (One per line)</label>
                    <textarea class="matcher-content" rows="2">${Array.isArray(currentValue) ? currentValue.join('\n') : currentValue}</textarea>
                </div>
                <div class="form-group">
                    <label>Condition</label>
                    <select class="matcher-condition">
                        <option value="">Default (or)</option>
                        ${matcherConditions.map(c => `<option value="${c}" ${c === matcher.condition ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" class="matcher-negative" ${matcher.negative ? 'checked' : ''}>
                        <span>Negative (invert match)</span>
                    </label>
                </div>
            `;

            mEl.querySelector('.remove-matcher').addEventListener('click', () => {
                req.matchers.splice(mIndex, 1);
                this.renderMatchersTable(reqEl, reqIndex, req);
                this.app.updateJsonView();
            });

            mEl.querySelector('.matcher-type').addEventListener('change', (e) => {
                const newType = e.target.value;
                const oldField = getMatcherField(matcher.type);
                const newField = getMatcherField(newType);

                // Transfer data to new field if different
                if (oldField !== newField) {
                    matcher[newField] = matcher[oldField] || [];
                    delete matcher[oldField];
                }

                matcher.type = newType;
                this.renderMatchersTable(reqEl, reqIndex, req);
                this.app.updateJsonView();
            });

            mEl.querySelector('.matcher-part').addEventListener('change', (e) => {
                const value = e.target.value;
                if (value) {
                    matcher.part = value;
                } else {
                    delete matcher.part;
                }
                this.app.updateJsonView();
            });

            mEl.querySelector('.matcher-condition').addEventListener('change', (e) => {
                const value = e.target.value;
                if (value) {
                    matcher.condition = value;
                } else {
                    delete matcher.condition;
                }
                this.app.updateJsonView();
            });

            mEl.querySelector('.matcher-negative').addEventListener('change', (e) => {
                if (e.target.checked) {
                    matcher.negative = true;
                } else {
                    delete matcher.negative;
                }
                this.app.updateJsonView();
            });

            mEl.querySelector('.matcher-content').addEventListener('input', (e) => {
                const lines = e.target.value.split('\n').filter(l => l.trim() !== '');
                const field = getMatcherField(matcher.type);
                matcher[field] = lines;
                this.app.updateJsonView();
            });

            container.appendChild(mEl);
        });
    }

    renderExtractorsTable(reqEl, reqIndex, req) {
        const container = reqEl.querySelector(`#extractors-container-${reqIndex}`);
        if (!container) return;
        container.innerHTML = '';

        (req.extractors || []).forEach((extractor, eIndex) => {
            const eEl = document.createElement('div');
            eEl.className = 'extractor-item';
            eEl.style.border = '1px solid var(--border-color)';
            eEl.style.padding = '10px';
            eEl.style.marginBottom = '10px';
            eEl.style.borderRadius = '4px';
            eEl.style.backgroundColor = 'var(--bg-color)';

            // Get the appropriate field based on type
            const getExtractorField = (type) => {
                const fieldMap = {
                    'regex': 'regex',
                    'json': 'json',
                    'xpath': 'xpath',
                    'dsl': 'dsl',
                    'kval': 'kval'
                };
                return fieldMap[type] || 'regex';
            };

            const currentField = getExtractorField(extractor.type);
            const currentValue = extractor[currentField] || [];

            eEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>Extractor #${eIndex + 1}</strong>
                    <button class="btn small danger remove-extractor">×</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select class="extractor-type">
                            ${extractorTypes.map(t => `<option value="${t}" ${t === extractor.type ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Part</label>
                        <select class="extractor-part">
                            <option value="">Default</option>
                            ${matcherParts.map(p => `<option value="${p}" ${p === extractor.part ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>${currentField.charAt(0).toUpperCase() + currentField.slice(1)} (One per line)</label>
                    <textarea class="extractor-content" rows="2">${Array.isArray(currentValue) ? currentValue.join('\n') : currentValue}</textarea>
                </div>
                ${extractor.type === 'regex' ? `
                <div class="form-group">
                    <label>Group (Regex only)</label>
                    <input type="number" class="extractor-group" value="${extractor.group || 1}">
                </div>` : ''}
                <div class="form-group">
                    <label>Name (optional)</label>
                    <input type="text" class="extractor-name" value="${extractor.name || ''}" placeholder="Variable name">
                </div>
            `;

            eEl.querySelector('.remove-extractor').addEventListener('click', () => {
                req.extractors.splice(eIndex, 1);
                this.renderExtractorsTable(reqEl, reqIndex, req);
                this.app.updateJsonView();
            });

            eEl.querySelector('.extractor-type').addEventListener('change', (e) => {
                const newType = e.target.value;
                const oldField = getExtractorField(extractor.type);
                const newField = getExtractorField(newType);

                // Transfer data to new field if different
                if (oldField !== newField) {
                    extractor[newField] = extractor[oldField] || [];
                    delete extractor[oldField];
                }

                extractor.type = newType;
                this.renderExtractorsTable(reqEl, reqIndex, req);
                this.app.updateJsonView();
            });

            eEl.querySelector('.extractor-part').addEventListener('change', (e) => {
                const value = e.target.value;
                if (value) {
                    extractor.part = value;
                } else {
                    delete extractor.part;
                }
                this.app.updateJsonView();
            });

            const groupInput = eEl.querySelector('.extractor-group');
            if (groupInput) {
                groupInput.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    if (value && value > 0) {
                        extractor.group = value;
                    } else {
                        delete extractor.group;
                    }
                    this.app.updateJsonView();
                });
            }

            eEl.querySelector('.extractor-name').addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    extractor.name = value;
                } else {
                    delete extractor.name;
                }
                this.app.updateJsonView();
            });

            eEl.querySelector('.extractor-content').addEventListener('input', (e) => {
                const lines = e.target.value.split('\n').filter(l => l.trim() !== '');
                const field = getExtractorField(extractor.type);
                extractor[field] = lines;
                this.app.updateJsonView();
            });

            container.appendChild(eEl);
        });
    }

    // Placeholder for other editors
    // --- Headless Editor ---
    renderHeadlessEditor(container, requests) {
        if (!requests) return;
        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active';
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">Headless Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="headless-steps-${index}">Steps</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                    <button class="inner-tab-btn" data-tab="extract-${index}">Extractors</button>
                </div>
                <div id="headless-steps-${index}" class="inner-tab-content active">
                    <div id="steps-list-${index}"></div>
                    <button class="btn small secondary btn-add-step" style="margin-top:5px">Add Step</button>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
                <div id="extract-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-extractor">Add Extractor</button></div>
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            // Render Steps
            const renderSteps = () => {
                const stepsContainer = reqEl.querySelector(`#steps-list-${index}`);
                stepsContainer.innerHTML = '';
                (req.steps || []).forEach((step, sIndex) => {
                    const stepDiv = document.createElement('div');
                    stepDiv.className = 'headless-step';
                    stepDiv.style.border = '1px solid var(--border-color)';
                    stepDiv.style.padding = '10px';
                    stepDiv.style.marginBottom = '10px';
                    stepDiv.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong>Step #${sIndex + 1}</strong>
                            <button class="btn small danger remove-step">×</button>
                        </div>
                        <div class="form-group">
                            <label>Action</label>
                            <select class="step-action">
                                ${headlessActions.map(a => `<option value="${a}" ${a === step.action ? 'selected' : ''}>${a}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Args (JSON)</label>
                            <textarea class="step-args" rows="2">${JSON.stringify(step.args || {}, null, 2)}</textarea>
                        </div>
                    `;

                    stepDiv.querySelector('.remove-step').addEventListener('click', () => {
                        req.steps.splice(sIndex, 1);
                        renderSteps();
                        this.app.updateJsonView();
                    });

                    stepDiv.querySelector('.step-action').addEventListener('change', (e) => {
                        step.action = e.target.value;
                        this.app.updateJsonView();
                    });

                    stepDiv.querySelector('.step-args').addEventListener('input', (e) => {
                        try {
                            step.args = JSON.parse(e.target.value);
                            this.app.updateJsonView();
                        } catch (err) {
                            // Ignore invalid JSON while typing
                        }
                    });

                    stepsContainer.appendChild(stepDiv);
                });
            };
            renderSteps();

            reqEl.querySelector('.btn-add-step').addEventListener('click', () => {
                if (!req.steps) req.steps = [];
                req.steps.push({ action: 'navigate', args: {} });
                renderSteps();
                this.app.updateJsonView();
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });
    }

    // --- File Editor ---
    renderFileEditor(container, requests) {
        if (!requests) return;
        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active';
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">File Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="file-req-${index}">Request</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                    <button class="inner-tab-btn" data-tab="extract-${index}">Extractors</button>
                </div>
                <div id="file-req-${index}" class="inner-tab-content active">
                    <div class="form-group">
                        <label>Extensions (One per line)</label>
                        <textarea class="file-input" data-field="extensions" rows="3">${(req.extensions || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Max Size (bytes)</label>
                        <input type="number" class="file-input" data-field="max-size" value="${req['max-size'] || ''}">
                    </div>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
                <div id="extract-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-extractor">Add Extractor</button></div>
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            reqEl.querySelectorAll('.file-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const field = e.target.dataset.field;
                    if (field === 'extensions') {
                        req.extensions = e.target.value.split('\n').filter(l => l.trim() !== '');
                    } else {
                        req[field] = e.target.value;
                    }
                    this.app.updateJsonView();
                });
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });
    }

    // --- Code Editor ---
    renderCodeEditor(container, requests) {
        if (!requests) return;
        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active';
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">Code Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="code-req-${index}">Request</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                    <button class="inner-tab-btn" data-tab="extract-${index}">Extractors</button>
                </div>
                <div id="code-req-${index}" class="inner-tab-content active">
                    <div class="form-group">
                        <label>Engine</label>
                        <select class="code-input" data-field="engine" multiple style="height: 100px;">
                            ${codeEngines.map(e => `<option value="${e}" ${req.engine && req.engine.includes(e) ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                        <small>Hold Ctrl/Cmd to select multiple</small>
                    </div>
                    <div class="form-group">
                        <label>Source Code</label>
                        <textarea class="code-input" data-field="source" rows="10" style="font-family: monospace;">${this.escapeHtml(req.source || '')}</textarea>
                    </div>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
                <div id="extract-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-extractor">Add Extractor</button></div>
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            reqEl.querySelectorAll('.code-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const field = e.target.dataset.field;
                    if (field === 'engine') {
                        req.engine = Array.from(e.target.selectedOptions).map(o => o.value);
                    } else {
                        req[field] = e.target.value;
                    }
                    this.app.updateJsonView();
                });
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });
    }

    // --- JavaScript Editor ---
    renderJavaScriptEditor(container, requests) {
        if (!requests) return;
        requests.forEach((req, index) => {
            const reqEl = document.createElement('div');
            reqEl.className = 'step-content-wrapper active';
            reqEl.style.marginBottom = '20px';
            reqEl.innerHTML = `
                <div class="section-header">JavaScript Request #${index + 1}</div>
                <div class="inner-tabs">
                    <button class="inner-tab-btn active" data-tab="js-req-${index}">Request</button>
                    <button class="inner-tab-btn" data-tab="match-${index}">Matchers</button>
                    <button class="inner-tab-btn" data-tab="extract-${index}">Extractors</button>
                </div>
                <div id="js-req-${index}" class="inner-tab-content active">
                    <div class="form-group">
                        <label>Code</label>
                        <textarea class="js-input" data-field="code" rows="10" style="font-family: monospace;">${this.escapeHtml(req.code || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Args (JSON)</label>
                        <textarea class="js-input" data-field="args" rows="3">${JSON.stringify(req.args || {}, null, 2)}</textarea>
                    </div>
                </div>
                <div id="match-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-matcher">Add Matcher</button></div>
                        <div id="matchers-container-${index}"></div>
                    </div>
                </div>
                <div id="extract-${index}" class="inner-tab-content">
                    <div class="data-table-container">
                        <div class="table-toolbar"><button class="btn small secondary btn-add-extractor">Add Extractor</button></div>
                        <div id="extractors-container-${index}"></div>
                    </div>
                </div>
            `;
            container.appendChild(reqEl);

            this.bindInnerTabs(reqEl, index);

            reqEl.querySelectorAll('.js-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const field = e.target.dataset.field;
                    if (field === 'args') {
                        try {
                            req.args = JSON.parse(e.target.value);
                            this.app.updateJsonView();
                        } catch (err) { }
                    } else {
                        req[field] = e.target.value;
                        this.app.updateJsonView();
                    }
                });
            });

            this.bindMatcherExtractorEvents(reqEl, index, req);
            this.renderMatchersTable(reqEl, index, req);
            this.renderExtractorsTable(reqEl, index, req);
        });
    }
}
