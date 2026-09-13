# PCB API units and compatibility checks

The proxy preserves native values. It never normalizes coordinates automatically.
**EasyEDA API fields can change between versions. The observations below require a
basic check against known geometry on the connected editor before writes.** A
conversion function proves arithmetic, not the unit used by an API field.

Observed on the controller PCB on 2026-09-13, with declarations generated from
`@jlceda/pro-api-types 0.2.30`. The declaration package version is **not** the running
editor version. The follow-up live check reported editor **3.2.149.88089769** through
`sys_Environment.getEditorCurrentVersion()`. Record it when reproducing a check;
this is an observed compatibility record, not a guarantee for other fields/versions.

| API data | Observed mm per unit | Evidence / verification status |
|---|---|---|
| Component/pad X and Y; line/arc endpoints; via X/Y | 0.0254 (mil) | Adapter and live board readback |
| Track width, via diameter/drill, pad width/height | 0.0254 | Adapter and live read/create/readback |
| `IPCB_PrimitivePour.getState_ComplexPolygon()` source outlines | 0.0254 | Native outline convention; check separately from filled output |
| `IPCB_PrimitivePoured.getState_PourFills()[i].path.getSource()` or `getSourceStrictComplex()` coordinates | 0.254 (10 mil) | Adapter and live filled-geometry alignment |
| `getState_PourFills()[i].lineWidth` | 0.254 | Adapter and live thermal-spoke alignment |
| `IPCB_PrimitiveFill.getState_ComplexPolygon()` sources | 0.0254 | Adapter; verify a known explicit fill on the target editor |
| Pad `getState_HoleOffsetX/Y()` | 0.254 in current adapter | **Not independently verified with a nonzero offset** |
| Pad hole diameter/slot dimensions | 0.0254 in current adapter | Verify a known hole/slot separately from offsets |
| Raw native DRC positions and distances | Unspecified here | Do not assume mil or mm; resolve reported primitive IDs |
| `get_current_pcb`, inspection summaries, routing DSL | mm | Copilot-normalized interface, not raw `eda.*` |

This table describes specific fields. A common class such as `IPCB_ComplexPolygon`
does not imply one scale for every producer. Polygon arrays also contain command
names, angles, flags and counts: **never multiply every numeric array item**.
Arc angles and rotations stay in degrees. Hole offsets deserve their own check.

## Helpers shipped in both SDKs

Python:

```python
from easyeda_copilot.units import (
    mil_to_mm, mm_to_mil, convert_length, assert_unit_scale, OBSERVED_PCB_UNITS,
)

width_mm = mil_to_mm(native_width)
native_via_diameter = mm_to_mil(0.6)
# Explicit input scale; this does not select/verify an editor profile:
poured_x_mm = convert_length(poured_x, OBSERVED_PCB_UNITS['poured_mm_per_unit'])
```

Node.js (replace the installation path):

```javascript
import { milToMm, mmToMil, convertLength, assertUnitScale, OBSERVED_PCB_UNITS }
  from 'D:/path/to/mcp/dist/lib/node/index.mjs';
const widthMm = milToMm(nativeWidth);
const viaDiameter = mmToMil(0.6);
const pouredXmm = convertLength(pouredX, OBSERVED_PCB_UNITS.pouredMmPerUnit);
```

Helpers reject nonfinite values and nonpositive unit scales, do not round and do
not flip axes or change the origin. They work locally without a connection.

## Basic check before using a scale

1. Identify the exact document and a dimension independently known from a footprint,
   drawing or the editor's measurement. Choose a nonzero dimension large enough to
   distinguish a factor-of-ten error.
2. Read the relevant field. Compare dimensions, not absolute coordinates; canvas
   origin offsets can make absolute-coordinate comparisons misleading.
3. Check the specific producer: for poured geometry, compare a known boundary or
   hole on that fill with its native object. Check X and Y alignment as well as size.
   A pour's bounding box may differ from the board because of setbacks and keepouts.
4. Use `assert_unit_scale(native_distance, reference_mm, mm_per_unit, tolerance_mm)`
   or Node `assertUnitScale(...)` with a tolerance chosen for measurement/rounding.
   Do not derive the reference by applying the same conversion to the same data.
5. Record editor/declaration versions, document, object/field, reference, observed
   value, scale, tolerance and outcome. Reject a mismatch; do not guess another scale
   and proceed with mutations.

A changed editor version, an unknown field, or a different producer requires a new
check. A successful check of one field does not certify the entire API.

Native PCB coordinates preserve the native XY frame. Routing/export coordinates
can use another origin or Y direction. Unit conversion does not establish that
frame transformation. Rebuild pours before claiming fill freshness, and finish
copper changes with native DRC and readback.

See [Shapely examples](shapely-geometry.md), [SDK usage](local-sdk.md), and the
[official poured API](https://prodocs.easyeda.com/en/api/reference/pro-api.pcb_primitivepoured.html).
