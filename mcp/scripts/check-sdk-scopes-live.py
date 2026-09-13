"""Opt-in: creates and removes a DOCUMENT-layer marker on a user-authorized PCB."""
import asyncio
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'dist/lib/python'))
from easyeda_copilot import connect,Blob
from easyeda_copilot.constants import EPCB_LayerId

async def main():
    if len(sys.argv)<2:raise SystemExit('Usage: python check-sdk-scopes-live.py <test-pcb-uuid> [instance-id]')
    async with await connect(document_uuid=sys.argv[1],instance_id=sys.argv[2] if len(sys.argv)>2 else None) as s:
        started=time.monotonic()
        ids=await s.eda.pcb_PrimitiveLine.getAllPrimitiveId()
        before=await s.eval('return (await eda.checkpointer.list()).map(c=>c._id)')
        async with s.checkpoint_scope(f'Python scope verification {time.time()}') as scope:
            cp=scope.checkpoint_id
            marker=await scope.eda.pcb_PrimitiveLine.create('',EPCB_LayerId.DOCUMENT,0,0,10,0,1,False)
            assert marker
            try:
                assert s.last_checkpoint==cp
                await s.eda.pcb_PrimitiveLine.modify(marker,{'endX':20})
                assert s.last_checkpoint==cp
                blob=await s.eda.dmt_EditorControl.getCurrentRenderedAreaImage()
                assert isinstance(blob,Blob) and blob.size>0 and s.last_checkpoint==cp
                after=await s.eval('return (await eda.checkpointer.list()).map(c=>c._id)')
                assert set(after)-set(before)=={cp}
            finally:assert await s.eda.pcb_PrimitiveLine.delete(marker)
        assert sorted(await s.eda.pcb_PrimitiveLine.getAllPrimitiveId())==sorted(ids)
        assert s.last_checkpoint!=cp
        assert await s.eda.pcb_Drc.check(True,False,True)==[]
        print(json.dumps({'language':'Python','checkpoint':cp,'oneCheckpointInsideScope':True,'originalLinesPreserved':True,'drc':[],'durationMs':round((time.monotonic()-started)*1000)}))

asyncio.run(main())
