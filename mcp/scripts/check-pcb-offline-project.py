"""Read-only regression against the neuro_IR saved exports; writes only a fresh temp dir.

Usage: python scripts/check-pcb-offline-project.py C:/path/to/neuro_IR
The project-specific adapter is intentionally separate from the packaged tools.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
import subprocess
import tempfile
import warnings
import zipfile

from gerbonara import ExcellonFile
from gerbonara.utils import MM

spec=importlib.util.spec_from_file_location('pcb_offline',Path(__file__).resolve().parents[1]/'python/easyeda_copilot/pcb_offline.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
root=Path(sys.argv[1]).resolve()
out=Path(tempfile.mkdtemp(prefix='easyeda-offline-regression-'))
paths=[root/'verification/pcb-routing-geometry.json',root/'verification/pcb-world-pads.json',root/'verification/pcb-final.json']
paths+=sorted(p for p in (root/'hardware/release').rglob('*') if p.is_file())
def hashes(): return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
before=hashes()
def read(name): return json.loads((root/name).read_text(encoding='utf-8-sig'))
g=read('verification/pcb-routing-geometry.json')
assert not g['constraintRegions'] and not g['fillRegions'], 'Unmodeled constraints/fills'
archive=root/'hardware/release/neuro-ir-rev-a-gerbers.zip'
with zipfile.ZipFile(archive) as z, warnings.catch_warnings():
    warnings.simplefilter('ignore')
    pth=ExcellonFile.from_string(z.read('Drill_PTH_Through.DRL').decode(),plated=True)
    npth=ExcellonFile.from_string(z.read('Drill_NPTH_Through.DRL').decode(),plated=False)
def hit(o): return [o.unit.convert_to(MM,o.x),o.unit.convert_to(MM,o.y),o.tool.unit.convert_to(MM,o.tool.diameter)]
holes=[{'xy':hit(o)[:2],'diameter_mm':hit(o)[2],'plated':False,'copper_keepout_mm':0} for o in npth.objects]
# The project has circular copper exclusions encoded as two semicircles. Require
# the exact supported form and match each to a real NPTH before converting it.
for region in g['prohibitedRegions']:
    a,b,c=region['path']
    assert len(a)==2 and b[2]==c[2]==180 and a==c[:2] and a[1]==b[1]
    assert set(region['layers'])=={1,2,15,16}
    center=[(a[0]+b[0])/2,a[1]]; radius=abs(a[0]-b[0])/2
    matches=[h for h in holes if math.dist(center,h['xy'])<.002]
    assert len(matches)==1
    matches[0]['copper_keepout_mm']=radius-matches[0]['diameter_mm']/2
unique={}; duplicate_uncertainty={}
for p in read('verification/pcb-world-pads.json')['pads']:
    if p['id'] in unique:
        old=unique[p['id']]
        assert all(old[k]==p[k] for k in ('net','shape','layer'))
        delta=math.dist([old['x'],old['y']],[p['x'],p['y']])
        assert delta<.003, 'Duplicate pad positions disagree beyond export rounding'
        duplicate_uncertainty[p['id']]=max(duplicate_uncertainty.get(p['id'],0),delta)
        assert abs((old['rotation']-p['rotation']+180)%360-180)<1e-9
    else: unique[p['id']]=p
pads=[]
for p in unique.values():
    # NPTH objects are modeled as holes, not fictitious copper pads.
    if any(math.dist([p['x'],p['y']],h['xy'])<.002 for h in holes): continue
    shape={'RECT':'rect','OVAL':'oval','ELLIPSE':'circle'}[p['shape'][0]]
    q={'id':p['id'],'reference':p['ref'],'number':p['number'],'net':p.get('net',''),
       'xy':[p['x'],p['y']],'rotation_deg':p['rotation'],'shape':shape,
       'size_mm':[x*.0254+2*duplicate_uncertainty.get(p['id'],0) for x in p['shape'][1:3]],'layer':p['layer']}
    if q['layer']==12:
        candidates=[hit(o) for o in pth.objects if math.dist(hit(o)[:2],q['xy'])<.002]
        assert len(candidates)==1, 'Ambiguous or missing through drill'
        q['drill_mm']=candidates[0][2]
    pads.append(q)
s={'schema':'pcb-offline/v1','units':'mm','frame':'x-right-y-up','source':{
        'geometry':'saved pre-release routing snapshot; not a live or final-board capture',
        'input_hashes':before,'board_thickness':'1.6 mm project fabrication specification'},
   'obstacle_coverage':'pads-tracks-through-vias-npth-only',
   'board':{'outline':g['boardOutline']['path'],'holes':holes,'thickness_mm':1.6},'pads':pads,
   'tracks':[{'net':t['net'],'layer':t['layer'],'width_mm':t['width'],'points':t['path']} for t in g['tracks']],
   'vias':[{'net':v['net'],'xy':v['location'],'diameter_mm':v['size'][0],'drill_mm':v['size'][1],'through':True} for v in g['vias']],
   'components':[{'reference':ref,'xy':c['location'],'rotation_deg':c['rotation'],'side':'top' if c['layer']==1 else 'bottom',
                  'height_mm':None,'footprint':c['footprint']} for ref,c in g['components'].items() if ref!='eFREEPADCOMPONENT']}
(out/'snapshot.json').write_text(json.dumps(s),encoding='utf-8')
plan=m.ground(s,{})
(out/'ground.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
datums=[]
for ref in ('D102','D202','D302','D402'):
    pp={p['number']:p['id'] for p in pads if p['reference']==ref}
    datums.append({'name':ref+' die','from_pad':pp['2'],'toward_pad':pp['1'],
                   'offset_from_midpoint_mm':.18,'source':'project detector die-offset specification'})
mech=m.mechanical(s,{'optical_datums':datums})
assert len(mech['components'])==273 and len(mech['board']['holes'])==4
assert len(mech['unknown_height_references'])==273
(out/'mechanical.json').write_text(json.dumps(mech,indent=2),encoding='utf-8')
layers={'mechanical outline':'Gerber_BoardOutlineLayer.GKO'}
for side,prefix in [('top','Top'),('bottom','Bottom')]:
    for role,name,ext in [('copper','Layer','L'),('silk','SilkscreenLayer','O'),('mask','SolderMaskLayer','S'),('paste','PasteMaskLayer','P')]:
        layers[f'{side} {role}']=f'Gerber_{prefix}{name}.G'+('T' if side=='top' else 'B')+ext
result=m.gerbers(archive,out,{'layers':layers,'drills':[{'file':name,'plated':plated} for name,plated in
    [('Drill_PTH_Through.DRL',True),('Drill_PTH_Through_Via.DRL',True),('Drill_NPTH_Through.DRL',False)]]})
assert result['duplicate_drill_hits_omitted_from_preview']==309
assert result['drill_objects_rendered']==333
# Pixel regression for the mirrored SVG filter-clipping bug. No browser or CAD.
subprocess.run(['node','--input-type=module','-e',r'''
import sharp from 'sharp';
const dir=process.argv[1];
for (const side of ['top','bottom']) {
  const png=dir+'/'+side+'.png';
  await sharp(dir+'/'+side+'.svg').resize({width:1600}).png().toFile(png);
  const {data,info}=await sharp(png).raw().toBuffer({resolveWithObject:true});
  for (const x of [101,1498]) for (const y of [101,1498]) {
    const i=(y*info.width+x)*info.channels;
    if (data[i]!==48 || data[i+1]!==48 || data[i+2]!==48) throw Error('Missing NPTH: '+side);
  }
}
''',str(out)],cwd=Path(__file__).resolve().parents[1],check=True,timeout=30)
assert hashes()==before, 'Saved project inputs changed during test'
report={'input_files_unchanged':len(before),'output_directory':str(out),
        'duplicate_pad_envelope_expansion_mm':{k:2*v for k,v in duplicate_uncertainty.items() if v>1e-9},'planned':len(plan['returns']),
        'unresolved':len(plan['failures']),'new_vias':len(plan['new_vias']),'mechanical_components':273,
        'mounting_holes':4,'optical_datums':mech['optical_datums'],'gerber':result}
(out/'regression.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('gerber','optical_datums')},indent=2))
