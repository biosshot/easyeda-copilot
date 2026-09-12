import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type AnnotatableComponentUnit,
    planDesignatorAnnotation,
    splitDesignatorNumber,
} from '../src/eda/designator-annotation-plan.ts';

function unit(
    primitiveId: string,
    designator: string,
    overrides: Partial<AnnotatableComponentUnit> = {},
): AnnotatableComponentUnit {
    return {
        pageUuid: 'page-1',
        pageName: 'Page 1',
        pageIndex: 0,
        primitiveId,
        designator,
        subPartName: '',
        uniqueId: primitiveId,
        componentKey: 'lib:device',
        x: Number(primitiveId.replace(/\D/g, '')) || 0,
        y: 0,
        ...overrides,
    };
}

test('treats every text before trailing digits as an opaque prefix', () => {
    assert.deepEqual(splitDesignatorNumber('USB3V3-OUT_12'), {
        prefix: 'USB3V3-OUT_',
        number: '12',
    });
    assert.deepEqual(splitDesignatorNumber('arbitrary text'), {
        prefix: 'arbitrary text',
        number: undefined,
    });
});

test('preserve mode changes only duplicates and unnumbered designators', () => {
    const plan = planDesignatorAnnotation([
        unit('p1', 'R8'),
        unit('p2', 'R1'),
        unit('p3', 'R1'),
        unit('p4', 'custom'),
    ], 'preserve');

    assert.deepEqual(plan.assignments.map(item => item.designator), ['R8', 'R1', 'R2', 'custom1']);
    assert.deepEqual(plan.changed.map(item => [item.component.designator, item.designator]), [
        ['R1', 'R2'],
        ['custom', 'custom1'],
    ]);
});

test('resequence mode numbers each opaque prefix in page and position order', () => {
    const plan = planDesignatorAnnotation([
        unit('p1', 'R8', { x: 20, y: 0 }),
        unit('p2', 'R2', { x: 10, y: 100 }),
        unit('p3', 'C9', { x: 15, y: 50 }),
    ], 'resequence');

    assert.deepEqual(plan.assignments.map(item => [item.component.designator, item.designator]), [
        ['R2', 'R1'],
        ['C9', 'C1'],
        ['R8', 'R2'],
    ]);
});

test('renames all sub-parts sharing one physical Unique ID together', () => {
    const plan = planDesignatorAnnotation([
        unit('u1a', 'U1.1', { uniqueId: 'physical-u1', subPartName: 'device.1', x: 10 }),
        unit('u1b', 'U1.2', { uniqueId: 'physical-u1', subPartName: 'device.2', x: 20 }),
        unit('u2a', 'U1.1', { uniqueId: 'physical-u2', subPartName: 'device.1', x: 30 }),
        unit('u2b', 'U1.2', { uniqueId: 'physical-u2', subPartName: 'device.2', x: 40 }),
    ], 'preserve');

    assert.equal(plan.assignments.length, 2);
    assert.equal(plan.assignments[0].designator, 'U1');
    assert.equal(plan.assignments[1].designator, 'U2');
    assert.deepEqual(plan.assignments[1].component.units.map(item => item.subPartName), ['device.1', 'device.2']);
});

test('groups sub-parts even when EasyEDA gives every section a different Unique ID', () => {
    const plan = planDesignatorAnnotation([
        unit('u1a', 'U1', { uniqueId: 'section-a', subPartName: 'device.1', x: 10 }),
        unit('u1b', 'U1', { uniqueId: 'section-b', subPartName: 'device.2', x: 20 }),
        unit('u2a', 'U1', { uniqueId: 'section-c', subPartName: 'device.1', x: 30 }),
        unit('u2b', 'U1', { uniqueId: 'section-d', subPartName: 'device.2', x: 40 }),
    ], 'preserve');

    assert.equal(plan.assignments.length, 2);
    assert.equal(plan.assignments[0].designator, 'U1');
    assert.equal(plan.assignments[1].designator, 'U2');
    assert.deepEqual(plan.assignments.map(item => item.component.units.length), [2, 2]);
});

test('repairs every section when one physical component has inconsistent base designators', () => {
    const plan = planDesignatorAnnotation([
        unit('u1a', 'U1.1', { uniqueId: 'physical-u1', subPartName: 'device.1', x: 10 }),
        unit('u1b', 'U9.2', { uniqueId: 'physical-u1', subPartName: 'device.2', x: 20 }),
    ], 'preserve');

    assert.equal(plan.assignments.length, 1);
    assert.equal(plan.assignments[0].designator, 'U1');
    assert.equal(plan.changed.length, 1);
});
