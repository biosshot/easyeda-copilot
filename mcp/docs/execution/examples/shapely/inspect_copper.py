"""Read-only: Python inspect_copper.py --document UUID --poured-mm-per-unit 0.254.

Set PYTHONPATH to MCP_ROOT/dist/lib/python and install Shapely 2.x in this Python.
The supplied scale must already have been checked against known editor geometry.
"""
import argparse
import asyncio
import json
import sys
sys.dont_write_bytecode = True
from easyeda_copilot import connect
from eda_geometry import source_geometry

async def main(args):
    async with await connect(document_uuid=args.document,instance_id=args.instance) as session:
        eda=session.eda
        poured=await eda.pcb_PrimitivePoured.getAll()
        for item in poured:
            pour_id,fills=await asyncio.gather(item.getState_PourPrimitiveId(),item.getState_PourFills())
            sources=await asyncio.gather(*(f['path'].getSource() for f in fills))
            diagnostics=[]
            geometries=[source_geometry(src,mm_per_unit=args.poured_mm_per_unit,filled=f['fill'],line_width=f['lineWidth'],max_error_mm=args.error_mm,repair_invalid=args.repair_invalid,diagnostics=diagnostics) for f,src in zip(fills,sources)]
            from shapely.ops import unary_union
            copper=unary_union(geometries)
            print(json.dumps({'pour_id':pour_id,'area_mm2':copper.area,'bounds_mm':copper.bounds,'fill_count':len(fills),'approximation_error_mm':args.error_mm,'repairs':diagnostics}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--document',required=True);parser.add_argument('--instance')
    parser.add_argument('--poured-mm-per-unit',type=float,required=True);parser.add_argument('--error-mm',type=float,default=.005)
    parser.add_argument('--repair-invalid',action='store_true',help='Explicitly repair invalid contours and report topology changes; no editor edits')
    asyncio.run(main(parser.parse_args()))
