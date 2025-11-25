class TemplateManager {
    constructor() {
        this.templates = this.loadTemplatesFromStorage() || [];
        this.currentTemplateId = null;
        this.nextId = this.getNextId();
    }

    // Generate unique ID for new templates (internal ID, not Nuclei ID)
    getNextId() {
        const maxId = this.templates.reduce((max, template) => Math.max(max, template.internalId || 0), 0);
        return maxId + 1;
    }

    // Create a new template
    createTemplate(name = 'New Template', protocol = 'HTTP') {
        const defaultContent = JSON.parse(JSON.stringify(defaultNucleiTemplate));

        // Merge protocol specific schema
        if (protocolSchemas[protocol]) {
            Object.assign(defaultContent, JSON.parse(JSON.stringify(protocolSchemas[protocol])));
        }

        const newTemplate = {
            internalId: this.nextId++,
            name: name,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            content: defaultContent
        };

        // Set the template name and id
        newTemplate.content.info.name = name;
        newTemplate.content.id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        this.templates.push(newTemplate);
        this.saveTemplates();
        return newTemplate;
    }

    // Get template by Internal ID
    getTemplate(internalId) {
        return this.templates.find(t => t.internalId === internalId);
    }

    // Update template
    updateTemplate(internalId, content) {
        const template = this.getTemplate(internalId);
        if (template) {
            template.content = JSON.parse(JSON.stringify(content));
            template.modified = new Date().toISOString();
            // Update template name if info name changed
            if (content.info && content.info.name && content.info.name !== template.name) {
                template.name = content.info.name;
            }
            this.saveTemplates();
            return template;
        }
        return null;
    }

    // Delete template
    deleteTemplate(internalId) {
        const index = this.templates.findIndex(t => t.internalId === internalId);
        if (index !== -1) {
            this.templates.splice(index, 1);
            this.saveTemplates();
            return true;
        }
        return false;
    }

    // Duplicate template
    duplicateTemplate(internalId) {
        const original = this.getTemplate(internalId);
        if (original) {
            const duplicate = {
                internalId: this.nextId++,
                name: original.name + ' (Copy)',
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                content: JSON.parse(JSON.stringify(original.content))
            };
            duplicate.content.info.name = duplicate.name;
            duplicate.content.id = duplicate.content.id + '-copy';

            this.templates.push(duplicate);
            this.saveTemplates();
            return duplicate;
        }
        return null;
    }

    // Get all templates
    getAllTemplates() {
        return [...this.templates];
    }

    // Search templates
    searchTemplates(query) {
        if (!query) return this.getAllTemplates();

        const lowerQuery = query.toLowerCase();
        return this.templates.filter(template =>
            template.name.toLowerCase().includes(lowerQuery) ||
            (template.content.id && template.content.id.toLowerCase().includes(lowerQuery)) ||
            (template.content.info.author && template.content.info.author.toLowerCase().includes(lowerQuery))
        );
    }

    // Export single template (YAML)
    exportTemplate(internalId) {
        const template = this.getTemplate(internalId);
        if (template) {
            return dumpYaml(template.content);
        }
        return null;
    }

    // Export all templates (JSON of all templates, or ZIP? GBounty exports JSON array of profiles. 
    // For Nuclei, maybe we export a JSON array of template objects for backup purposes)
    exportAllTemplates() {
        return JSON.stringify(this.templates, null, 2);
    }

    // Import templates
    async importTemplates(files, overrideCallback = null) {
        const imported = [];
        const conflicts = [];

        // Helper to process a single file content
        const processContent = (content, filename) => {
            try {
                // Try parsing as YAML first, then JSON
                let data;
                try {
                    data = jsyaml.load(content);
                } catch (e) {
                    data = JSON.parse(content);
                }

                if (!data || !data.id || !data.info) {
                    throw new Error("Invalid Nuclei template format");
                }

                return data;
            } catch (e) {
                console.error(`Failed to parse ${filename}:`, e);
                return null;
            }
        };

        // Read all files
        const templatesToImport = [];
        for (const file of files) {
            const content = await file.text();
            const data = processContent(content, file.name);
            if (data) {
                templatesToImport.push(data);
            }
        }

        // Check conflicts
        templatesToImport.forEach((templateContent, index) => {
            const templateName = templateContent.info.name || templateContent.id;
            const existingTemplate = this.templates.find(t => t.name === templateName || t.content.id === templateContent.id);

            if (existingTemplate) {
                conflicts.push({
                    index,
                    content: templateContent,
                    templateName,
                    existingTemplate
                });
            }
        });

        // Handle conflicts
        let decisions = {};
        if (conflicts.length > 0 && overrideCallback) {
            decisions = await overrideCallback(conflicts);
        }

        // Process imports
        templatesToImport.forEach((content, index) => {
            const templateName = content.info.name || content.id;
            const conflict = conflicts.find(c => c.index === index);

            if (conflict) {
                const decision = decisions[conflict.templateName];
                if (decision === 'override') {
                    const existingTemplate = conflict.existingTemplate;
                    existingTemplate.content = content;
                    existingTemplate.modified = new Date().toISOString();
                    imported.push(existingTemplate);
                } else if (decision === 'rename' || !decision) { // Default to rename
                    let newName = templateName;
                    let counter = 1;
                    while (this.templates.some(t => t.name === newName)) {
                        newName = `${templateName} (${counter})`;
                        counter++;
                    }
                    content.info.name = newName;

                    const template = {
                        internalId: this.nextId++,
                        name: newName,
                        created: new Date().toISOString(),
                        modified: new Date().toISOString(),
                        content: content
                    };
                    this.templates.push(template);
                    imported.push(template);
                }
                // If skip, do nothing
            } else {
                const template = {
                    internalId: this.nextId++,
                    name: templateName,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    content: content
                };
                this.templates.push(template);
                imported.push(template);
            }
        });

        this.saveTemplates();
        return {
            imported,
            conflicts: conflicts.length,
            firstImportedId: imported.length > 0 ? imported[0].internalId : null
        };
    }

    // Download single template
    downloadTemplate(internalId, filename) {
        const yaml = this.exportTemplate(internalId);
        if (yaml) {
            const template = this.getTemplate(internalId);
            const name = filename || ((template.content.id || 'template') + '.yaml');
            downloadFile(yaml, name, 'text/yaml');
        }
    }

    // Download all templates (ZIP of YAML files)
    async downloadAllTemplates(filename = 'nuclei-templates.zip') {
        if (this.templates.length === 0) {
            alert('No templates to download');
            return;
        }

        try {
            const zip = new JSZip();

            // Add each template as a YAML file to the ZIP
            this.templates.forEach(template => {
                const yaml = dumpYaml(template.content);
                const templateId = template.content.id || 'template';
                const fileName = `${templateId}.yaml`;
                zip.file(fileName, yaml);
            });

            // Generate ZIP file
            const content = await zip.generateAsync({ type: 'blob' });

            // Download the ZIP
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to create ZIP:', error);
            alert('Failed to create ZIP file');
        }
    }

    // Save templates to localStorage
    saveTemplates() {
        try {
            localStorage.setItem('nuclei-templates', JSON.stringify(this.templates));
        } catch (error) {
            console.error('Failed to save templates:', error);
        }
    }

    // Load templates from localStorage
    loadTemplatesFromStorage() {
        try {
            const saved = localStorage.getItem('nuclei-templates');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to load templates:', error);
            return null;
        }
    }

    // Clear all templates
    clearAllTemplates() {
        this.templates = [];
        this.saveTemplates();
    }

    // Get stats
    getStats() {
        return {
            total: this.templates.length,
            high: this.templates.filter(t => t.content.info.severity === 'high' || t.content.info.severity === 'critical').length,
            recent: this.templates.filter(t => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(t.modified) > weekAgo;
            }).length
        };
    }
}
