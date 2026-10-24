import assert from 'node:assert/strict';
import test from 'node:test';
import { registerOfflinePcbTools, runOfflinePcb } from '../src/tools/pcb/pcb-offline.ts';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('all three tools register without any editor bridge', () => {
    const tools: any[] = [];
    registerOfflinePcbTools({ registerTool: (...args: any[]) => tools.push(args) } as any);
    assert.deepEqual(tools.map(t => t[0]), ['plan_ground_plane_escapes','preview_fabrication_gerbers','export_pcb_mechanical_interface']);
    for (const [, metadata] of tools) {
        assert.equal(metadata.annotations.readOnlyHint, true);
        assert.equal(metadata.annotations.destructiveHint, false);
    }
});

test('Python worker emits mechanical artifact and preserves input bytes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pcb-offline-test-'));
    let artifact: string | undefined;
    try {
        const file = join(dir, 'input with spaces.json');
        const payload = JSON.stringify({ schema:'pcb-offline/v1', units:'mm', frame:'x-right-y-up',
            board:{ outline:[[0,0],[10,0],[10,10],[0,10]], holes:[], thickness_mm:1.6 }, pads:[], tracks:[], vias:[] });
        await writeFile(file, payload);
        const result = await runOfflinePcb('mechanical', file, {}, new AbortController().signal);
        artifact = result.report_path;
        assert.equal(result.cad_modified, false);
        assert.equal(result.input_sha256.length, 64);
        assert.equal((JSON.parse(await readFile(result.report_path, 'utf8'))).schema, 'pcb-mechanical/v1');
        assert.equal(await readFile(file, 'utf8'), payload);
    } finally {
        await rm(dir, { recursive:true, force:true });
        if (artifact) await rm(artifact, { force:true });
    }
});

test('pre-cancelled request never launches a worker', async () => {
    const c = new AbortController(); c.abort();
    await assert.rejects(runOfflinePcb('mechanical', 'does-not-exist.json', {}, c.signal), { name:'AbortError' });
});
