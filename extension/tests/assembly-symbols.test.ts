import test from 'node:test';
import assert from 'node:assert/strict';
import type { CircuitAssembly } from '@copilot/shared/types/circuit';
import { getNetFlagKind, getSpecialSignalName, getComponentTemplateKey, getNetPortStyle } from '../src/eda/assembly-symbols';
import { GND_PORT_COMPONENT, LEGACY_NET_PORT_UUID, NET_PORT_COMPONENT, STYLED_NET_PORT_COMPONENTS, VCC_PORT_COMPONENT } from '../src/eda/types';

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

test('styled net ports keep separate templates while power and ground ignore the hint', () => {
    const previousEda = (globalThis as { eda?: unknown }).eda;
    (globalThis as { eda?: unknown }).eda = { sys_Environment: { isOnlineMode: () => true } };
    try {
        assert.equal(NET_PORT_COMPONENT.uuid, STYLED_NET_PORT_COMPONENTS.bi.uuid);
        const port = component('DATA', NET_PORT_COMPONENT.uuid);
        port.designator = 'DATA|1';
        const oldKey = getComponentTemplateKey(port);
        port.pins[0].port_style = 'in';
        assert.equal(getNetPortStyle(port), 'in');
        assert.equal(getNetPortStyle(component('DATA', LEGACY_NET_PORT_UUID)), undefined);
        const legacy = component('DATA', LEGACY_NET_PORT_UUID);
        legacy.pins[0].port_style = 'out';
        assert.equal(getNetPortStyle(legacy), 'out');
        const inKey = getComponentTemplateKey(port);
        port.pins[0].port_style = 'out';
        assert.notEqual(getComponentTemplateKey(port), inKey);
        assert.notEqual(inKey, oldKey);
        const ground = component('GND');
        ground.pins[0].port_style = 'out';
        assert.equal(getNetPortStyle(ground), undefined);
        assert.equal(getNetFlagKind(ground), 'Ground');
    } finally {
        (globalThis as { eda?: unknown }).eda = previousEda;
    }
});
