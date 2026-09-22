import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitModStruct } from '../../shared/types/circuit';

test('circuit modifications default omitted change lists to empty values', () => {
    assert.deepEqual(CircuitModStruct().parse({}), {
        add_components: [],
        add_reused_blocks: [],
        rm_components: null,
        external_rm_connect: null,
        external_connect: null,
    });

    assert.deepEqual(CircuitModStruct().parse({ rm_components: ['R1'] }), {
        add_components: [],
        add_reused_blocks: [],
        rm_components: ['R1'],
        external_rm_connect: null,
        external_connect: null,
    });
});
