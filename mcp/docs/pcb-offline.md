# Offline PCB engineering tools

These three MCP tools operate on saved files. They have no editor bridge and do
not apply routes, change a PCB, rewrite fabrication archives, or claim native DRC
success. They are also callable through the existing CLI. Results include a unique
artifact directory, `report.json`, and the SHA-256 of the input bytes.

## Runtime and bounded verification

Use Python 3.11+ with `numpy` and `gerbonara` installed. The tested versions are
listed in `dist/lib/python/requirements-pcb-offline.txt` (or
`python/requirements-pcb-offline.txt` in a checkout). Set `EASYEDA_PCB_PYTHON` to
the Python executable if it is not on PATH. The worker is included in the existing
SDK packaging step. Each request has a 120-second ceiling and responds to request
cancellation. Ground searches have at most 401×401 cells per pad and 500 targets.
Failures remain explicit; the tool does not retry with narrower clearances or
filled/capped vias.

Development checks: `npm run test:pcb-offline` in the MCP workspace, then
`npm run typecheck` and `npm run build`. Python dependencies are optional for the
rest of the server. Installing them does not modify the running server.

## Snapshot contract

`plan_ground_plane_escapes` and `export_pcb_mechanical_interface` take `file`, an
absolute path to this normalized JSON format:

```json
{
  "schema": "pcb-offline/v1",
  "units": "mm",
  "frame": "x-right-y-up",
  "source": {"document": "saved-board", "capture": "reviewed snapshot"},
  "obstacle_coverage": "pads-tracks-through-vias-npth-only",
  "board": {
    "outline": [[-10,-10],[10,-10],[10,10],[-10,10]],
    "thickness_mm": 1.6,
    "holes": [{"xy":[-8,-8],"diameter_mm":2,"plated":false,"copper_keepout_mm":0.5}]
  },
  "pads": [{"id":"p1","reference":"D1","number":"1","net":"GND",
    "xy":[0,0],"rotation_deg":0,"shape":"rect","size_mm":[1,1],"layer":1}],
  "tracks": [{"net":"VCC","layer":2,"width_mm":0.2,"points":[[3,0],[3,5]]}],
  "vias": [{"net":"GND","xy":[2,0],"diameter_mm":0.6,"drill_mm":0.3,"through":true}],
  "components": [{"reference":"D1","xy":[0,0],"rotation_deg":0,"side":"top","height_mm":null}]
}
```

Use native **world** pad coordinates; do not reconstruct bottom pad positions from
solver rotations. Native coordinates and dimensions in mil require ×0.0254;
placement solver Y-down coordinates require negating Y. The project's older
world-pad dump mixes mm coordinates with mil shape dimensions. Normalize those
fields separately. Duplicate pad IDs are accepted only when normalized records
are identical; resolve redundant standalone/component records before submission.

Outline is one simple polygon (tessellate curves conservatively). Circular NPTH
holes and their radial copper exclusions are explicit. Pad shapes are `circle`,
`rect`, or `oval`, with mm size and native world rotation in degrees. Oval copper
is conservatively bounded by its rotated rectangle. Layer 1 is top, 2 bottom, 12
through-pad, 15–32 inner copper. Through pads require `drill_mm`; slots and blind
vias are unsupported. Tracks are straight segment polylines. Unsupported shapes,
cutouts, zones, arcs, and keepouts must be conservatively converted upstream or
the snapshot must not be declared covered. Coverage is a caller assertion, not
proof that the export contains all live obstacles. Non-ground planes cannot be
omitted from the via collision model.

## Ground escape plans

`plan_ground_plane_escapes` accepts net, optional pad IDs, search radius/grid step,
trace width, copper/edge/drill clearances, and via diameter/drill. Defaults are
documented in the MCP schema; fabrication limits remain the caller's decision.
The bounded Dijkstra search handles rotated pad envelopes, all-layer via
obstacles, NPTH exclusions, outline clearance, and through-via drill separation.
It can reuse an existing through via on the selected net. Grid guarding covers
segments and exact endpoints; simplification removes only collinear vertices.
It never creates via-in-pad. Output `returns` and `new_vias` are a reusable plan,
not an autorouter success claim. Unresolved targets appear in `failures`.

Before a separately authorized application, compare the input hash with a fresh
snapshot and revalidate the plan against current geometry. Refill and run native
DRC once after application. A zero-error result ends that verification gate;
retest only changed or failed checks. This tool does not include an automatic
apply operation or establish that the via lands in a connected filled plane.

## Fabrication preview

`preview_fabrication_gerbers` takes a ZIP `file`, `layers` mapping semantic roles
to exact archive names, and `drills` entries with `file` and explicit `plated`.
Example roles: `top copper`, `bottom copper`, `top silk`, `bottom mask`,
`mechanical outline`. Both outer copper layers and the outline are required.
Map every applicable PTH and NPTH file. Unmapped members are reported for review;
inner copper and fabrication documentation need not be rendered in a surface view.

Both SVGs and their PNG previews come from actual Gerber primitives, including text already converted
to artwork. The underside is mirrored **once** by Gerbonara. Drill mappings avoid
filename guessing that can omit NPTH. Identical circular drill hits are deduplicated
for display; conflicting plating is rejected, and slots are preserved. All parser
warnings and omitted archive members are reported. The original ZIP is untouched.
This checks the supplied fabrication image, not whether the export is current.

## Mechanical handoff

`export_pcb_mechanical_interface` returns outline, holes, world pads, component
poses, board thickness, and optional optical datums. Z=0 is the top board surface;
the bottom is at negative thickness. Known component heights must include
`height_source`; unknown heights remain null and are listed for follow-up.
Additional component metadata, such as reviewed envelopes, is retained but is
not treated as collision-verified. Rotation remains the native world convention;
consumers should use exported pads/datums instead of guessing mirrored transforms.

An optical datum specifies `from_pad`, `toward_pad`, a signed
`offset_from_midpoint_mm`, `name`, and `source`. The unit axis is derived from the
two world pads, including rotated detectors. Positive offset goes toward the
second pad. This avoids the sign mistake seen when deriving an optical offset
from schematic or solver rotation. No stock 3D model height is silently trusted.

## Reuse provenance

The bounded grid search and clearance strategy were generalized from
`neuro_IR/tools/plan_ground_returns.py`. Explicit Gerber rendering and redundant
drill detection were generalized from `neuro_IR/tools/audit_pcb_release.py`.
Project paths, fixed board dimensions, hardcoded detector identities, residual
repair exceptions, and automatic fabrication rewriting were removed.
