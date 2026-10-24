"""Offline PCB handoff tools. No editor/SDK imports and no document mutations.

Ground search adapted from neuro_IR/tools/plan_ground_returns.py; fabrication
rendering from neuro_IR/tools/audit_pcb_release.py. See docs/pcb-offline.md.
"""
import hashlib
import heapq
import io
import json
import math
from pathlib import Path
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET


def number(x, positive=False):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x):
        raise ValueError('Expected a finite number')
    if positive and x <= 0:
        raise ValueError('Expected a positive dimension')
    return x


def point(p):
    if len(p) != 2:
        raise ValueError('Expected XY point')
    return [number(v) for v in p]


def snapshot(s):
    if s.get('schema') != 'pcb-offline/v1' or s.get('units') != 'mm' or s.get('frame') != 'x-right-y-up':
        raise ValueError('Require pcb-offline/v1, mm, x-right-y-up; convert native mil and solver Y explicitly')
    if set(s) - {'schema', 'units', 'frame', 'source', 'board', 'pads', 'tracks', 'vias', 'components', 'obstacle_coverage'}:
        raise ValueError('Unsupported snapshot fields; do not silently omit obstacle geometry')
    board = s['board']
    if set(board) - {'outline', 'holes', 'thickness_mm'}:
        raise ValueError('Unsupported board geometry (cutouts must be explicit holes)')
    poly = [point(p) for p in board['outline']]
    if poly[0] == poly[-1]:
        poly.pop()
    if len(poly) < 3 or len(poly) > 10000:
        raise ValueError('Require a simple polygon outline with 3..10000 vertices')
    # Reject crossings, touching nonadjacent edges and zero length edges.
    def orient(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    for i, a in enumerate(poly):
        b = poly[(i+1) % len(poly)]
        if a == b:
            raise ValueError('Zero length outline edge')
        for j in range(i+2, len(poly)):
            if i == 0 and j == len(poly)-1:
                continue
            c, d = poly[j], poly[(j+1) % len(poly)]
            if (max(a[0], b[0]) >= min(c[0], d[0]) and max(c[0], d[0]) >= min(a[0], b[0])
                and max(a[1], b[1]) >= min(c[1], d[1]) and max(c[1], d[1]) >= min(a[1], b[1])
                and orient(a,b,c)*orient(a,b,d) <= 0 and orient(c,d,a)*orient(c,d,b) <= 0):
                raise ValueError('Self-intersecting outline')
    if abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly, poly[1:]+poly[:1]))) < 1e-9:
        raise ValueError('Degenerate outline')
    board['outline'] = poly
    number(board['thickness_mm'], True)
    for h in board['holes']:
        if set(h) - {'xy','diameter_mm','plated','copper_keepout_mm'}: raise ValueError('Unsupported hole geometry')
        point(h['xy']); number(h['diameter_mm'], True)
        if h.get('plated') is not False:
            raise ValueError('Board holes must be NPTH; model plated terminals as pads')
        if number(h.get('copper_keepout_mm', 0)) < 0:
            raise ValueError('Negative hole keepout')
    unique = {}
    for p in s['pads']:
        if set(p) - {'id','reference','number','net','xy','rotation_deg','shape','size_mm','layer','drill_mm'}:
            raise ValueError('Unsupported pad fields')
        point(p['xy']); number(p['rotation_deg'])
        if p['layer'] not in (1,2,12,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32):
            raise ValueError('Unsupported copper layer')
        if p.get('drill_mm') is not None: number(p['drill_mm'], True)
        if p['layer'] == 12 and not p.get('drill_mm'): raise ValueError('Through pads require explicit circular drill size')
        if p['shape'] not in ('circle', 'rect', 'oval') or len(p['size_mm']) != 2:
            raise ValueError('Unsupported pad shape')
        for v in p['size_mm']: number(v, True)
        if p['shape'] == 'circle' and p['size_mm'][0] != p['size_mm'][1]:
            raise ValueError('Circle dimensions differ')
        if p['id'] in unique and unique[p['id']] != p:
            raise ValueError('Conflicting duplicate pad: '+p['id'])
        unique[p['id']] = p
    s['pads'] = list(unique.values())
    for t in s['tracks']:
        if set(t) - {'net','layer','width_mm','points'}: raise ValueError('Unsupported track geometry')
        if t['layer'] not in (1,2,12,*range(15,33)): raise ValueError('Unsupported track layer')
        number(t['width_mm'], True)
        if len(t['points']) < 2: raise ValueError('Track needs at least two points')
        for p in t['points']: point(p)
    for v in s['vias']:
        if set(v) - {'xy','diameter_mm','drill_mm','net','through'}: raise ValueError('Unsupported via geometry')
        point(v['xy']); number(v['diameter_mm'], True); number(v['drill_mm'], True)
        if v['drill_mm'] >= v['diameter_mm']: raise ValueError('Via needs an annulus')
        if v.get('through') is not True: raise ValueError('Only through vias supported')
    return s


