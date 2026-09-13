# Local PCB geometry with Shapely

**Shapely 2.x is recommended for local Python PCB geometry calculations**: distances,
clearance envelopes, intersections, unions, islands and spatial indexing. It is an
optional example dependency; the core SDK has no Shapely dependency. Install it in
the Python environment running your script, for example `python -m pip install
"shapely>=2,<3"`. Examples were checked with Shapely 2.1.1 and Python 3.11.

Read [PCB units and compatibility checks](pcb-units.md) first. EasyEDA API scales
can change; specify and verify units before calculating or applying edits.

Shapely is planar. Keep net and layer metadata alongside geometry; an XY overlap
between different copper layers does not establish a connection. See the
[Shapely manual](https://shapely.readthedocs.io/en/stable/manual.html) and
[STRtree](https://shapely.readthedocs.io/en/stable/strtree.html).

## Native geometry to millimetres

Copy/import [eda_geometry.py](examples/shapely/eda_geometry.py) beside your task
script. It is an example module, not part of the stable native EDA API. It supports
RECT/ELLIPSE/OVAL pads, L, signed ARC/CARC, cubic C, CIRCLE, and unrotated/unrounded R
contours. Other forms fail explicitly. Pad geometry describes the copper outline;
it does not include drill subtraction, hole offsets, mask expansion or custom pads.

```python
from eda_geometry import pad_geometry, source_geometry
from shapely.geometry import LineString, Point
from easyeda_copilot.units import mil_to_mm

pad = pad_geometry(shape, x, y, rotation, mm_per_unit=.0254)
track = LineString([(mil_to_mm(x1), mil_to_mm(y1)),
                    (mil_to_mm(x2), mil_to_mm(y2))]).buffer(mil_to_mm(width) / 2)
via = Point(mil_to_mm(via_x), mil_to_mm(via_y)).buffer(mil_to_mm(diameter) / 2)

# `fill` is a native getState_PourFills() record; .254 must be verified first.
source = await fill['path'].getSource()
copper = source_geometry(source, mm_per_unit=.254,
                         filled=fill['fill'], line_width=fill['lineWidth'],
                         max_error_mm=.005, fill_rule='evenodd')
```

Filled complex contours use explicit even/odd parity, preserving holes and nested
islands. A record with `fill=False` is a stroked path with width, not an empty area
and not a implicitly closed filled polygon. Do not confuse the pour source outline
with its rebuilt fill.

Curves are approximated with an explicit error in mm. Increase clearance margins
to cover errors in both compared outlines; a passing approximate calculation near
a limit is not a native DRC result. Invalid contours raise by default. Optional
`repair_invalid=True` emits warnings and may change topology; inspect the result
before using it. Repair retains polygonal area and explicitly warns about discarded
line/point residues. Pass a `diagnostics` list to record the cause, area before/after
and discarded types. The module does not silently call `buffer(0)` to repair input.

[inspect_copper.py](examples/shapely/inspect_copper.py) is a runnable read-only
example: it reads remote native paths through the Python SDK and prints compact
area/bounds summaries. It neither rebuilds nor changes copper:

```text
python inspect_copper.py --document PCB_UUID --poured-mm-per-unit 0.254
```

Set `PYTHONPATH` as described in [SDK setup](local-sdk.md#locate-and-run). Use the
scale argument only after its basic verification. No intermediate JSON is required
for SDK transport; local JSON reports are optional audit artifacts.

If a real native contour self-intersects, the default run fails. Inspect that
contour, then explicitly use `--repair-invalid` for a diagnostic conversion. This
prints repair details and does not modify the editor. One such contour was observed
on the test controller PCB; successful repair alone does not certify connectivity.

## Check a proposed via

```python
from shapely.geometry import Point
from shapely.ops import unary_union

candidate = Point(x_mm, y_mm).buffer(via_diameter_mm / 2)
# Include foreign copper on every layer spanned by the via.
foreign_copper = unary_union(foreign_objects)
clear = candidate.distance(foreign_copper) >= clearance_mm + geometry_margin_mm
inside = board.covers(candidate.buffer(board_clearance_mm))
off_pads = all(candidate.distance(pad) >= soldering_gap_mm for pad in pads)
outside_keepouts = all(not candidate.intersects(area) for area in keepouts)
joins_fill = top_ground.covers(candidate.centroid) and bottom_ground.covers(candidate.centroid)
```

This is a candidate filter. Also inspect drill spacing, thermal connections and
whether the two fills lead to useful ground. Hole centres alone are not enough for
clearance. Read actual rule values; do not copy illustrative dimensions into a new
board. Rebuild fills and verify native whole-board DRC after edits.

## Find islands and nearby obstacles

```python
from shapely import STRtree
from shapely.ops import unary_union

ground = unary_union(ground_polygons_on_one_layer)
islands = list(ground.geoms) if ground.geom_type == 'MultiPolygon' else [ground]
tree = STRtree(obstacles)
nearby_indices = tree.query(candidate.buffer(clearance_mm), predicate='intersects')
```

The tree indexes the input snapshot: rebuild it after geometry changes. Determine
electrical joins between layers using actual plated pads/vias, then confirm native
connectivity. Do not inflate geometry until a desired connection appears.

## Check automatic track merging

```python
new_copper = unary_union(current_tracks_on_same_net_and_layer)
old_segment = old_track_polygon
covered = new_copper.buffer(numeric_tolerance_mm).covers(old_segment)
```

Use this for an identified merge inside the authorized edit area. Check surrounding
objects independently; do not accept arbitrary missing primitive IDs merely because
the net remains connected. Keep the tolerance small and justified. Native returned
IDs can become stale after later automatic merging, so reread the affected region.
