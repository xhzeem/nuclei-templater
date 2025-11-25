class App {
    constructor() {
        this.yamlEditor = document.getElementById('yaml-editor');
        this.ui = new UI(this);
        this.templateManager = new TemplateManager();
        this.currentTemplateId = null; // Internal ID
        this.currentTemplate = null; // Current template object
        this.hasUnsavedChanges = false;

        this.init();
    }

    init() {
        this.bindGlobalEvents();
        this.bindTemplateEvents();
        this.renderTemplatesList();
        this.initResize();
        this.initYamlView();
        this.updateTemplateStats();

        // Restore last session state or show templates
        this.restoreSessionState();
    }

    initResize() {
        const handle = document.getElementById('resize-handle');
        const panel = document.getElementById('preview-panel');
        let isResizing = false;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const containerWidth = document.body.clientWidth;
            const newWidth = containerWidth - e.clientX;
            if (newWidth > 200 && newWidth < containerWidth - 300) {
                panel.style.flex = 'none';
                panel.style.width = `${newWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
        });
    }

    initYamlView() {
        const viewer = document.getElementById('yaml-viewer');
        const editor = document.getElementById('yaml-editor');
        const toggleBtn = document.getElementById('btn-toggle-view');
        const hideBtn = document.getElementById('btn-hide-yaml');
        const showBtn = document.getElementById('btn-show-yaml');
        const panel = document.getElementById('preview-panel');
        const handle = document.getElementById('resize-handle');

        this.isYamlEditMode = false;

        toggleBtn.addEventListener('click', () => {
            this.isYamlEditMode = !this.isYamlEditMode;
            toggleBtn.textContent = this.isYamlEditMode ? 'View YAML' : 'Edit YAML';
            if (this.isYamlEditMode) {
                viewer.classList.remove('active');
                editor.classList.remove('hidden');
                editor.style.display = 'block';
                viewer.style.display = 'none';
            } else {
                this.updateJsonView(); // Update from editor to viewer
                editor.classList.add('hidden');
                viewer.classList.add('active');
                editor.style.display = 'none';
                viewer.style.display = 'block';
            }
        });

        hideBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            handle.style.display = 'none';
            showBtn.style.display = 'block';
        });

        showBtn.addEventListener('click', () => {
            panel.style.display = 'flex';
            handle.style.display = 'block';
            showBtn.style.display = 'none';
        });

        // Initial state
        editor.classList.add('hidden');
        editor.style.display = 'none';
        viewer.classList.add('active');
    }

    bindGlobalEvents() {
        // YAML Editor changes
        this.yamlEditor.addEventListener('input', () => {
            try {
                const data = jsyaml.load(this.yamlEditor.value);
                if (this.currentTemplate) {
                    this.currentTemplate.content = data;
                    this.ui.renderForm();
                    this.markAsChanged();
                    document.querySelector('.panel-header').classList.remove('json-error');
                }
            } catch (e) {
                document.querySelector('.panel-header').classList.add('json-error');
            }
        });

        // Global Inputs
        document.addEventListener('input', (e) => {
            if (e.target.dataset.path) {
                const path = e.target.dataset.path;
                const value = e.target.value;

                // Helper to set nested value
                const setPath = (obj, path, val) => {
                    const keys = path.split('.');
                    const lastKey = keys.pop();
                    const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
                    target[lastKey] = val;
                };

                if (this.currentTemplate) {
                    // Special handling for reference field (convert to array)
                    if (path === 'info.reference') {
                        const references = value.split('\n').filter(r => r.trim() !== '');
                        setPath(this.currentTemplate.content, path, references.length > 0 ? references : '');
                    } else {
                        setPath(this.currentTemplate.content, path, value);
                    }
                    this.updateJsonView();
                }
            }
        });

        // Page Navigation
        document.getElementById('btn-show-templates').addEventListener('click', () => {
            this.showPage('templates');
        });

        document.getElementById('btn-show-editor').addEventListener('click', () => {
            if (this.currentTemplateId) {
                this.showPage('editor');
            } else {
                alert('Please select or create a template first.');
            }
        });

        document.getElementById('btn-back-to-templates').addEventListener('click', () => {
            this.showPage('templates');
        });

        // Buttons
        document.getElementById('btn-new').addEventListener('click', () => {
            if (this.hasUnsavedChanges && !confirm('You have unsaved changes. Continue?')) {
                return;
            }
            this.ui.renderNewTemplateModal();
        });

        document.getElementById('btn-open').addEventListener('click', () => {
            document.getElementById('btn-import-templates').click();
        });

        document.getElementById('btn-download').addEventListener('click', () => {
            if (this.currentTemplateId) {
                this.templateManager.downloadTemplate(this.currentTemplateId);
            }
        });

        document.getElementById('btn-copy').addEventListener('click', () => {
            if (this.isYamlEditMode) {
                copyToClipboard(this.yamlEditor.value);
            } else {
                copyToClipboard(document.getElementById('yaml-viewer').textContent);
            }
        });

        // Save/Discard
        document.getElementById('btn-save-template').addEventListener('click', () => {
            this.saveCurrentTemplate();
        });

        document.getElementById('btn-discard-changes').addEventListener('click', () => {
            if (confirm('Discard changes?')) {
                this.loadTemplate(this.currentTemplateId); // Reload from manager
            }
        });
    }

    bindTemplateEvents() {
        // Create Template
        document.getElementById('btn-create-template').addEventListener('click', () => {
            this.ui.renderNewTemplateModal();
        });

        // Import Templates
        document.getElementById('btn-import-templates').addEventListener('click', () => {
            // Check for unsaved changes
            if (this.hasUnsavedChanges) {
                if (!confirm('You have unsaved changes. Do you want to discard them and continue importing?')) {
                    return;
                }
            }

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.yaml,.json';
            input.multiple = true;
            input.onchange = (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;
                this.templateManager.importTemplates(files).then(res => {
                    this.renderTemplatesList();
                    this.updateTemplateStats();
                    alert(`Imported ${res.imported.length} templates.`);

                    // Auto-open the first imported template
                    if (res.firstImportedId) {
                        this.loadTemplate(res.firstImportedId);
                    }
                });
            };
            input.click();
        });

        // Download All
        document.getElementById('btn-download-all').addEventListener('click', () => {
            this.templateManager.downloadAllTemplates();
        });

        // Search
        document.getElementById('template-search').addEventListener('input', (e) => {
            this.renderTemplatesList(e.target.value);
        });
    }

    createTemplate(name, protocol = 'HTTP') {
        const template = this.templateManager.createTemplate(name, protocol);
        this.loadTemplate(template.internalId);
    }

    renderTemplatesList(query) {
        this.ui.renderTemplatesList(query);
    }

    loadTemplate(internalId) {
        const template = this.templateManager.getTemplate(internalId);
        if (template) {
            this.currentTemplateId = internalId;
            // Create a deep copy for editing
            this.currentTemplate = JSON.parse(JSON.stringify(template));
            this.hasUnsavedChanges = false;

            this.showPage('editor');
            this.ui.renderForm();
            this.updateJsonView();
            this.updateCurrentTemplateInfo();
            this.saveSessionState();
        }
    }

    saveCurrentTemplate() {
        if (this.currentTemplateId && this.currentTemplate) {
            this.templateManager.updateTemplate(this.currentTemplateId, this.currentTemplate.content);
            this.hasUnsavedChanges = false;
            this.updateCurrentTemplateInfo();
            this.renderTemplatesList();
            this.updateTemplateStats();
            alert('Template saved!');
        }
    }

    cleanEmptyFields(obj) {
        if (Array.isArray(obj)) {
            return obj.filter(item => {
                if (typeof item === 'object' && item !== null) {
                    const cleaned = this.cleanEmptyFields(item);
                    return Object.keys(cleaned).length > 0;
                }
                return item !== '' && item !== null && item !== undefined;
            }).map(item => typeof item === 'object' && item !== null ? this.cleanEmptyFields(item) : item);
        }

        if (typeof obj === 'object' && obj !== null) {
            const cleaned = {};
            for (const [key, value] of Object.entries(obj)) {
                // Skip empty values
                if (value === '' || value === null || value === undefined) {
                    continue;
                }
                // Skip empty arrays
                if (Array.isArray(value) && value.length === 0) {
                    continue;
                }
                // Skip empty objects
                if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
                    continue;
                }
                // Recursively clean nested objects
                if (typeof value === 'object' && value !== null) {
                    const cleanedValue = this.cleanEmptyFields(value);
                    if (Array.isArray(cleanedValue) && cleanedValue.length === 0) {
                        continue;
                    }
                    if (!Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) {
                        continue;
                    }
                    cleaned[key] = cleanedValue;
                } else {
                    cleaned[key] = value;
                }
            }
            return cleaned;
        }

        return obj;
    }

    updateJsonView() {
        if (!this.currentTemplate) return;

        // Clean empty fields before generating YAML
        const cleanedContent = this.cleanEmptyFields(JSON.parse(JSON.stringify(this.currentTemplate.content)));

        const yaml = dumpYaml(cleanedContent);
        this.yamlEditor.value = yaml;

        if (!this.isYamlEditMode) {
            // Use syntax highlighting for viewer
            document.getElementById('yaml-viewer').innerHTML = highlightYAML(yaml);
        }

        this.markAsChanged();
    }

    markAsChanged() {
        if (!this.hasUnsavedChanges) {
            this.hasUnsavedChanges = true;
            this.updateCurrentTemplateInfo();
        }
    }

    updateCurrentTemplateInfo() {
        if (this.currentTemplate) {
            const nameEl = document.querySelector('.current-template-info .template-name');
            nameEl.textContent = this.currentTemplate.content.info.name || 'Unnamed Template';
            if (this.hasUnsavedChanges) {
                nameEl.textContent += ' *';
            }

            document.getElementById('btn-save-template').disabled = !this.hasUnsavedChanges;
            document.getElementById('btn-discard-changes').disabled = !this.hasUnsavedChanges;
        }
    }

    showPage(page) {
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.page-nav-btn').forEach(b => b.classList.remove('active'));

        if (page === 'templates') {
            document.getElementById('templates-page').classList.add('active');
            document.getElementById('btn-show-templates').classList.add('active');
        } else {
            document.getElementById('editor-page').classList.add('active');
            document.getElementById('btn-show-editor').classList.add('active');
        }
        this.saveSessionState();
    }

    addRequest() {
        if (!this.currentTemplate) return;

        // Determine protocol and add appropriate request
        const content = this.currentTemplate.content;
        if (content.http) {
            content.http.push({ method: 'GET', path: ['{{BaseURL}}'], matchers: [], extractors: [] });
            this.ui.activeRequestIndex = content.http.length - 1;
        } else if (content.dns) {
            content.dns.push({ name: '{{FQDN}}', type: 'A', class: 'inet', recursion: true, retries: 3, matchers: [], extractors: [] });
        } else if (content.network) {
            content.network.push({ host: ['{{Hostname}}'], inputs: [{ data: '' }], matchers: [], extractors: [] });
        }
        // ... other protocols

        this.ui.renderProtocolEditor();
        this.updateJsonView();
    }

    removeRequest(index) {
        if (!this.currentTemplate) return;

        const content = this.currentTemplate.content;
        let list = null;
        if (content.http) list = content.http;
        else if (content.dns) list = content.dns;
        else if (content.network) list = content.network;

        if (list) {
            list.splice(index, 1);
            this.ui.activeRequestIndex = Math.max(0, list.length - 1);
            this.ui.renderProtocolEditor();
            this.updateJsonView();
        }
    }

    updateTemplateStats() {
        const stats = this.templateManager.getStats();
        const container = document.getElementById('template-stats');
        container.innerHTML = `
            <div class="stat-item">
                <span class="stat-value">${stats.total}</span>
                <span class="stat-label">Total</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.high}</span>
                <span class="stat-label">High/Crit</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.recent}</span>
                <span class="stat-label">Recent</span>
            </div>
        `;
    }

    saveSessionState() {
        const state = {
            currentTemplateId: this.currentTemplateId,
            page: document.getElementById('templates-page').classList.contains('active') ? 'templates' : 'editor'
        };
        localStorage.setItem('nuclei-session', JSON.stringify(state));
    }

    restoreSessionState() {
        try {
            const saved = localStorage.getItem('nuclei-session');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.currentTemplateId) {
                    this.loadTemplate(state.currentTemplateId);
                }
                if (state.page) {
                    this.showPage(state.page);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