def ground(s, opt):
    import numpy as np
    snapshot(s)
    if s.get('obstacle_coverage') != 'pads-tracks-through-vias-npth-only':
        raise ValueError('Explicit obstacle coverage required; zones/arcs/keepouts must be converted or rejected upstream')
    net = opt.get('net', 'GND')
    step, radius = opt.get('step_mm', .05), opt.get('radius_mm', 4)
    width, clear = opt.get('width_mm', .2), opt.get('clearance_mm', .155)
    diameter, drill = opt.get('via_diameter_mm', .6), opt.get('via_drill_mm', .3)
    edge, holegap = opt.get('edge_clearance_mm', .25), opt.get('drill_clearance_mm', .25)
    for x in (step, radius, width, clear, diameter, drill, edge, holegap): number(x, True)
    if drill >= diameter: raise ValueError('Via drill must be smaller than copper diameter')
    n = math.ceil(radius/step)
    if n > 200: raise ValueError('Search limited to 401 by 401 cells per pad')
    guard = step/math.sqrt(2)+.003
    targets = [p for p in s['pads'] if p['net'] == net and p['layer'] in (1,2)]
    ids = opt.get('pad_ids')
    if ids is not None:
        if set(ids)-{p['id'] for p in targets}: raise ValueError('Unknown or ineligible target pads')
        targets = [p for p in targets if p['id'] in ids]
    if len(targets) > 500: raise ValueError('At most 500 targets per request')
    routes, failures, added = [], [], []
    def segment_distance(X,Y,a,b):
        dx,dy=b[0]-a[0],b[1]-a[1]
        norm=dx*dx+dy*dy
        k=np.clip(((X-a[0])*dx+(Y-a[1])*dy)/norm,0,1) if norm else 0
        return np.hypot(X-a[0]-k*dx,Y-a[1]-k*dy)
    for target in targets:
        tx,ty=target['xy']; axis=np.arange(-n,n+1)*step
        extent=n*step
        margin=max(width,diameter,drill)/2+max(clear,holegap,.05)+guard
        X,Y=np.meshgrid(axis+tx,axis+ty); shape=X.shape; center=(n,n)
        blocked=np.zeros(shape,bool); vb=np.zeros(shape,bool)
        inside=np.zeros(shape,bool); boundary=np.full(shape,np.inf)
        poly=s['board']['outline']
        for a,b in zip(poly,poly[1:]+poly[:1]):
            boundary=np.minimum(boundary,segment_distance(X,Y,a,b))
            if a[1]!=b[1]: inside ^= ((a[1]>Y)!=(b[1]>Y)) & (X < (b[0]-a[0])*(Y-a[1])/(b[1]-a[1])+a[0])
        blocked |= ~inside | (boundary < edge+width/2+guard)
        vb |= ~inside | (boundary < edge+diameter/2+guard)
        for h in s['board']['holes']:
            d=np.hypot(X-h['xy'][0],Y-h['xy'][1])-h['diameter_mm']/2
            keep=h.get('copper_keepout_mm',0)
            blocked |= d < max(clear,keep)+width/2+guard
            vb |= (d < max(clear,keep)+diameter/2+guard) | (d < drill/2+holegap+guard)
        for p in s['pads']:
            reach=math.hypot(*p['size_mm'])/2+margin+p.get('drill_mm',0)/2
            if abs(p['xy'][0]-tx)>extent+reach or abs(p['xy'][1]-ty)>extent+reach: continue
            dx,dy=X-p['xy'][0],Y-p['xy'][1]; a=math.radians(p['rotation_deg'])
            u=np.abs(dx*math.cos(a)+dy*math.sin(a)); v=np.abs(-dx*math.sin(a)+dy*math.cos(a))
            hw,hh=[x/2 for x in p['size_mm']]
            # Oval envelope is deliberately conservative, never narrower than actual copper.
            d=np.hypot(dx,dy)-hw if p['shape']=='circle' else np.hypot(np.maximum(u-hw,0),np.maximum(v-hh,0))
            vb |= d < diameter/2+(clear if p['net']!=net else .05)+guard
            if p['net']!=net and p['layer'] in (target['layer'],12): blocked |= d < width/2+clear+guard
            if p.get('drill_mm'):
                vb |= np.hypot(dx,dy) < p['drill_mm']/2+drill/2+holegap+guard
        for t in s['tracks']:
            if t['net']==net: continue
            for a,b in zip(t['points'],t['points'][1:]):
                reach=t['width_mm']/2+margin
                if max(a[0],b[0])<tx-extent-reach or min(a[0],b[0])>tx+extent+reach or max(a[1],b[1])<ty-extent-reach or min(a[1],b[1])>ty+extent+reach: continue
                d=segment_distance(X,Y,a,b)-t['width_mm']/2
                vb |= d < diameter/2+clear+guard
                if t['layer'] in (target['layer'],12): blocked |= d < width/2+clear+guard
        for v in s['vias']+added:
            reach=max(v['diameter_mm'],v['drill_mm'])/2+margin
            if abs(v['xy'][0]-tx)>extent+reach or abs(v['xy'][1]-ty)>extent+reach: continue
            d=np.hypot(X-v['xy'][0],Y-v['xy'][1])
            vb |= d < drill/2+v['drill_mm']/2+holegap+guard
            if v['net']!=net:
                vb |= d < diameter/2+v['diameter_mm']/2+clear+guard
                blocked |= d < width/2+v['diameter_mm']/2+clear+guard
        reuse={}
        for v in s['vias']+added:
            if v['net'] != net: continue
            x,y=v['xy']; ix=round((x-tx)/step)+n; iy=round((y-ty)/step)+n
            # Guard covers the entire snapped cell and its short exact endpoint segment.
            if 0<=ix<shape[1] and 0<=iy<shape[0] and not blocked[iy,ix]: reuse[(iy,ix)]=v['xy']
        heap=[(0,center)]; cost={center:0}; previous={}; found=None
        if not blocked[center]:
            while heap:
                d,node=heapq.heappop(heap)
                if d!=cost[node]: continue
                if node in reuse or not vb[node]: found=node; break
                iy,ix=node
                for dy,dx in ((0,1),(1,0),(0,-1),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)):
                    y,x=iy+dy,ix+dx
                    if not (0<=y<shape[0] and 0<=x<shape[1]) or blocked[y,x] or blocked[iy,x] or blocked[y,ix]: continue
                    q=(y,x); nd=d+math.hypot(dx,dy)*step
                    if nd<cost.get(q,math.inf): cost[q]=nd; previous[q]=node; heapq.heappush(heap,(nd,q))
        if found is None:
            failures.append({'pad_id':target['id'],'reason':'no legal escape within bounded search','visited_cells':len(cost)})
            continue
        chain=[found]
        while chain[-1]!=center: chain.append(previous[chain[-1]])
        chain.reverse()
        points=[[float(X[y,x]),float(Y[y,x])] for y,x in chain]
        # Only remove collinear grid vertices; no unverified shortcut segments.
        simple=[]
        for p in points:
            while len(simple)>1 and abs((simple[-1][0]-simple[-2][0])*(p[1]-simple[-1][1])-(simple[-1][1]-simple[-2][1])*(p[0]-simple[-1][0]))<1e-10: simple.pop()
            simple.append(p)
        via=reuse.get(found,points[-1]); new=found not in reuse
        if via!=simple[-1]: simple.append(via)
        if new: added.append({'xy':via,'diameter_mm':diameter,'drill_mm':drill,'net':net,'through':True})
        routes.append({'pad_id':target['id'],'reference':target.get('reference'),'layer':target['layer'],'points':simple,'via':via,'new_via':new})
    return {'schema':'ground-escape-plan/v1','units':'mm','frame':s['frame'],'net':net,'width_mm':width,
            'clearance_mm':clear,'grid_guard_mm':guard,'returns':routes,'new_vias':added,'failures':failures,
            'cad_modified':False,'connectivity_verified':False,
            'limitations':['Conditional plan: destination plane fill/connectivity requires native refill and DRC after explicit application.',
                           'No via-in-pad or manufacturing escalation. Oval envelopes are conservative.']}


