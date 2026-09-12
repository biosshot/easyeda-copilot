import test from 'node:test';
import assert from 'node:assert/strict';
import type { CircuitAssembly } from '@copilot/shared/types/circuit';
import { getNetFlagKind, getSpecialSignalName, getComponentTemplateKey } from '../src/eda/assembly-symbols';
import { GND_PORT_COMPONENT, VCC_PORT_COMPONENT } from '../src/eda/types';

const component = (signal?: string, part_uuid = 'GND') => ({
    part_uuid, designator: 'GND1', pins: signal === undefined ? [] : [{ signal_name: signal }],
}) as CircuitAssembly['components'][number];

test('ground variants select the native symbol and preserve the actual net name', () => {
    for (const uuid of ['GND', GND_PORT_COMPONENT.uuid]) {
        for (const [signal, kind] of [['GND', 'Ground'], ['/agnd', 'AnalogGround'], ['PGND_1', 'ProtectGround']]) {
            assert.equal(getNetFlagKind(component(signal, uuid)), kind);
            assert.equal(getSpecialSignalName(component(signal, uuid)), signal);
        }
    }
    assert.equal(getNetFlagKind(component('VCC', VCC_PORT_COMPONENT.uuid)), 'Power');
    assert.equal(getNetFlagKind(component('AGND', 'ordinary-device')), undefined);
});

test('missing or unnamed pins retain default ground and power names', () => {
    assert.equal(getNetFlagKind(component()), 'Ground');
    assert.equal(getSpecialSignalName(component()), 'GND');
    assert.equal(getSpecialSignalName(component('', 'VCC')), 'VCC');
    const unnamed = component();
    unnamed.pins = [{}] as typeof unnamed.pins;
    assert.equal(getNetFlagKind(unnamed), 'Ground');
});

test('template caching separates ground shapes while reusing the same shape for different nets', () => {
    const keys = ['GND', 'AGND', 'PGND'].map(net => getComponentTemplateKey(component(net)));
    assert.equal(new Set(keys).size, 3);
    assert.equal(getComponentTemplateKey(component('AGND_1')), getComponentTemplateKey(component('AGND_2')));
});
