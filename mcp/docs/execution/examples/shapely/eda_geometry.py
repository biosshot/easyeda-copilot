"""Optional Shapely 2.x example. Explicit units, planar geometry, no editor mutations.

Review pcb-units.md and shapely-geometry.md before use. Unsupported geometry fails
explicitly; native DRC remains the final check. Input contours use native XY axes.
"""
import math
import warnings
from shapely import make_valid
from shapely.geometry import Point, LineString, Polygon, GeometryCollection, box
from shapely.affinity import rotate, translate, scale
from shapely.ops import unary_union
from shapely.validation import explain_validity

def _number(x):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x):
        raise ValueError('Expected a finite numeric geometry parameter')
    return x

def _steps(radius, angle, error):
    if radius <= 0: return 1
    step = 2 * math.acos(max(-1, min(1, 1-error/radius)))
    n = max(1, math.ceil(abs(angle)/max(step, 1e-9)))
    if n > 100000: raise ValueError('Curve approximation exceeds point budget')
    return n

def _bezier(points, error, depth=0):
    a,b,c,d=points
    chord=LineString([a,d])
    if max(Point(b).distance(chord),Point(c).distance(chord)) <= error: return [d]
    if depth>=24: raise ValueError('Bezier subdivision exceeded limit')
    def mid(p,q): return ((p[0]+q[0])/2,(p[1]+q[1])/2)
    ab,bc,cd=mid(a,b),mid(b,c),mid(c,d)
    abc,bcd=mid(ab,bc),mid(bc,cd);m=mid(abc,bcd)
    return _bezier([a,ab,abc,m],error,depth+1)+_bezier([m,bcd,cd,d],error,depth+1)

def path_points(source, *, mm_per_unit, max_error_mm=.005):
    """L, ARC/CARC (signed degrees), C (cubic), CIRCLE and unrounded R.

    R rotation/rounding is rejected until its editor convention is independently
    verified. Curve error is geometric approximation, not a clearance allowance.
    """
    unit=_number(mm_per_unit);error=_number(max_error_mm)
    if unit<=0 or error<=0: raise ValueError('Scale and curve error must be positive')
    if not isinstance(source,(list,tuple)) or not source: raise ValueError('Empty polygon source')
    if source[0]=='CIRCLE':
        if len(source)!=4: raise ValueError('Malformed CIRCLE')
        cx,cy,r=(_number(v)*unit for v in source[1:])
        if r<=0: raise ValueError('Circle radius must be positive')
        n=max(8,_steps(r,2*math.pi,error))
        return [(cx+r*math.cos(i*2*math.pi/n),cy+r*math.sin(i*2*math.pi/n)) for i in range(n+1)]
    if source[0]=='R':
        if len(source)!=7: raise ValueError('Malformed R')
        x,y,w,h,rotation,rounding=map(_number,source[1:])
        if rotation!=0 or rounding!=0: raise ValueError('Rotated/rounded R requires a verified native convention')
        if w<=0 or h<=0: raise ValueError('Rectangle size must be positive')
        return [(x*unit,y*unit),((x+w)*unit,y*unit),((x+w)*unit,(y-h)*unit),(x*unit,(y-h)*unit),(x*unit,y*unit)]
    if len(source)<2: raise ValueError('Missing path start')
    pts=[(_number(source[0])*unit,_number(source[1])*unit)];i=2
    while i<len(source):
        cmd=source[i];i+=1
        if cmd=='L':
            count=0
            while i<len(source) and not isinstance(source[i],str):
                if i+1>=len(source): raise ValueError('Malformed L')
                pts.append((_number(source[i])*unit,_number(source[i+1])*unit));i+=2;count+=1
            if not count: raise ValueError('Empty L command')
        elif cmd in ('ARC','CARC'):
            if i+2>=len(source): raise ValueError('Malformed ARC')
            angle=math.radians(_number(source[i]));end=(_number(source[i+1])*unit,_number(source[i+2])*unit);i+=3
            x,y=pts[-1];dx,dy=end[0]-x,end[1]-y
            if abs(angle)<1e-12: pts.append(end);continue
            if abs(angle)>=2*math.pi or math.hypot(dx,dy)<1e-12: raise ValueError('Ambiguous full-circle arc; use CIRCLE')
            center=((x+end[0])/2-dy/(2*math.tan(angle/2)),(y+end[1])/2+dx/(2*math.tan(angle/2)))
            a=math.atan2(y-center[1],x-center[0]);r=math.hypot(x-center[0],y-center[1])
            n=_steps(r,angle,error)
            pts.extend((center[0]+r*math.cos(a+angle*j/n),center[1]+r*math.sin(a+angle*j/n)) for j in range(1,n+1))
            pts[-1]=end
        elif cmd=='C':
            count=0
            while i<len(source) and not isinstance(source[i],str):
                if i+5>=len(source): raise ValueError('Malformed C')
                q=[(_number(source[i+j])*unit,_number(source[i+j+1])*unit) for j in (0,2,4)]
                pts.extend(_bezier([pts[-1],*q],error));i+=6;count+=1
            if not count: raise ValueError('Empty C command')
        else: raise ValueError(f'Unsupported polygon command: {cmd!r}')
        if len(pts)>200000: raise ValueError('Polygon point budget exceeded')
    return pts

