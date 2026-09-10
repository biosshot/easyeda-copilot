# File Source: document structure and scoped edits

File Source is another way to inspect or change an EasyEDA document through `execute_js`. The usual Copilot tools and DSL workflows remain the starting point. Source editing is available when the task calls for it; it does not require first exhausting every API alternative. Choose it for a concrete change whose records and dependencies you understand, within the same authorized task.

The text representation is useful for finding fields, comparing snapshots and making exact edits without depending on each primitive API's return shape. Its record envelope is shared by schematics and PCBs. It is versioned, however: a stable envelope does not imply identical primitive fields across editor versions.

## Read and write

The [SYS_FileManager reference](easyeda-api/references/classes/SYS_FileManager.md) defines:

```js
const source = await eda.sys_FileManager.getDocumentSource(); // string | undefined
const accepted = await eda.sys_FileManager.setDocumentSource(nextSource); // boolean
```

Both operate on the **current document**; neither takes a document UUID. The setter receives the complete document text, not a patch. `false` means the source was rejected; `true` still requires readback and design verification. Copilot already uses these methods for checkpoints and some schematic assembly operations.

To export a source snapshot with `execute_js`, replace the UUID with the verified target:

```js
const expectedUuid = "REPLACE_WITH_CURRENT_DOCUMENT_UUID";
const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (document?.uuid !== expectedUuid) throw new Error("Wrong active document");
const source = await eda.sys_FileManager.getDocumentSource();
if (!source) throw new Error("Document source is unavailable");
if ((await eda.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== expectedUuid) {
  throw new Error("Active document changed");
}
return new Blob([source], { type: "text/plain;charset=utf-8" });
```

