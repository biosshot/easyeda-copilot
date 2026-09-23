import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the real recovery function without loading the editor-dependent imports.
const file = resolve(__dirname, '../src/eda/assemble-source.ts');
const code = ts.transpileModule(
    readFileSync(file, 'utf8') + '\nexport const recoverForTest = resolveDetachedNets; export const workingCircuitForTest = createSourceWorkingCircuit; export const seedForTest = createSeedComponent; export const nativePortForTest = createNativeNetPort;',
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: file },
).outputText;

test('removing a resistor does not attach new flags to its old ports, but recovers real component pins', async () => {
    const types = { COMPONENT: 'part', NET_FLAG: 'netflag', NET_PORT: 'netport', SHORT_CIRCUIT_FLAG: 'short' };
    const items = [
        { id: 'old-ground', type: types.NET_FLAG, x: 10, net: 'GND' },
        { id: 'old-output', type: types.NET_PORT, x: 20, net: 'AMP_OUT' },
        { id: 'old-short', type: types.SHORT_CIRCUIT_FLAG, x: 30, net: 'AMP_OUT' },
        { id: 'U1', type: types.COMPONENT, x: 40, net: 'AMP_OUT' },
        { id: 'R1', type: types.COMPONENT, x: 50, net: 'GND' },
    ];
    const pinReads: string[] = [];
    const exports: Record<string, any> = {};
    runInNewContext(code, {
        exports,
        ESCH_PrimitiveComponentType: types,
        eda: { sch_PrimitiveComponent: { getAll: async () => items.map(item => ({
            getState_ComponentType: () => item.type,
            getState_PrimitiveId: () => item.id,
            getState_Designator: () => item.id,
        })) } },
        require(name: string) {
            if (name === './utils') return { to2: (value: number) => Math.round(value * 100) / 100 };
            if (name === './search') return { getPrimitiveComponentPins: async (id: string) => {
                pinReads.push(id);
                const item = items.find(item => item.id === id)!;
                return [{ getState_X: () => item.x, getState_Y: () => 0,
                    getState_PinNumber: () => '1', getState_PinName: () => '1' }];
            } };
            return {};
        },
    });
    const recovered = await exports.recoverForTest(items.map(item => ({ x: item.x, y: 0, net: item.net })));
    assert.deepEqual(JSON.parse(JSON.stringify(recovered)), [
        { designator: 'U1', pin_number: '1', pin_name: '1', net: 'AMP_OUT' },
        { designator: 'R1', pin_number: '1', pin_name: '1', net: 'GND' },
    ]);
    assert.deepEqual(pinReads, ['U1', 'R1']);
});

test('replacement drops generated short symbols whose only edges belonged to the replaced part', () => {
    const exports: Record<string, any> = {};
    runInNewContext(code, {
        exports, structuredClone,
        require(name: string) {
            if (name === './assembly-symbols') return { getNetFlagKind: () => undefined };
            if (name === './utils') return { rmPartFromDesignator: (value: string) => value };
            return {};
        },
    });
    const component = (designator: string) => ({ designator, value: '10k', pins: [] });
    const edge = (left: string, right: string) => ({ sections: [{
        incomingShape: `${left}_pin_1`, outgoingShape: `${right}_pin_1`,
    }] });
    const circuit = {
        replace_components: ['R3'], rm_components: ['R3'],
        components: [
            component('R3'), component('GND|old'), component('AMP_OUT|old'),
            component('U1'), component('VCC|keep'), component('AMP_OUT|shared'),
        ],
        edges: [
            edge('R3', 'GND|old'), edge('R3', 'AMP_OUT|old'),
            edge('U1', 'VCC|keep'), edge('U1', 'AMP_OUT|shared'),
            edge('AMP_OUT|shared', 'R3'),
        ],
    };
    const result = exports.workingCircuitForTest(circuit);
    assert.deepEqual(result.components.map((item: { designator: string }) => item.designator),
        ['R3', 'U1', 'VCC|keep', 'AMP_OUT|shared']);
    assert.equal(result.edges.length, 2);
    assert.deepEqual(result.rm_components, []);
});

test('missing library BI port falls back to the native BI port at its contact rotation', async () => {
    const calls: Array<{ direction: string; rotation: number }> = [];
    const primitive = {
        setState_Name() { return this; },
        setState_OtherProperty() { return this; },
        async done() { return this; },
    };
    const exports: Record<string, any> = {};
    runInNewContext(code, {
        exports,
        ESYS_LogType: { WARNING: 'warning' },
        eda: {
            sys_Environment: { isOnlineMode: () => true },
            sys_Log: { add() {} },
            sch_PrimitiveComponent: {
                async create() { throw new Error('library unavailable'); },
                async createNetPort(direction: string, _net: string, _x: number, _y: number, rotation: number) {
                    calls.push({ direction, rotation });
                    return primitive;
                },
            },
        },
        require(name: string) {
            if (name === './assembly-symbols') return {
                getNetFlagKind: () => undefined, getNetPortStyle: () => undefined,
                getSpecialSignalName: () => 'DATA',
            };
            if (name === './types') return {
                isNetPortUuid: (uuid: string) => uuid === 'new-bi',
                STYLED_NET_PORT_COMPONENTS: { bi: { uuid: 'new-bi', libraryUuid: 'lib' } },
            };
            if (name === '@copilot/shared/types/lcsc') return { getPartUuid: (value: string) => value };
            if (name === './utils') return { to2: (value: number) => value };
            return {};
        },
    });
    const result = await exports.seedForTest({
        input: { designator: 'DATA|port', part_uuid: 'new-bi', pins: [{ signal_name: 'DATA' }], pos: { rotate: 0 } },
        apiX: 100, apiY: 200,
    });
    assert.equal(result, primitive);
    assert.deepEqual(calls, [{ direction: 'BI', rotation: 90 }]);
});

test('unsupported native direction falls back to BI without failing the placement', async () => {
    const directions: string[] = [];
    const exports: Record<string, any> = {};
    runInNewContext(code, {
        exports,
        ESYS_LogType: { WARNING: 'warning' },
        eda: {
            sys_Log: { add() {} },
            sch_PrimitiveComponent: { async createNetPort(direction: string) {
                directions.push(direction);
                if (direction === 'OUT') throw new Error('OUT unavailable');
                return { done: async () => undefined };
            } },
        },
        require(name: string) {
            if (name === './assembly-symbols') return { getSpecialSignalName: () => 'DATA' };
            if (name === './utils') return { to2: (value: number) => value };
            return {};
        },
    });
    const result = await exports.nativePortForTest(
        { designator: 'DATA|port', pins: [{ signal_name: 'DATA' }] },
        { apiX: 0, apiY: 0 }, 'out', 90, false,
    );
    assert.ok(result);
    assert.deepEqual(directions, ['OUT', 'BI']);
});