def mechanical(s, opt):
    snapshot(s)
    components=[]
    for c in s.get('components',[]):
        point(c['xy']); number(c['rotation_deg'])
        if c['side'] not in ('top','bottom'): raise ValueError('Invalid component side')
        height=c.get('height_mm')
        if height is not None: number(height, True)
        components.append({**c,'height_mm':height,'height_source':c.get('height_source') if height is not None else None})
        if height is not None and not c.get('height_source'): raise ValueError('Known height requires source')
    datums=[]
    by_id={p['id']:p for p in s['pads']}
    for d in opt.get('optical_datums',[]):
        a,b=by_id[d['from_pad']],by_id[d['toward_pad']]
        if a.get('reference')!=b.get('reference') or not a.get('reference'): raise ValueError('Datum pads must belong to one component')
        dx,dy=b['xy'][0]-a['xy'][0],b['xy'][1]-a['xy'][1]; length=math.hypot(dx,dy)
        if not length: raise ValueError('Coincident datum pads')
        offset=number(d['offset_from_midpoint_mm'])
        datums.append({'name':d['name'],'reference':a['reference'],'xy':[(a['xy'][0]+b['xy'][0])/2+offset*dx/length,(a['xy'][1]+b['xy'][1])/2+offset*dy/length],
                       'axis_xy':[dx/length,dy/length],'source':d['source']})
    return {'schema':'pcb-mechanical/v1','units':'mm','frame':s['frame'],'z_datum':'PCB top surface; positive Z toward top components',
            'bottom_surface_z_mm':-s['board']['thickness_mm'],'board':s['board'],'components':components,'pads':s['pads'],
            'optical_datums':datums,'unknown_height_references':[c['reference'] for c in components if c['height_mm'] is None],
            'cad_modified':False,'source':s.get('source'),'collision_verified':False}