The returned `artifacts[].path` is a local text file on the MCP host. Inspect it with local tools instead of sending the whole source into model context. `execute_js({file_path: ...})` expects a **JavaScript script**, not this source file. Supply source text to `setDocumentSource` from that script. See the [execution contract](instructions.md#results-and-local-artifacts) for checkpoints, artifacts and size limits.

## Record envelope

These examples describe the v3 File Source snapshots supplied by EasyEDA **3.2.149.88089769**. The [upstream format index](easyeda-api/format/index.md) explains the wider format, including project logs and older versions.

Each physical line is a record: an outer JSON object, `||`, an inner JSON value, and usually a final `|`. This is not a single JSON document or ordinary JSON Lines. Strings can contain escaped newlines or literal pipes; parse the two JSON parts rather than replacing text globally. The final record in the supplied snapshots has no trailing `|`.

```text
{"type":"DOCHEAD"}||{"docType":"PCB","uuid":"pcb-uuid","client":"client-id","editVersion":"3.2.149.88089769"}|
{"type":"LINE","id":"track-id","ticket":199}||{"netName":"VBUS_SENSE","layerId":1,"startX":-249.2165,"startY":174.248,"endX":-249.2165,"endY":208.6969,"width":9.8425,"locked":false}
```

| Part | Meaning |
|---|---|
| `DOCHEAD` | Starts a document section. `docType` distinguishes `SCH_PAGE`, `PCB`, `SYMBOL`, `FOOTPRINT`, etc.; `uuid` identifies the document. |
| Header metadata | `client` participates in change ordering; `version` and `updateTime` are export/document metadata. `editVersion` identifies the editor version. Retain the header from the latest snapshot when making a local edit. |
| Outer `type` and `id` | Record identity within a document section. Some singleton records omit `id`. A record ID can also be an encoded composite key, not just a primitive UUID. |
| Outer `ticket` | Logical change counter, not a coordinate or drawing order. Preserve unrelated tickets; the edit example advances only the changed record's ticket above the snapshot maximum. |
| Inner JSON | The record's actual properties. Preserve unknown keys, value types, `null`, and absent fields. |
| References | Fields such as `parentId`, `lineGroup`, and composite IDs associate records. Adjacency in the file does not establish ownership. |

For example, a PCB pad assignment can use `id: "[\"PAD_NET\",\"component-id\",\"2\",\"e15\"]"`. That is a JSON **string** containing a composite key: record type, component ID, pad number and footprint-local pad ID. Decode it for inspection when needed, but retain its exact identity when editing the assignment.

On live EasyEDA 3.2.149, two consecutive `getDocumentSource()` calls regenerated `DOCHEAD.client`, `version` and `updateTime` while every other record stayed identical. Whole-string equality therefore does not establish whether the board changed. The example compares all record content except those three header fields and keeps the latest exported header. This exception applies to snapshot comparison, not to interpreting client/ticket ordering in a project log.

The project log can contain several document sections, repeated identities with different tickets, and deletion records with an empty-string payload. A fresh File Source snapshot and a project history are different inputs. The example below handles one snapshot and rejects repeated identities or multiple headers; use the [log rules](easyeda-api/format/index.md#eventual-consistency) before processing history. Do not silently keep the first or last duplicate.

## What the records contain

| Area | Records in the supplied snapshots | Interpretation |
|---|---|---|
| Both | `CANVAS` | View/grid/origin settings. PCB `unit: "mm"` controls display; it does not convert all stored coordinates to millimeters. |
| Both | `COMPONENT`, `ATTR` | An instance and its attributes. `ATTR.parentId` identifies the owner; `key`/`value` can hold `Designator`, `Symbol`, `Footprint`, `Device`, a displayed value or other metadata. Attributes can precede their component. |
| Schematic | `WIRE`, `LINE`, `ATTR` | In these snapshots, `WIRE` is the group, `LINE.lineGroup` links its segments, and `ATTR` with `key: "NET"` supplies the group's net name. An arbitrary graphical `LINE` is not automatically an electrical wire. |
| Schematic | `TEXT` | Notes, headings and other text; content is in `value`, with position and styling alongside it. |
| PCB | `LAYER`, `LAYER_PHYS`, `ACTIVE_LAYER` | Layer identities, visibility/physical properties and active layer. Resolve `layerId` through the document's `LAYER` records. Source names such as `TOP_SILK` differ from API/DSL names. |
| PCB | `NET`, `PAD_NET` | Net definitions and component pad assignments. The supplied PCB has pad assignments without top-level `PAD` geometry: its footprint definitions supply component pads. |
| PCB | `LINE`, `VIA`, `POLY` | Copper/graphic segments, vias and paths. Typical fields include `netName`, `layerId`, endpoint coordinates, `width`, via diameters and `path`. A `POLY` on the outline layer defines board geometry. |
| PCB | `POUR`, `POURED` | Pour definition versus generated pour result. Editing an outline or nearby copper requires rebuilding the affected pour and checking it; retained `POURED` data is not proof that the fill is current. |
| PCB | `RULE_TEMPLATE`, `RULE`, `RULE_SELECTOR` | Rule definitions and their assignment. A rule edit can affect more than the nearby geometry. |
| PCB | `PRIMITIVE`, `PREFERENCE`, `SILK_OPTS`, `PANELIZE` | Primitive display/configuration, editor preferences, silkscreen and panel settings. A record named `PRIMITIVE` is not an individual track or pad. |

Component instances reference symbol/footprint definitions elsewhere in the project or libraries. One page's source is not a self-contained project export. Preserve those references and instance overrides; copying a component record alone does not copy its library definition or all dependent records.

For field details, read only the relevant reference: [schematic components](easyeda-api/format/schematic/component.md), [schematic wires](easyeda-api/format/schematic/wire.md), [PCB components and pad assignments](easyeda-api/format/pcb/component.md), [PCB shapes and pours](easyeda-api/format/pcb/shape.md), [pads/vias](easyeda-api/format/pcb/pad_via.md), or [rules](easyeda-api/format/pcb/rule.md).

## Field and coordinate differences

Use the current snapshot to establish the actual field shape. For example, the supplied files use component `x`/`y`, although some upstream examples use `positionX`/`positionY`. PCB layers use `use`/`show`/`locked` booleans instead of the older packed `status`; pad mappings use composite IDs; schematic wires use grouped `LINE` records instead of the documented `dots` example. Preserve the observed representation when editing it.

PCB track/component coordinates and track widths in these samples use native **mil** (`1 mil = 0.0254 mm`); schematic geometry uses **0.01 inch** units. The example track width `9.8425` is approximately `0.25 mm`. Do not apply a blanket conversion to nested rule, footprint or generated-fill data. Check the exact field and a known reference dimension.

Source coordinates can differ from API coordinates in origin, Y direction and transformations. Copilot's schematic source adapter explicitly compares a source primitive with its native counterpart to determine the Y sign. For geometric edits, establish the correspondence from known objects; do not copy an API pose into source by assumption. PCB components use `angle` here, schematic components use `rotation` and `isMirror`. Attribute positions may need a corresponding transform when moving their parent. Moving components does not guarantee that existing wires or tracks follow.

## Apply a scoped change

1. **Read a fresh snapshot.** Retain its exact document UUID/type and the checkpoint associated with the eventual write. Use pasted or older source as a reference, then locate the intended records in the current document.
2. **Resolve the affected records.** Match exact `type`/`id`; resolve a designator through its `ATTR.parentId` when necessary. Include related attributes, wire groups, pad assignments or derived data when the change affects them.
3. **Prepare the edit.** Change only the intended fields, preserve other records verbatim, and inspect the resulting diff. Check old values before replacing them. For additions, use fresh IDs/tickets and update the complete reference set; for deletions, account for dependent records and the distinction between snapshot removal and log deletion.
4. **Apply once.** Confirm the current document and baseline still match, then await `setDocumentSource(nextSource)` and check its result. Passing the complete text is the setter's transport format; the logical change can still be one field. This does not authorize replacing unrelated design content.
5. **Read back and verify.** Reacquire source and native objects. The editor may normalize records, ordering or tickets, so verify changed fields and relevant preserved objects rather than requiring byte-identical output. Follow [schematic](../schematic/verification.md), [placement](../pcb-layout/verification.md) or [routing](../pcb-routing/verification.md) checks, including current native connectivity/DRC after electrical edits and refill after affected copper edits.

The [single-record edit example](examples/edit-file-source.js) is a complete `execute_js` script for replacing existing scalar fields, such as a `TEXT.value`. Copy it to your working directory and fill in the target and expected old values. `apply: false` returns the proposed before/after record without writing; set `apply: true` for the prepared change within the user's scope. This is a preparation step, not an additional user-approval requirement.

The example rereads the baseline before writing, but source comparison and the setter are not an atomic lock against UI edits. After a timeout, follow the [unknown-outcome procedure](instructions.md#errors-and-timeout); do not immediately repeat a source write. Use `sync_current_document` only if readback remains stale, and follow [recovery](../recovery.md) when an applied result needs repair or restoration.
