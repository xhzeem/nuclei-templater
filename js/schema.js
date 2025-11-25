// Nuclei Template Schema Definitions

const severities = ['info', 'low', 'medium', 'high', 'critical', 'unknown'];
const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];
const matcherTypes = ['word', 'regex', 'binary', 'status', 'size', 'dsl'];
const extractorTypes = ['regex', 'json', 'xpath', 'dsl', 'kval'];
const matcherConditions = ['or', 'and'];
const matcherParts = ['body', 'header', 'all', 'response', 'request'];

// Protocol Types
const protocolTypes = [
    'HTTP', 'Headless', 'Network', 'DNS', 'File',
    'JavaScript', 'Code', 'Flow', 'Multi-protocol'
];

// Default Template Structure
const defaultNucleiTemplate = {
    id: '',
    info: {
        name: '',
        author: '',
        severity: 'info',
        description: '',
        tags: '',
        reference: '',
        metadata: {}
    }
};

// Protocol Specific Schemas
const protocolSchemas = {
    HTTP: {
        http: [{
            method: 'GET',
            path: ['{{BaseURL}}'],
            headers: {},
            body: '',
            matchers: [],
            extractors: [],
            // raw: [], // Alternative to method/path/body
            // fuzzing: [] // For DAST mode
        }]
    },
    Headless: {
        headless: [{
            steps: [{
                action: 'navigate',
                args: {
                    url: '{{BaseURL}}'
                }
            }],
            matchers: [],
            extractors: []
        }]
    },
    Network: {
        network: [{
            host: ['{{Hostname}}'],
            inputs: [{
                data: ''
            }],
            matchers: [],
            extractors: []
        }]
    },
    DNS: {
        dns: [{
            name: '{{FQDN}}',
            type: 'A',
            class: 'inet',
            recursion: true,
            retries: 3,
            matchers: [],
            extractors: []
        }]
    },
    File: {
        file: [{
            extensions: ['all'],
            matchers: [],
            extractors: []
        }]
    },
    JavaScript: {
        javascript: [{
            code: '',
            args: {},
            matchers: [],
            extractors: []
        }]
    },
    Code: {
        code: [{
            engine: ['sh', 'bash'],
            source: '',
            matchers: [],
            extractors: []
        }]
    },
    Flow: {
        flow: '',
        // Flow usually combines other protocols, so we might initialize with empty arrays for them
        http: [],
        network: [],
        dns: []
    },
    'Multi-protocol': {
        // Multi-protocol is similar to Flow but might not use the flow logic explicitly, 
        // or it's just a container for multiple protocols.
        http: [],
        network: [],
        dns: []
    }
};

// Helper Lists
const dnsTypes = ['A', 'NS', 'CNAME', 'SOA', 'PTR', 'MX', 'TXT', 'AAAA'];
const dnsClasses = ['inet', 'cs', 'ch', 'hs', 'any'];
const networkInputTypes = ['text', 'hex'];
const headlessActions = [
    'navigate', 'script', 'click', 'rightclick', 'text', 'screenshot',
    'time', 'select', 'files', 'waitload', 'waitfcp', 'waitfmp',
    'waitdom', 'waitidle', 'waitstable', 'waitdialog', 'getresource',
    'extract', 'setmethod', 'addheader', 'setheader', 'deleteheader',
    'setbody', 'waitevent', 'keyboard', 'debug', 'sleep'
];
const codeEngines = ['sh', 'bash', 'py', 'python3', 'go', 'ps', 'powershell'];

// Additional Components Schema
const additionalComponents = {
    variables: {},
    'helper-functions': {}, // Custom helper functions (not standard in YAML, maybe preprocessors?)
    preprocessors: [],
    'template-signing': {
        enabled: false,
        signature: ''
    },
    'oob-testing': {
        enabled: false,
        url: '{{interactsh-url}}'
    }
};
