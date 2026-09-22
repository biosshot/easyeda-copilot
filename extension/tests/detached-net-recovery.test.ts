import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the real recovery function without loading the editor-dependent imports.
const file = resolve(__dirname, '../src/eda/assemble-source.ts');
const code = ts.transpileModule(
    readFileSync(file, 'utf8') + '\nexport const recoverForTest = resolveDetachedNets;',
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