def gerbers(path, out, opt):
    from gerbonara import LayerStack, GerberFile, ExcellonFile
    from gerbonara.utils import MM
    # Explicit mappings avoid drill guessing and silently missing NPTH files.
    mapping=opt['layers']; drills=opt['drills']
    required={'top copper','bottom copper','mechanical outline'}
    if not required <= mapping.keys(): raise ValueError('Top/bottom copper and mechanical outline are required')
    allowed={'mechanical outline'} | {f'{side} {use}' for side in ('top','bottom') for use in ('copper','mask','silk','paste')}
    if set(mapping)-allowed: raise ValueError('Unsupported preview layer role')
    if not drills: raise ValueError('Explicit drill mapping required, including NPTH where present')
    with zipfile.ZipFile(path) as z:
        if len(z.namelist())!=len(set(z.namelist())): raise ValueError('Duplicate ZIP member names')
        selected=list(mapping.values())+[d['file'] for d in drills]
        if len(selected)!=len(set(selected)): raise ValueError('A file cannot serve multiple roles')
        if any(z.getinfo(n).file_size>50_000_000 for n in selected) or sum(z.getinfo(n).file_size for n in selected)>200_000_000:
            raise ValueError('Gerber archive exceeds parse budget')
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            layers={tuple(role.split()):GerberFile.from_string(z.read(name).decode('utf-8-sig')) for role,name in mapping.items()}
            parsed=[]; seen={}; duplicates=0
            for d in drills:
                f=ExcellonFile.from_string(z.read(d['file']).decode('utf-8-sig'),plated=d['plated'])
                objects=[]
                for obj in f.objects:
                    # Deduplicate only identical circular hits; routed slots remain intact.
                    if type(obj).__name__=='Flash':
                        x,y=obj.unit.convert_to(MM,obj.x),obj.unit.convert_to(MM,obj.y)
                        dia=obj.tool.unit.convert_to(MM,obj.tool.diameter)
                        key=(round(x,6),round(y,6),round(dia,6))
                        if key in seen:
                            if seen[key]!=d['plated']: raise ValueError('Conflicting drill plating at identical hole')
                            duplicates+=1; continue
                        seen[key]=d['plated']
                    objects.append(obj)
                f.objects=objects; parsed.append(f)
            stack=LayerStack(graphic_layers=layers,drill_layers=parsed)
            paths={}
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
            for side in ('top','bottom'):
                svg=ET.fromstring(str(stack.to_pretty_svg(side=side)))
                # Some SVG rasterizers clip the filter region for mirrored drill
                # groups. Holes need no blending: paint their actual primitives
                # directly, preserving geometry and the single underside mirror.
                for group in svg.iter():
                    if group.attrib.get('id','').startswith('l-drill-'):
                        group.attrib.pop('filter',None)
                        for element in group.iter():
                            for attribute in ('fill','stroke'):
                                if element.attrib.get(attribute) in ('white','black'):
                                    element.set(attribute,'#303030')
                p=out/f'{side}.svg'; p.write_text(ET.tostring(svg,encoding='unicode'),encoding='utf-8'); paths[side]=str(p)
            return {'svg':paths,'bounds_mm':stack.board_bounds(unit=MM),'duplicate_drill_hits_omitted_from_preview':duplicates,
                    'drill_objects_rendered':sum(len(f.objects) for f in parsed),'warnings':[str(w.message) for w in caught],
                    'layers':mapping,'drills':drills,'unmapped_archive_members':sorted(set(z.namelist())-set(selected)),
                    'bottom_view':'viewed from underside; mirrored once by renderer','cad_modified':False,'archive_modified':False,
                    'limitations':['Preview reflects supplied archive, not live editor freshness or DRC. No fabrication archive is rewritten.']}


def main():
    request=json.load(sys.stdin); source=Path(request['input']); out=Path(request['output'])
    out.mkdir(parents=True,exist_ok=False)
    payload=source.read_bytes(); digest=hashlib.sha256(payload).hexdigest()
    action=request['action']; opt=request.get('options',{})
    if action=='gerber': result=gerbers(io.BytesIO(payload),out,opt)
    else:
        s=json.loads(payload.decode('utf-8-sig'))
        result={'ground':ground,'mechanical':mechanical}[action](s,opt)
    result['input_sha256']=digest
    report=out/'report.json'; report.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({'report_path':str(report),**result}))


if __name__=='__main__':
    main()
