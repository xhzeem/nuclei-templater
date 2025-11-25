function dumpYaml(obj) {
    if (window.jsyaml) {
        return jsyaml.dump(obj, { indent: 2, lineWidth: -1 });
    }
    return "js-yaml library not loaded.";
}

function downloadFile(content, filename, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Simple YAML syntax highlighter
function highlightYAML(yaml) {
    if (!yaml) return '';

    // Process line by line without pre-escaping
    const lines = yaml.split('\n');
    const highlighted = lines.map(line => {
        // Escape HTML entities in the line first
        let escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Comments (entire line)
        if (escaped.trim().startsWith('#')) {
            return `<span class="yaml-comment">${escaped}</span>`;
        }

        // Match key: value pattern
        const keyMatch = escaped.match(/^(\s*)([a-zA-Z0-9_-]+)(\s*):(.*)/);
        if (keyMatch) {
            const [, indent, key, spacing, rest] = keyMatch;
            let value = rest;

            // Highlight strings in quotes
            value = value.replace(/"([^"]*)"/g, '<span class="yaml-string">"$1"</span>');
            value = value.replace(/'([^']*)'/g, '<span class="yaml-string">\'$1\'</span>');

            // Highlight numbers
            value = value.replace(/^\s+(-?\d+\.?\d*)(\s|$)/g, ' <span class="yaml-number">$1</span>$2');

            // Highlight booleans
            value = value.replace(/^\s+(true|false|yes|no|on|off)(\s|$)/gi, ' <span class="yaml-boolean">$1</span>$2');

            // Highlight null
            value = value.replace(/^\s+(null|~)(\s|$)/gi, ' <span class="yaml-null">$1</span>$2');

            return `${indent}<span class="yaml-key">${key}</span>${spacing}:${value}`;
        }

        // List markers
        const listMatch = escaped.match(/^(\s*)-(\s+)(.*)/);
        if (listMatch) {
            const [, indent, spacing, rest] = listMatch;
            let value = rest;

            // Highlight strings in quotes
            value = value.replace(/"([^"]*)"/g, '<span class="yaml-string">"$1"</span>');
            value = value.replace(/'([^']*)'/g, '<span class="yaml-string">\'$1\'</span>');

            return `${indent}<span class="yaml-list">-</span>${spacing}${value}`;
        }

        return escaped;
    });

    return highlighted.join('\n');
}
