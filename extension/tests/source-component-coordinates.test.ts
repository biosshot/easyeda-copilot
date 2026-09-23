import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as sourceDocument from '../src/eda/source-document';

const file = resolve(__dirname, '../src/eda/assemble-source.ts');
const code = ts.transpileModule(readFileSync(file, 'utf8') + '\nexport const cloneForTest = cloneComponentsIntoSource;', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: file,
}).outputText;

function clone(seedY: number, targetY: number, factor = -1) {
    const exports: Record<string, any> = {};
    runInNewContext(code, { exports, structuredClone, require(name: string) {
        if (name === './source-document') return sourceDocument;
        if (name === './utils') return { to2: (v: number) => Math.round(v * 100) / 100, rmPartFromDesignator: (v: string) => v };
        if (name === './assembly-symbols') return { getNetFlagKind: () => undefined };
        return {};
    } });
    const component = { outer: { type: 'COMPONENT', id: 'seed' }, inner: { x: 100, y: seedY * factor, rotation: 90, isMirror: false } };
    const attribute = { outer: { type: 'ATTR', id: 'label' }, inner: { parentId: 'seed', key: 'Designator', value: 'J5', x: 90, y: seedY * factor - 20, rotation: 0 } };
    const records = [component, attribute];
    const plan = { input: { designator: 'J5', value: 'B3B-XH-A(LF)(SN)', pos: { rotate: 90 } }, apiX: 885, apiY: targetY };
    const result = exports.cloneForTest(sourceDocument.serializeDocumentSource(records), records,
        new Map([['j5', [plan]]]), new Map([['j5', { originApiX: 100, originApiY: seedY,
            firstPlanSeeded: false, component, attributes: [attribute] }]]));
    return sourceDocument.parseDocumentSource(result.source).slice(2);
}

test('cached J5 template on Y=0 does not reflect across the sheet edge', () => {
    const [component, label] = clone(0, 1295);
    assert.equal(component.inner?.x, 885);
    assert.equal(component.inner?.y, -1295);
    assert.equal(component.inner?.rotation, 90);
    assert.equal(label.inner?.x, 875);
    assert.equal(label.inner?.y, -1315);
    assert.equal(label.inner?.parentId, component.outer.id);
});

test('zero-origin template also places correctly below the API origin', () => {
    assert.equal(clone(0, -1295)[0].inner?.y, 1295);
});

test('nonzero templates retain their coordinate convention', () => {
    for (const factor of [-1, 1]) for (const seedY of [-400, 400]) for (const targetY of [-1295, 0, 1295]) {
        assert.equal(clone(seedY, targetY, factor)[0].inner?.y || 0, targetY * factor || 0);
    }
});
