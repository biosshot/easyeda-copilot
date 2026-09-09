import assert from 'assert';
import test from 'node:test';
import { shortSymbolsMap, stableShortSymbolId } from '../src/circuit-layout/short-symbol.ts';

// ===== Tests for short-symbol.ts =====
test.describe('short-symbol', () => {

    test('shortSymbolsMap - GND detection', () => {
        assert.strictEqual(shortSymbolsMap.GND.is('GND'), true);
        assert.strictEqual(shortSymbolsMap.GND.is('gnd'), true);
        assert.strictEqual(shortSymbolsMap.GND.is('VCC'), false);
        assert.strictEqual(shortSymbolsMap.GND.is('PGND'), true);
        assert.strictEqual(shortSymbolsMap.GND.is('AGND'), true);
    });

    test('shortSymbolsMap - VCC detection', () => {
        // V-prefix power rails
        assert.strictEqual(shortSymbolsMap.VCC.is('VCC'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VDD'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VBAT'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VIN'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VOUT'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VREF'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VREG'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V+'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V-'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V'), true);

        // Special V-prefix rails
        assert.strictEqual(shortSymbolsMap.VCC.is('AVDD'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('DVDD'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VBUS'), true);

        // Numbered V rails
        assert.strictEqual(shortSymbolsMap.VCC.is('V1'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V12'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V99'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('V0'), true);

        // Numeric voltage values (integer)
        assert.strictEqual(shortSymbolsMap.VCC.is('+5V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('-12V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('12V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('5V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('0V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('+0V'), true);

        // Numeric voltage values (decimal)
        assert.strictEqual(shortSymbolsMap.VCC.is('3.3V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('+3.3V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('-3.3V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('1.8V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('0.9V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('2.5V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('+1.2V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('-0.5V'), true);

        // Case insensitivity
        assert.strictEqual(shortSymbolsMap.VCC.is('vcc'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vdd'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vbat'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vin'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vout'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vref'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('avdd'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('dvdd'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('vbus'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('5v'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('+5v'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('3.3v'), true);

        // Negative cases — should NOT match VCC
        assert.strictEqual(shortSymbolsMap.VCC.is('GND'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('AGND'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('DGND'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('PGND'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('VCCA'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VDDD'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('3V3'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('3v3'), true)
        assert.strictEqual(shortSymbolsMap.VCC.is('V3V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is(''), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('DATA'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('CLK'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('RST'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('SDA'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('SCL'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('TX'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('RX'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('GPIO'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('PWM'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('VCC_GND'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('5VA'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VPP'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VSS'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VEE'), true);


        assert.strictEqual(shortSymbolsMap.VCC.is('VOUT_5V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VOUT_5V5'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VOUT_3.3V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VIN_BAT'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('VIN12'), true);

        assert.strictEqual(shortSymbolsMap.VCC.is('GVDD'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('3V3'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('5V2'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('BATTERY'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_5V'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_5V5'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_3.3'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_V3.3'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_V5'), true);
        assert.strictEqual(shortSymbolsMap.VCC.is('3.3V'), true);

        assert.strictEqual(shortSymbolsMap.VCC.is('USB_DM'), false);
        assert.strictEqual(shortSymbolsMap.VCC.is('USB_DP'), false);
    });

    test('shortSymbolsMap - NETPORT detection', () => {
        assert.strictEqual(shortSymbolsMap.NETPORT.is('anything'), false); // Always false as per implementation
    });

    test('shortSymbolsMap - create GND symbol', () => {
        const symbol = shortSymbolsMap.GND.create('GND', 'block1');
        assert.strictEqual(symbol.component.value, 'GND');
        assert.strictEqual(symbol.component.part_uuid, 'GND');
        assert.strictEqual(shortSymbolsMap.GND.partUuid, 'GND');
        assert.strictEqual(symbol.node.width, 15.5);
        assert.strictEqual(symbol.node.height, 40);
        assert.strictEqual(symbol.node.ports?.[0]?.x, 7.75);
        assert.strictEqual(symbol.node.ports?.[0]?.y, 0);
    });

    test('shortSymbolsMap - create VCC symbol', () => {
        const symbol = shortSymbolsMap.VCC.create('VCC', 'block1');
        assert.strictEqual(symbol.component.value, 'VCC');
        assert.strictEqual(symbol.node.width, 15.5);
        assert.strictEqual(symbol.node.height, 40);
        assert.strictEqual(symbol.node.ports?.[0]?.x, 7.75);
        assert.strictEqual(symbol.node.ports?.[0]?.y, 40);
    });

    test('shortSymbolsMap - create NETPORT symbol', () => {
        const symbol = shortSymbolsMap.NETPORT.create('NET', 'block1');
        assert.strictEqual(symbol.component.value, 'NET');
    });

    test('short symbol width is limited by minimum and maximum values', () => {
        assert.strictEqual(shortSymbolsMap.NETPORT.create('', 'block1').node.width, 8);
        assert.strictEqual(shortSymbolsMap.NETPORT.create('A', 'block1').node.width, 8.5);
        assert.strictEqual(shortSymbolsMap.NETPORT.create('D12_MISO', 'block1').node.width, 33);
        assert.strictEqual(shortSymbolsMap.NETPORT.create('VERY_LONG_SIGNAL_NAME', 'block1').node.width, 40);
    });

    test('short symbols use compact individual spacing', () => {
        const symbol = shortSymbolsMap.NETPORT.create('NET', 'block1');
        assert.strictEqual(symbol.node.layoutOptions?.['org.eclipse.elk.spacing.individual'], 'spacing.nodeNode: 5');
    });

    test('stable short-symbol ids are repeatable and context-specific', () => {
        const id = stableShortSymbolId('VCC', '3V3', 'block_MCU', 0);
        assert.match(id, /^3V3\|[0-9a-f]{4}$/);
        assert.strictEqual(id, stableShortSymbolId('VCC', '3V3', 'block_MCU', 0));
        assert.notStrictEqual(
            id,
            stableShortSymbolId('VCC', '3V3', 'block_MCU', 1),
        );
    });
})
