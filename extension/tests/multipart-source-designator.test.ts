import test from 'node:test';
import assert from 'node:assert/strict';
import type { SourceRecord } from '../src/eda/source-document';
import { normalizeMultipartSourceDesignators } from '../src/eda/multipart-source-designator';

const attribute = (id: string, parentId: string, key: string, value: string): SourceRecord => ({
    outer: { type: 'ATTR', id },
    inner: { parentId, key, value },
});

test('multi-part sections share their base designator without changing Unique IDs', () => {
    const records = [
        attribute('d1', 'section-a', 'Designator', 'U1'),
        attribute('u1', 'section-a', 'Unique ID', 'physical-a'),
        attribute('d2', 'section-b', 'Designator', 'U2'),
        attribute('u2', 'section-b', 'Unique ID', 'physical-b'),
    ];

    const result = normalizeMultipartSourceDesignators(records, [
        { designator: 'U1.1', primitiveId: 'section-a', partUuid: 'lm358', subPartName: 'LM358.1' },
        { designator: 'U1.2', primitiveId: 'section-b', partUuid: 'lm358', subPartName: 'LM358.2' },
    ]);

    assert.deepEqual(result, { changedAttributes: 1, normalizedComponents: 1 });
    assert.equal(records[0].inner?.value, 'U1');
    assert.equal(records[1].inner?.value, 'physical-a');
    assert.equal(records[2].inner?.value, 'U1');
    assert.equal(records[3].inner?.value, 'physical-b');
});

test('separate physical components remain separate', () => {
    const records = [
        attribute('d1', 'u1a', 'Designator', 'U1'),
        attribute('d2', 'u1b', 'Designator', 'U8'),
        attribute('d3', 'u2a', 'Designator', 'U2'),
        attribute('d4', 'u2b', 'Designator', 'U9'),
    ];

    const result = normalizeMultipartSourceDesignators(records, [
        { designator: 'U1.1', primitiveId: 'u1a', partUuid: 'lm358', subPartName: 'LM358.1' },
        { designator: 'U1.2', primitiveId: 'u1b', partUuid: 'lm358', subPartName: 'LM358.2' },
        { designator: 'U2.1', primitiveId: 'u2a', partUuid: 'lm358', subPartName: 'LM358.1' },
        { designator: 'U2.2', primitiveId: 'u2b', partUuid: 'lm358', subPartName: 'LM358.2' },
    ]);

    assert.deepEqual(result, { changedAttributes: 2, normalizedComponents: 2 });
    assert.deepEqual(records.map(record => record.inner?.value), ['U1', 'U1', 'U2', 'U2']);
});

test('ordinary components and a lone requested section are untouched', () => {
    const records = [
        attribute('dr', 'resistor', 'Designator', 'R1'),
        attribute('du', 'section-a', 'Designator', 'U3'),
    ];
    const before = structuredClone(records);

    const result = normalizeMultipartSourceDesignators(records, [
        { designator: 'R1', primitiveId: 'resistor', partUuid: 'resistor' },
        { designator: 'U3.1', primitiveId: 'section-a', partUuid: 'lm358', subPartName: 'LM358.1' },
    ]);

    assert.deepEqual(result, { changedAttributes: 0, normalizedComponents: 0 });
    assert.deepEqual(records, before);
});

test('rejects mixed devices under one multi-part designator', () => {
    const records = [
        attribute('d1', 'a', 'Designator', 'U1'),
        attribute('d2', 'b', 'Designator', 'U1'),
    ];

    assert.throws(() => normalizeMultipartSourceDesignators(records, [
        { designator: 'U1.1', primitiveId: 'a', partUuid: 'lm358', subPartName: 'LM358.1' },
        { designator: 'U1.2', primitiveId: 'b', partUuid: 'tl072', subPartName: 'TL072.2' },
    ]), /different part UUIDs/);
});
