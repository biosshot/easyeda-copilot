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
    runInNewContext(code, {
        exports, require: (name: string) => {
            if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
            return imports[name];
        }, setTimeout, ...globals
    }, { filename: file });
    return exports;
}

function editor(options: { version?: number; changePage?: boolean; failWires?: boolean; missingPin?: boolean; duplicate?: boolean; staleOnce?: boolean; subPartName?: string; failPins?: boolean; failNetlist?: boolean; conflicting?: boolean; badWire?: boolean } = {}) {
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
                if (options.failPins && id === 'c') throw new Error('pin read failed');
                return [{ getState_PinNumber: () => '1', getState_X: () => id === 'r' ? 0 : 20, getState_Y: () => 50 }];
            },
        },
        sch_PrimitiveWire: {
            getAll: async () => {
                wireReads++;
                if (options.failWires) throw new Error('wire read failed');
                return [
                    ...(options.badWire ? [{ getState_Line: () => { throw new Error('bad wire'); }, getState_Net: () => '' }] : []),
                    { getState_Line: () => [0, 50, 20, 50], getState_Net: () => 'stale-wire-name' },
                ];
            }
        },
    };
    const module = load('../src/eda/schematic-groups.ts', {
        './types': {
            shortSymbolsMap: {
                GND: { is: (name: string) => name.toLowerCase().includes('gnd') },
                VCC: { is: (name: string) => /^(?:V|USB_V|BATTERY)/i.test(name) },
            }
        },
        './schematic': {
            getSchematic: async (ids: string[], settings: unknown) => {
                netReads++;
                if (options.failNetlist) throw new Error("netlist read failed");
                assert.equal(JSON.stringify(ids), '["r","c"]');
                assert.equal(JSON.stringify(settings), '{"disableExtractPartUuid":true,"disableExtractPos":true}');
                return {
                    components: [
                        { designator: 'R1', pins: [{ pin_number: '1', signal_name: '3V3' }] },
                        { designator: 'C1', pins: options.missingPin ? [] : [{ pin_number: '1', signal_name: options.conflicting || options.staleOnce && netReads === 1 ? 'WRONG' : '3V3' }] },
                    ]
                };
            }
        },
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
    for (const version of [2, 3]) for (const suffix of ['2', 'B']) {
        const e = editor({ version, subPartName: `MAX942CSA+.${suffix}` });
        assert.equal(JSON.stringify(await e.run()), JSON.stringify({
            maybe_blocks: [`C1 R1.${suffix}`], wires: expected.wires,
        }));
        assert.deepEqual(e.counts(), { netReads: 1, wireReads: 1 });
    }
});

test('live adapter returns position-only groups if wires are unavailable and retains pins with missing net names', async () => {
    const noWires = await editor({ failWires: true }).run();
    assert.equal(JSON.stringify(noWires.maybe_blocks), JSON.stringify(expected.maybe_blocks));
    assert.equal(JSON.stringify(noWires.wires), '[]');
    assert.match(noWires.errors.join(' '), /Wires unavailable/);
    const missing = await editor({ missingPin: true }).run();
    assert.equal(JSON.stringify(missing.wires), JSON.stringify(expected.wires));
    assert.match(missing.errors.join(' '), /pin nets unavailable/);
});