def source_geometry(source, *, mm_per_unit, filled=True, line_width=0, max_error_mm=.005, fill_rule='evenodd', repair_invalid=False, diagnostics=None):
    """Complex contours combine by even/odd parity; open strokes stay strokes.

    Repair is opt-in, emits warnings and may alter topology. Never silently use
    repaired geometry as proof of clearance or electrical connectivity.
    """
    if fill_rule!='evenodd': raise ValueError('Only explicitly verified evenodd contours are supported')
    if not source: return GeometryCollection()
    rings=source if isinstance(source[0],(list,tuple)) else [source]
    result=GeometryCollection()
    for ring_index,ring in enumerate(rings):
        points=path_points(ring,mm_per_unit=mm_per_unit,max_error_mm=max_error_mm)
        if filled:
            if len(set(points))<3: raise ValueError('Degenerate filled contour')
            g=Polygon(points)
            if not g.is_valid:
                if not repair_invalid: raise ValueError('Invalid contour; inspect input or explicitly enable repair_invalid')
                warnings.warn('Repairing invalid native contour; verify topology and native DRC',RuntimeWarning,stacklevel=2)
                reason=explain_validity(g);before_area=g.area
                g=make_valid(g)
                areas=[];residue=[]
                def collect(part):
                    if part.geom_type=='Polygon':areas.append(part)
                    elif hasattr(part,'geoms'):
                        for child in part.geoms:collect(child)
                    else:residue.append(part.geom_type)
                collect(g)
                if not areas: raise ValueError('Contour repair produced no area geometry')
                if residue:warnings.warn(f'Explicit repair discarded non-area residues: {residue}',RuntimeWarning,stacklevel=2)
                g=unary_union(areas)
                if diagnostics is not None:diagnostics.append({'ring':ring_index,'reason':reason,'area_before_mm2':before_area,'area_after_mm2':g.area,'discarded_non_area_types':residue})
            result=result.symmetric_difference(g)
        else:
            width=_number(line_width)*mm_per_unit
            if width<=0: raise ValueError('Stroke needs positive width')
            if len(points)<2: raise ValueError('Stroke needs two points')
            q=max(2,_steps(width/2,math.pi/2,max_error_mm))
            result=result.union(LineString(points).buffer(width/2,quad_segs=q))
    return result

def pad_geometry(shape, x, y, rotation, *, mm_per_unit, max_error_mm=.005):
    """Copper outline only: drilling/mask and layer membership remain caller data."""
    unit=_number(mm_per_unit)
    if unit<=0 or _number(max_error_mm)<=0: raise ValueError('Scale and tolerance must be positive')
    if not shape or shape[0] not in ('RECT','ELLIPSE','OVAL'): raise ValueError('Unsupported pad shape; do not approximate it by its bbox')
    kind=shape[0];w=_number(shape[1])*unit;h=_number(shape[2])*unit
    if w<=0 or h<=0: raise ValueError('Pad dimensions must be positive')
    q=max(2,_steps(max(w,h)/2,math.pi/2,max_error_mm))
    if kind=='ELLIPSE': g=scale(Point(0,0).buffer(1,quad_segs=q),w/2,h/2)
    elif kind=='OVAL':
        r=min(w,h)/2
        ends=[(-(w/2-r),0),(w/2-r,0)] if w>h else [(0,-(h/2-r)),(0,h/2-r)]
        g=LineString(ends).buffer(r,quad_segs=q)
    else:
        if len(shape)!=4: raise ValueError('RECT requires an explicit corner radius')
        radius=_number(shape[3])*unit
        if radius<0 or radius>min(w,h)/2: raise ValueError('Invalid rectangular pad corner radius')
        g=box(-w/2,-h/2,w/2,h/2) if radius==0 else box(-w/2+radius,-h/2+radius,w/2-radius,h/2-radius).buffer(radius,quad_segs=q)
    return translate(rotate(g,_number(rotation),origin=(0,0)),_number(x)*unit,_number(y)*unit)
