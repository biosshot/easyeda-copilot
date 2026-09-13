"""Opt-in SDK integration test on a user-authorized test PCB; removes its DOCUMENT-layer marker."""
import asyncio
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'dist' / 'lib' / 'python'))
from easyeda_copilot import connect, Blob, TypedArray
from easyeda_copilot.constants import EPCB_LayerId


async def main():
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python scripts/check-sdk-live.py <test-pcb-document-uuid> [instance-id]')
    report = {'documentUuid': sys.argv[1], 'checkpoints': {}}
    async with await connect(document_uuid=sys.argv[1], instance_id=sys.argv[2] if len(sys.argv) > 2 else None) as session:
        eda = session.eda
        report['checkpoints']['baseline'] = session.last_checkpoint
        components = await eda.pcb_PrimitiveComponent.getAll()
        coordinates = await asyncio.gather(*(getter() for c in components for getter in [c.getState_X, c.getState_Y]))
        raw = struct.pack('<' + 'd' * len(coordinates), *coordinates)
        echoed = await session.eval('return inputs.positions', {'positions': TypedArray(raw, 'Float64Array')})
        assert echoed.type == 'Float64Array' and echoed.data == raw
        before = await eda.pcb_PrimitiveLine.getAllPrimitiveId()
        marker = None
        try:
            marker = await eda.pcb_PrimitiveLine.create('', EPCB_LayerId.DOCUMENT, 0, 0, 10, 0, 1, False)
            assert marker
            report['checkpoints']['create'] = session.last_checkpoint
            marker_id = await marker.getState_PrimitiveId()
            modified = await eda.pcb_PrimitiveLine.modify(marker, {'endX': 30})
            assert modified
            report['checkpoints']['modify'] = session.last_checkpoint
            assert await (await eda.pcb_PrimitiveLine.get(marker_id)).getState_EndX() == 30
        finally:
            if marker:
                assert await eda.pcb_PrimitiveLine.delete(marker)
                report['checkpoints']['delete'] = session.last_checkpoint
        assert sorted(await eda.pcb_PrimitiveLine.getAllPrimitiveId()) == sorted(before)
        preview = await eda.dmt_EditorControl.getCurrentRenderedAreaImage()
        assert isinstance(preview, Blob) and preview.type == 'image/png' and preview.size > 0
        assert await session.eval('return inputs.image', {'image': preview}) == preview
        report.update(components=len(components), originalLineIdsPreserved=True, typedCoordinatesRoundTrip=True,
                      previewRoundTrip=True, previewBytes=preview.size)
    folder = ROOT / '.test-data' / 'sdk-live'
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'python-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


asyncio.run(main())
