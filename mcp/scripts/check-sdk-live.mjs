// Opt-in integration check against an open TEST PCB. Creates and removes one DOCUMENT-layer line.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, EPCB_LayerId } from '../dist/lib/node/index.mjs';

const documentUuid = process.argv[2];
if (!documentUuid) throw Error('Usage: node scripts/check-sdk-live.mjs <test-pcb-document-uuid> [instance-id]');
const start = Date.now();
const session = await connect({ documentUuid, instanceId: process.argv[3] });
const report = { documentUuid, instanceId: session.instanceId, checkpoints: {} };
let line;
try {
    report.checkpoints.baseline = session.lastCheckpoint;
    const components = await session.eda.pcb_PrimitiveComponent.getAll();
    const designators = await Promise.all(components.map(c => c.getState_Designator()));
    report.components = components.length;
    report.designators = designators.slice(0, 8);
    const before = await session.eda.pcb_PrimitiveLine.getAllPrimitiveId();
    line = await session.eda.pcb_PrimitiveLine.create('', EPCB_LayerId.DOCUMENT, 0, 0, 10, 0, 1, false);
    report.checkpoints.create = session.lastCheckpoint;
    assert(line, 'Native create returned undefined');
    report.createdId = await line.getState_PrimitiveId();
    const modified = await session.eda.pcb_PrimitiveLine.modify(line, { endX: 20 });
    report.checkpoints.modify = session.lastCheckpoint;
    assert(modified);
    const reread = await session.eda.pcb_PrimitiveLine.get(report.createdId);
    assert.equal(await reread.getState_EndX(), 20);
    assert.equal(await session.eda.pcb_PrimitiveLine.delete(line), true);
    line = undefined;
    report.checkpoints.delete = session.lastCheckpoint;
    const after = await session.eda.pcb_PrimitiveLine.getAllPrimitiveId();
    assert.deepEqual([...after].sort(), [...before].sort());
    report.originalLineIdsPreserved = true;
    const preview = await session.eda.dmt_EditorControl.getCurrentRenderedAreaImage();
    assert(preview instanceof Blob, 'Preview must be a local native Blob');
    assert(preview.size > 0);
    const folder = fileURLToPath(new URL('../.test-data/sdk-live/', import.meta.url));
    await mkdir(folder, { recursive: true });
    report.preview = { type: preview.type, bytes: preview.size, path: resolve(folder, 'preview.png') };
    await writeFile(report.preview.path, Buffer.from(await preview.arrayBuffer()));
    report.durationMs = Date.now() - start;
    await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally {
    try { if (line) await session.eda.pcb_PrimitiveLine.delete(line); }
    finally { await session.close(); }
}
