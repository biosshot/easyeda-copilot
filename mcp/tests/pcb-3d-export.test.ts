import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, unlink } from 'node:fs/promises';
import { pcb3dExportCode, registerPcb3dExportTools } from '../src/tools/pcb/pcb-3d-export.ts';
import { executeJs } from '../src/tools/execute-js.ts';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test('registration declares non-destructive native export', () => {
    const tools: any[] = [];
    registerPcb3dExportTools({ registerTool: (...args: any[]) => tools.push(args) } as any, {} as any);
    assert.equal(tools[0][0], 'export_populated_pcb_3d');
    assert.equal(tools[0][1].annotations.destructiveHint, false);
});
test('document mismatch stops before export', async () => {
    let called = false;
    const eda = { dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: 'other' }) },
        pcb_ManufactureData: { get3DFile: async () => { called = true; } } };
    await assert.rejects(new AsyncFunction('eda', pcb3dExportCode({ document_uuid: 'expected' }))(eda), /differs/);
    assert.equal(called, false);
});
test('native arguments, safely quoted names, binary extension and byte preservation', async () => {
    for (const format of ['step','obj'] as const) {
        const data = format === 'step' ? 'ISO-10303-21;\nEND-ISO-10303-21;' : 'PK fixture';
        let args: any[] = [];
        const name = 'name"; throw Error("injection")';
        const eda = { dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: 'pcb' }) },
            pcb_ManufactureData: { get3DFile: async (...values: any[]) => { args = values; return new Blob([data]); } } };
        const blob = await new AsyncFunction('eda', pcb3dExportCode({ document_uuid:'pcb', format, name,
            include_details:false, auto_generate_models:false }))(eda);
        assert.deepEqual(args, [name,format,['Component Model'],'Outfit',false]);
        const result = await executeJs({ requestEasyEda: async () => ({ checkpoint:'test', result:{kind:'binary',
            mime_type:blob.type, base64:Buffer.from(await blob.arrayBuffer()).toString('base64')} }) } as any, {code:'fixture'});
        const artifact = JSON.parse((result.content[0] as any).text).artifacts[0];
        try {
            assert.ok(artifact.path.endsWith(format === 'step' ? '.step' : '.zip'));
            assert.equal(await readFile(artifact.path,'utf8'),data);
        } finally { await unlink(artifact.path); }
    }
});
test('empty native output is reported, not silently accepted', async () => {
    const eda = { dmt_SelectControl: { getCurrentDocumentInfo: async () => ({ uuid: 'pcb' }) },
        pcb_ManufactureData: { get3DFile: async () => new Blob([]) } };
    await assert.rejects(new AsyncFunction('eda',pcb3dExportCode({document_uuid:'pcb'}))(eda), /empty/);
});
