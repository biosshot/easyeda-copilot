import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUnresolvedNetPortMessage } from '../src/eda/unresolved-net-port-message';

test('unresolved port error includes count, pin, net and reason', () => {
    const message = formatUnresolvedNetPortMessage(25, [{
        net: { designator: 'U3.10', pin_number: 'N11', net: 'FPGA_1V1' },
        reason: 'pin not found',
    }]);
    assert.match(message, /25 unresolved net ports/);
    assert.match(message, /U3\.10\/N11 -> FPGA_1V1 \(pin not found\)/);
    assert.match(message, /24 more/);
    assert.match(message, /source-assemble log/);
});

test('unresolved port error stays bounded with long names and many failures', () => {
    const long = 'X'.repeat(200);
    const samples = Array.from({ length: 20 }, () => ({
        net: { designator: long, pin_number: long, net: long },
        reason: 'no free route' as const,
    }));
    const message = formatUnresolvedNetPortMessage(1000, samples);
    assert(message.length <= 400);
    assert.match(message, /1000 unresolved net ports/);
    assert.match(message, /997 more/);
    assert(!message.includes('\n'));
});
