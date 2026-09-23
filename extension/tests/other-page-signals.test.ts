import test from 'node:test';
import assert from 'node:assert/strict';

test('Allegro netlist identifies signals with pins on another schematic page', async () => {
    (globalThis as any).eda = { sys_Environment: { getEditorCurrentVersion: () => '3.0.0' } };
    const { signalsOnOtherPages } = await import('../src/eda/schematic');
    const netlist = `$NETS
RESET ; U1.1 R2.1
LOCAL ; U1.2 R1.1
GND ; U1.3 R2.2
NC ; U1.4 R2.3
$END`;
    const currentPage = new Set(['U1.1', 'U1.2', 'R1.1', 'U1.3', 'U1.4']);
    assert.deepEqual(signalsOnOtherPages(netlist, currentPage), ['RESET', 'GND']);
    assert.deepEqual(signalsOnOtherPages(netlist, new Set()), ['RESET', 'LOCAL', 'GND']);
});
