// Nuclei Template Variables Autocomplete
const nucleiVariables = [
    { name: '{{BaseURL}}', description: 'Full URL with path (e.g., https://example.com:443/foo/bar.php)' },
    { name: '{{RootURL}}', description: 'Root URL without path (e.g., https://example.com:443)' },
    { name: '{{Hostname}}', description: 'Hostname with port (e.g., example.com:443)' },
    { name: '{{Host}}', description: 'Hostname without port (e.g., example.com)' },
    { name: '{{Port}}', description: 'Port number (e.g., 443)' },
    { name: '{{Path}}', description: 'URL path (e.g., /foo)' },
    { name: '{{File}}', description: 'Filename (e.g., bar.php)' },
    { name: '{{Scheme}}', description: 'URL scheme (e.g., https)' },
    { name: '{{FQDN}}', description: 'Fully qualified domain name' },
    { name: '{{RDN}}', description: 'Root domain name' },
    { name: '{{DN}}', description: 'Domain name' },
    { name: '{{SD}}', description: 'Subdomain' },
    { name: '{{interactsh-url}}', description: 'Interactsh server URL for OOB testing' },
    { name: '{{to_lower()}}', description: 'Convert to lowercase' },
    { name: '{{to_upper()}}', description: 'Convert to uppercase' },
    { name: '{{repeat()}}', description: 'Repeat string' },
    { name: '{{replace()}}', description: 'Replace string' },
    { name: '{{trim()}}', description: 'Trim whitespace' },
    { name: '{{base64()}}', description: 'Base64 encode' },
    { name: '{{base64_decode()}}', description: 'Base64 decode' },
    { name: '{{url_encode()}}', description: 'URL encode' },
    { name: '{{url_decode()}}', description: 'URL decode' },
    { name: '{{hex_encode()}}', description: 'Hex encode' },
    { name: '{{hex_decode()}}', description: 'Hex decode' },
    { name: '{{html_escape()}}', description: 'HTML escape' },
    { name: '{{html_unescape()}}', description: 'HTML unescape' },
    { name: '{{md5()}}', description: 'MD5 hash' },
    { name: '{{sha256()}}', description: 'SHA256 hash' },
    { name: '{{sha1()}}', description: 'SHA1 hash' },
    { name: '{{rand_int()}}', description: 'Random integer' },
    { name: '{{rand_text_alpha()}}', description: 'Random alphabetic text' },
    { name: '{{rand_text_alphanumeric()}}', description: 'Random alphanumeric text' },
    { name: '{{rand_text_numeric()}}', description: 'Random numeric text' },
    { name: '{{rand_ip()}}', description: 'Random IP address' },
    { name: '{{to_number()}}', description: 'Convert to number' },
    { name: '{{concat()}}', description: 'Concatenate strings' },
    { name: '{{contains()}}', description: 'Check if contains substring' },
    { name: '{{regex()}}', description: 'Regular expression match' }
];

// Add autocomplete to textarea/input fields
function addNucleiAutocomplete(element) {
    let autocompleteList = null;
    let selectedIndex = -1;

    element.addEventListener('input', (e) => {
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = e.target.value.substring(0, cursorPos);

        // Check if we just typed {{
        const match = textBeforeCursor.match(/\{\{([^}]*)$/);

        if (match) {
            const searchTerm = match[1].toLowerCase();
            const filtered = nucleiVariables.filter(v =>
                v.name.toLowerCase().includes(searchTerm) ||
                v.description.toLowerCase().includes(searchTerm)
            );

            if (filtered.length > 0) {
                showAutocomplete(element, filtered, cursorPos - match[0].length);
            } else {
                hideAutocomplete();
            }
        } else {
            hideAutocomplete();
        }
    });

    element.addEventListener('keydown', (e) => {
        if (!autocompleteList) return;

        const items = autocompleteList.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex].click();
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });

    function showAutocomplete(input, suggestions, startPos) {
        hideAutocomplete();

        autocompleteList = document.createElement('div');
        autocompleteList.className = 'nuclei-autocomplete';
        autocompleteList.style.position = 'absolute';
        autocompleteList.style.zIndex = '1000';

        // Position below the input
        const rect = input.getBoundingClientRect();
        autocompleteList.style.top = (rect.bottom + window.scrollY) + 'px';
        autocompleteList.style.left = rect.left + 'px';
        autocompleteList.style.minWidth = '300px';
        autocompleteList.style.maxWidth = '500px';

        selectedIndex = 0;

        suggestions.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            if (index === 0) div.classList.add('selected');

            div.innerHTML = `
                <div class="autocomplete-name">${item.name}</div>
                <div class="autocomplete-desc">${item.description}</div>
            `;

            div.addEventListener('click', () => {
                insertVariable(input, item.name, startPos);
                hideAutocomplete();
            });

            autocompleteList.appendChild(div);
        });

        document.body.appendChild(autocompleteList);
    }

    function updateSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function insertVariable(input, variable, startPos) {
        const value = input.value;
        const cursorPos = input.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPos);
        const match = textBeforeCursor.match(/\{\{([^}]*)$/);

        if (match) {
            const before = value.substring(0, startPos);
            const after = value.substring(cursorPos);
            input.value = before + variable + after;
            input.selectionStart = input.selectionEnd = before.length + variable.length;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function hideAutocomplete() {
        if (autocompleteList) {
            autocompleteList.remove();
            autocompleteList = null;
            selectedIndex = -1;
        }
    }

    // Hide on click outside
    document.addEventListener('click', (e) => {
        if (e.target !== element && !autocompleteList?.contains(e.target)) {
            hideAutocomplete();
        }
    });
}

// Initialize autocomplete on relevant fields
document.addEventListener('DOMContentLoaded', () => {
    // Add to all textareas and inputs that might use Nuclei variables
    const selector = 'textarea[data-path], input[type="text"][data-path], .req-input, .fuzz-values, .matcher-content, .extractor-content';

    const initAutocomplete = () => {
        document.querySelectorAll(selector).forEach(element => {
            if (!element.hasAttribute('data-autocomplete-initialized')) {
                addNucleiAutocomplete(element);
                element.setAttribute('data-autocomplete-initialized', 'true');
            }
        });
    };

    // Initial setup
    initAutocomplete();

    // Re-initialize when new elements are added (e.g., new matchers/extractors)
    const observer = new MutationObserver(initAutocomplete);
    observer.observe(document.body, { childList: true, subtree: true });
});