test('live adapter reports duplicates but still rejects changing documents', async () => {
    const duplicate = await editor({ duplicate: true }).run();
    assert.equal(JSON.stringify(duplicate.wires), '[]');
    assert.match(duplicate.errors.join(' '), /R1: duplicate/);
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

test('MCP registration is read-only, forwards the full-schematic flag and returns only compact JSON', async () => {
    let textResultInput: unknown;
    const module = load('../../mcp/src/tools/schematic-groups.ts', {
        'zod/v4': {
            object: (shape: unknown) => shape,
            boolean: () => ({
                default: (value: boolean) => ({
                    default: value, describe: () => ({ default: value }),
                })
            }),
        },
        '../utils/tool-result': {
            textResult: (value: unknown) => {
                textResultInput = value;
                return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] };
            }
        },
        './handler': { toolHandler: (_bridge: unknown, callback: unknown) => callback },
    });
    let handler: ((input: { get_full_schematic_groups: boolean }) => Promise<any>) | undefined;
    let registrations = 0;
    const requests: unknown[] = [];
    module.registerSchematicGroupTools({
        registerTool: (name: string, config: any, callback: typeof handler) => {
            registrations++;
            assert.equal(name, 'get_schematic_groups');
            assert.equal(JSON.stringify(config.inputSchema), '{"get_full_schematic_groups":{"default":false}}');
            assert.equal(config.annotations.readOnlyHint, true);
            handler = callback;
        }
    }, {
        requestEasyEda: async (event: string, body: unknown, timeout: number) => {
            assert.equal(event, 'get-schematic-groups');
            requests.push(body);
            assert.equal(timeout, undefined, 'bridge applies the shared command timeout policy');
            return expected;
        }
    });
    const result = await handler!({ get_full_schematic_groups: false });
    await handler!({ get_full_schematic_groups: true });
    assert.equal(registrations, 1);
    assert.equal(JSON.stringify(requests), '[{"get_full_schematic_groups":false},{"get_full_schematic_groups":true}]');
    assert.equal(textResultInput, expected);
    assert.equal(JSON.stringify(result), JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(expected) }] }));
});

test('entry points register and dispatch the new tool without embedding analysis in the MCP client', () => {
    const client = readFileSync(resolve(__dirname, '../src/mcp-client.ts'), 'utf8');
    const stdioEntry = readFileSync(resolve(__dirname, '../../mcp/src/index.ts'), 'utf8');
    const cliEntry = readFileSync(resolve(__dirname, '../../mcp/src/cli.ts'), 'utf8');
    const server = readFileSync(resolve(__dirname, '../../mcp/src/server.ts'), 'utf8');
    assert.match(client, /body\.get_full_schematic_groups === true/);
    assert.match(client, /mergeSchematicGroups\(await readAllSchematicPages\(\(\) => getSchematicGroups\(\)\)\)/);
    assert.match(stdioEntry, /createServer\(bridge\)/);
    assert.match(cliEntry, /createServer\(bridge\)/);
    assert.match(server, /registerSchematicGroupTools\(server, bridge\);/);
});


test('live adapter accepts real single-part library names, with no library API available', async () => {
    for (const subPartName of ['FRC0603J104 TS.1', '470uF 25V 8*12.1']) {
        const result = await editor({ subPartName }).run();
        assert.equal(JSON.stringify(result), JSON.stringify(expected));
    }
});

test('failed pin read retains component position without invented connections', async () => {
    const result = await editor({ failPins: true }).run();
    assert.equal(JSON.stringify(result.maybe_blocks), JSON.stringify(expected.maybe_blocks));
    assert.equal(JSON.stringify(result.wires), '[]');
    assert.match(result.errors.join(' '), /C1: pins unavailable/);
});

test('netlist failure preserves geometry and valid wire metadata', async () => {
    const result = await editor({ failNetlist: true }).run();
    assert.equal(JSON.stringify(result.maybe_blocks), JSON.stringify(expected.maybe_blocks));
    assert.equal(result.wires[0].pins, 'C1.1 R1.1');
    assert.equal(result.wires[0].net, 'stale-wire-name');
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Netlist unavailable/);
});

test('failed wire getter does not reject other wires in the read', async () => {
    const result = await editor({ badWire: true }).run();
    assert.equal(JSON.stringify(result.wires), JSON.stringify(expected.wires));
    assert.match(result.errors.join(' '), /geometry omitted/);
});

test('persistently contradictory nets return partial data after exactly one retry', async () => {
    const e = editor({ conflicting: true });
    const result = await e.run();
    assert.equal(JSON.stringify(result.wires), '[]');
    assert.match(result.errors.join(' '), /Conflicting resolved nets/);
    assert.deepEqual(e.counts(), { netReads: 2, wireReads: 2 });
});

test('cannot read any component list remains a fatal read error', async () => {
    const e = editor();
    e.api.sch_PrimitiveComponent.getAll = async () => { throw new Error('component list unavailable'); };
    await assert.rejects(e.run(), /component list unavailable/);
});
