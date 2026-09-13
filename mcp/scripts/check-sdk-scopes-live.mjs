// Opt-in: creates and deletes a DOCUMENT-layer marker on a user-authorized test PCB.
import assert from 'node:assert/strict';
import { connect, EPCB_LayerId } from '../dist/lib/node/index.mjs';
const [documentUuid,instanceId]=process.argv.slice(2);
if(!documentUuid)throw Error('Usage: node check-sdk-scopes-live.mjs <test-pcb-uuid> [instance-id]');
const s=await connect({documentUuid,instanceId});
let marker; const started=Date.now();
try {
    const ids=await s.eda.pcb_PrimitiveLine.getAllPrimitiveId();
    const before=await s.eval('return (await eda.checkpointer.list()).map(c=>c._id)');
    let checkpoint;
    await s.checkpointScope(`Node scope verification ${started}`,async scope=>{
        checkpoint=scope.checkpointId;
        marker=await scope.eda.pcb_PrimitiveLine.create('',EPCB_LayerId.DOCUMENT,0,0,10,0,1,false);
        assert(marker);assert.equal(s.lastCheckpoint,checkpoint);
        try {
            assert.equal(await marker.getState_EndX(),10);
            await s.eda.pcb_PrimitiveLine.modify(marker,{endX:20});
            assert.equal(s.lastCheckpoint,checkpoint);
            const blob=await s.eda.dmt_EditorControl.getCurrentRenderedAreaImage();
            assert(blob instanceof Blob && blob.size>0);
            assert.equal(s.lastCheckpoint,checkpoint);
            const after=await s.eval('return (await eda.checkpointer.list()).map(c=>c._id)');
            assert.deepEqual(after.filter(id=>!before.includes(id)),[checkpoint]);
        } finally {await s.eda.pcb_PrimitiveLine.delete(marker);marker=undefined;}
    });
    assert.deepEqual((await s.eda.pcb_PrimitiveLine.getAllPrimitiveId()).sort(),ids.sort());
    assert.notEqual(s.lastCheckpoint,checkpoint);
    assert.deepEqual(await s.eda.pcb_Drc.check(true,false,true),[]);
    console.log(JSON.stringify({language:'Node',checkpoint,oneCheckpointInsideScope:true,originalLinesPreserved:true,drc:[],durationMs:Date.now()-started}));
} finally {
    if(marker)await s.eda.pcb_PrimitiveLine.delete(marker);
    await s.close();
}
