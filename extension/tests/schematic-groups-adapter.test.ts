import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Compile the real entry points with read-only editor/bridge doubles. No editor,
// backend, network, or changes to the public module API are needed for these tests.
function load(relative: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
    const file = resolve(__dirname, relative);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: file,
    }).outputText;
    const exports: Record<string, any> = {};
    runInNewContext(code, { exports, require: (name: string) => {
        if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
        return imports[name];
    }, setTimeout, ...globals }, { filename: file });
    return exports;
}

function editor(options: { version?: number; changePage?: boolean; failWires?: boolean; missingPin?: boolean; duplicate?: boolean; staleOnce?: boolean; subPartName?: string } = {}) {
    let pageReads = 0, netReads = 0, wireReads = 0;
    const calls: string[] = [];
    const raw = (id: string, designator: string, x: number, kind = 'component') => ({
        getState_PrimitiveId: () => id, getState_Designator: () => designator,
        getState_ComponentType: () => kind, getState_SubPartName: () => id === 'r' ? options.subPartName ?? '' : '',
        getState_X: () => x, getState_Y: () => options.version === 2 ? -50 : 50,
    });
    const primitives = [raw('r', 'R1', 0), raw('c', options.duplicate ? 'R1' : 'C1', 20), raw('flag', '3V3|flag', 1e6, 'flag')];
    const api = {
        dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ documentType: 'sheet', uuid: options.changePage && pageReads++ ? 'other' : 'page', tabId: 'tab' }) },
        sch_PrimitiveComponent: {
            getAll: async () => { calls.push('components'); return primitives; },
            getAllPinsByPrimitiveId: async (id: string) => {
                calls.push(`pins:${id}`);
                assert.notEqual(id, 'flag');
                return [{ getState_PinNumber: () => '1', getState_X: () => id === 'r' ? 0 : 20, getState_Y: () => 50 }];
            },
        },
        sch_PrimitiveWire: { getAll: async () => {
            wireReads++;
            if (options.failWires) throw new Error('wire read failed');
            return [{ getState_Line: () => [0, 50, 20, 50], getState_Net: () => 'stale-wire-name' }];
        } },
    };
    const module = load('../src/eda/schematic-groups.ts', {
        './schematic': { getSchematic: async (ids: string[], settings: unknown) => {
            netReads++;
            assert.equal(JSON.stringify(ids), '["r","c"]');
            assert.equal(JSON.stringify(settings), '{"disableExtractPartUuid":true,"disableExtractPos":true}');
            return { components: [
                { designator: 'R1', pins: [{ pin_number: '1', signal_name: '3V3' }] },
                { designator: 'C1', pins: options.missingPin ? [] : [{ pin_number: '1', signal_name: options.staleOnce && netReads === 1 ? 'WRONG' : '3V3' }] },
            ] };
        } },
        './utils': { normalizeWireLine: (line: number[]) => [line], normWireY: (y: number) => options.version === 2 ? -y : y },
    }, { eda: api, EDMT_EditorDocumentType: { SCHEMATIC_PAGE: 'sheet' }, ESCH_PrimitiveComponentType: { COMPONENT: 'component' } });
    return { api, run: module.getSchematicGroups, calls, counts: () => ({ netReads, wireReads }) };
}

const expected = { maybe_blocks: ['C1 R1'], wires: [{ net: '3V3', pins: 'C1.1 R1.1' }] };

test('live adapter excludes flags, reads the whole page without selection or library requests, and normalizes v2 origins', async () => {
    for (const version of [2, 3]) {
        const e = editor({ version });
        assert.equal(JSON.stringify(await e.run()), JSON.stringify(expected));
        assert.deepEqual(e.calls, ['components', 'pins:r', 'pins:c']);
        assert.deepEqual(e.counts(), { netReads: 1, wireReads: 1 });
    }
});

test('live adapter preserves a lone numeric or named section without changing netlist/wire references', async () => {
    for (const version of [2, 3]) for (const subPartName of ['2', 'B']) {
        const e = editor({ version, subPartName });
        assert.equal(JSON.stringify(await e.run()), JSON.stringify({
            maybe_blocks: [`C1 R1.${subPartName}`], wires: expected.wires,
        }));
        assert.deepEqual(e.counts(), { netReads: 1, wireReads: 1 });
    }
});

test('live adapter does not silently turn read errors or omitted pins into empty success', async () => {
    await assert.rejects(editor({ failWires: true }).run(), /wire read failed/);
    await assert.rejects(editor({ missingPin: true }).run(), /Could not resolve schematic pin C1.1/);
});

test('live adapter rejects duplicate designators and changing documents', async () => {
    await assert.rejects(editor({ duplicate: true }).run(), /Duplicate designator R1/);
    await assert.rejects(editor({ changePage: true }).run(), /page changed/);
});

test('live adapter rejects non-schematic documents before reading primitives', async () => {
    const e = editor();
    e.api.dmt_SelectControl.getCurrentDocumentInfo = async () => ({ documentType: 'pcb', uuid: 'pcb', tabId: 'pcb' });
    await assert.rejects(e.run(), /Open a schematic page/);
    assert.deepEqual(e.calls, []);
});

test('live adapter takes a fresh snapshot once after inconsistent resolved nets', async () => {
    const e = editor({ staleOnce: true });
    assert.equal(JSON.stringify(await e.run()), JSON.stringify(expected));
    assert.deepEqual(e.counts(), { netReads: 2, wireReads: 2 });
});

test('MCP registration is read-only, forwards one request and returns only compact JSON', async () => {
    const module = load('../../mcp/src/tools/schematic-groups.ts', {
        'zod/v4': { object: (shape: unknown) => shape },
        '../utils/tool-result': { textResult: (text: string) => ({ content: [{ type: 'text', text }] }) },
    });
    let handler: (() => Promise<any>) | undefined;
    let registrations = 0, requests = 0;
    module.registerSchematicGroupTools({ registerTool: (name: string, config: any, callback: () => Promise<any>) => {
        registrations++;
        assert.equal(name, 'get_current_page_schematic_groups');
        assert.equal(JSON.stringify(config.inputSchema), '{}');
        assert.equal(config.annotations.readOnlyHint, true);
        handler = callback;
    } }, { requestEasyEda: async (event: string, body: unknown, timeout: number) => {
        requests++;
        assert.equal(event, 'get-schematic-groups');
        assert.equal(JSON.stringify(body), '{}');
        assert.equal(timeout, 120000);
        return expected;
    } });
    const result = await handler!();
    assert.equal(registrations, 1); assert.equal(requests, 1);
    assert.equal(JSON.stringify(result), JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(expected) }] }));
});

test('entry points register and dispatch the new tool without embedding analysis in the MCP client', () => {
    const client = readFileSync(resolve(__dirname, '../src/mcp-client.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../../mcp/src/index.ts'), 'utf8');
    assert.match(client, /if \(message.event === 'get-schematic-groups'\) \{\s*reply\(true, await getSchematicGroups\(\)\);\s*return;\s*\}/);
    assert.match(server, /registerSchematicGroupTools\(server, bridge\);/);
});
