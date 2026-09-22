export type McpDocumentContext = 'pcb' | 'schematic' | 'schematic-or-linked-pcb';

const PCB_EVENTS = new Set([
    'get-pcb',
    'get-pcb-raw',
    'preview-pcb',
    'get-pcb-existing-placement',
    'get-pcb-stack-layers',
    'get-pcb-drc-rules',
    'export-routing-input',
    'apply-routing-result',
    'check-pcb-drc',
    'inspect-net',
    'inspect-component',
    'import-pcb-changes',
    'assemble-board',
]);

const SCHEMATIC_EVENTS = new Set([
    'get-schematic',
    'assemble-circuit',
    'beautify-current-page',
]);

const SCHEMATIC_OR_LINKED_PCB_EVENTS = new Set([
    'annotate-designators',
    'get-multi-page-schematic',
]);

export function requiredMcpDocumentContext(event: string, body: Record<string, unknown>): McpDocumentContext | undefined {
    if (PCB_EVENTS.has(event)) return 'pcb';
    if (SCHEMATIC_EVENTS.has(event)) return 'schematic';
    if (SCHEMATIC_OR_LINKED_PCB_EVENTS.has(event)) return 'schematic-or-linked-pcb';
    if (event === 'get-schematic-groups') {
        return body.get_full_schematic_groups === true ? 'schematic-or-linked-pcb' : 'schematic';
    }
    return undefined;
}

/** Fail MCP commands before checkpoints or document-specific EasyEDA APIs hide the real problem. */
export async function assertMcpDocumentContext(event: string, body: Record<string, unknown>) {
    const expected = body.__easyedaCopilotDocumentUuid;
    if (typeof expected === 'string') {
        const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
        if (current?.uuid !== expected) throw new Error('Operation target document changed. Open the original document before applying its result.');
    }
    const required = requiredMcpDocumentContext(event, body);
    if (!required) return;

    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
    if (required === 'pcb') {
        if (document?.documentType !== EDMT_EditorDocumentType.PCB) {
            throw new Error('Open the target PCB document first.');
        }
        return;
    }

    if (required === 'schematic') {
        if (document?.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
            throw new Error('Open the target schematic page first.');
        }
        return;
    }

    if (document?.documentType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE
        && document?.documentType !== EDMT_EditorDocumentType.PCB) {
        throw new Error('Open a schematic page or a PCB linked to a schematic first.');
    }
}
