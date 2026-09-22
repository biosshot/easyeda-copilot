import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceRefsFromProjectSource, readProjectDeviceRefs } from '../src/eda/project-device-refs';
import JSZip from 'jszip';

const device = '32d67bb993d443e996e7aab9f54dbcf6';
const library = '7747dd3052f744008bdef710dec476cd';
const head = (docType: string, uuid: string) => `${JSON.stringify({ type: 'DOCHEAD' })}||${JSON.stringify({ docType, uuid })}|`;
const meta = (source: string) => `${JSON.stringify({ type: 'META', ticket: 1 })}||${JSON.stringify({ source })}|`;

test('corrupt device sections do not discard other devices or leak section identity', () => {
    const refs = deviceRefsFromProjectSource([
        head('DEVICE', 'broken'), '{"type":"META"}||{invalid}|',
        meta(`${device}|${library}`),
        head('DEVICE', 'valid'), meta(`${device}|${library}`),
    ].join('\n'));
    assert.deepEqual([...refs.keys()], ['valid']);
});

test('optional project recovery handles old APIs, export errors, old formats and timeouts', async () => {
    const previous = globalThis.eda;
    const context = { getCurrentDocumentInfo: async () => ({ uuid: 'page', parentProjectUuid: 'project' }) };
    try {
        for (const api of [ {}, { sys_FileManager: {}, dmt_SelectControl: context },
            { sys_FileManager: { getProjectFile: () => { throw new Error('old editor'); } }, dmt_SelectControl: context },
            { sys_FileManager: { getProjectFile: async () => undefined }, dmt_SelectControl: context },
            { sys_FileManager: { getProjectFile: async () => new Blob(['not a zip']) }, dmt_SelectControl: context }]) {
            Object.assign(globalThis, { eda: api });
            assert.equal((await readProjectDeviceRefs()).size, 0);
        }
        const zip = new JSZip();
        zip.file('legacy.json', '{}');
        Object.assign(globalThis, { eda: { dmt_SelectControl: context, sys_FileManager: {
            getProjectFile: async () => new Blob([await zip.generateAsync({ type: 'uint8array' })]),
        } } });
        assert.equal((await readProjectDeviceRefs()).size, 0);

        let release!: (value: undefined) => void;
        let exports = 0;
        Object.assign(globalThis, { eda: { dmt_SelectControl: context, sys_FileManager: {
            getProjectFile: () => { exports++; return new Promise(resolve => { release = resolve; }); },
        } } });
        assert.equal((await readProjectDeviceRefs(10)).size, 0);
        assert.equal((await readProjectDeviceRefs(10)).size, 0);
        assert.equal(exports, 1, 'timed-out export must not spawn duplicate work');
        release(undefined);
        await new Promise(resolve => setTimeout(resolve, 0));

        zip.file('native.epru', [head('DEVICE', 'local'), meta(`${device}|${library}`)].join('\n'));
        Object.assign(globalThis, { eda: { dmt_SelectControl: context, sys_FileManager: {
            getProjectFile: async () => new Blob([await zip.generateAsync({ type: 'uint8array' })]),
        } } });
        assert.deepEqual((await readProjectDeviceRefs()).get('local'), { uuid: device, libraryUuid: library });
    } finally { Object.assign(globalThis, { eda: previous }); }
});

test('reads DEVICE identity without confusing symbol and footprint source UUIDs', () => {
    const refs = deviceRefsFromProjectSource([
        head('SYMBOL', 'symbol-local'), meta(`${device}|${library}`),
        head('DEVICE', 'device-local'), meta(`${device}|${library}`),
        head('FOOTPRINT', 'footprint-local'), meta(`${device}|${library}`),
    ].join('\r\n'));
    assert.deepEqual([...refs], [['device-local', { uuid: device, libraryUuid: library }]]);
});

test('normalizes system library to legacy format and ignores locally authored devices without source', () => {
    const refs = deviceRefsFromProjectSource([
        head('DEVICE', 'lcsc-local'), meta(`${device}|0819f05c4eef4c71ace90d822a990e87`),
        head('DEVICE', 'own-local'), meta(''),
    ].join('\n'));
    assert.deepEqual([...refs], [['lcsc-local', device]]);
});
