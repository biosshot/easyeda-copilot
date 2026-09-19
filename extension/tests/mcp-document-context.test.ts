import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertMcpDocumentContext,
    requiredMcpDocumentContext,
} from '../src/eda/mcp-document-context.ts';

const globals = globalThis as typeof globalThis & {
    eda: { dmt_SelectControl: { getCurrentDocumentInfo: () => Promise<{ documentType: number } | undefined> } };
    EDMT_EditorDocumentType: { SCHEMATIC_PAGE: number; PCB: number };
};

globals.EDMT_EditorDocumentType = { SCHEMATIC_PAGE: 1, PCB: 2 };

function useDocument(documentType?: number) {
    globals.eda = {
        dmt_SelectControl: {
            getCurrentDocumentInfo: async () => documentType === undefined ? undefined : { documentType },
        },
    };
}

test('classifies MCP commands by required editor document', () => {
    assert.equal(requiredMcpDocumentContext('assemble-board', {}), 'pcb');
    assert.equal(requiredMcpDocumentContext('apply-routing-result', {}), 'pcb');
    assert.equal(requiredMcpDocumentContext('assemble-circuit', {}), 'schematic');
    assert.equal(requiredMcpDocumentContext('get-schematic-groups', {}), 'schematic');
    assert.equal(requiredMcpDocumentContext('get-schematic-groups', { get_full_schematic_groups: true }), 'schematic-or-linked-pcb');
    assert.equal(requiredMcpDocumentContext('get-current-project-info', {}), undefined);
});

test('rejects PCB commands before document-specific work starts', async () => {
    useDocument(1);
    await assert.rejects(
        assertMcpDocumentContext('assemble-board', {}),
        { message: 'Open the target PCB document first.' },
    );

    useDocument(undefined);
    await assert.rejects(
        assertMcpDocumentContext('check-pcb-drc', {}),
        { message: 'Open the target PCB document first.' },
    );
});

test('rejects schematic commands with an actionable error', async () => {
    useDocument(2);
    await assert.rejects(
        assertMcpDocumentContext('assemble-circuit', {}),
        { message: 'Open the target schematic page first.' },
    );
});

test('allows multi-page schematic commands from a schematic or linked PCB', async () => {
    for (const documentType of [1, 2]) {
        useDocument(documentType);
        await assert.doesNotReject(assertMcpDocumentContext('get-multi-page-schematic', {}));
    }

    useDocument(3);
    await assert.rejects(
        assertMcpDocumentContext('get-multi-page-schematic', {}),
        { message: 'Open a schematic page or a PCB linked to a schematic first.' },
    );
});
