# PCB DRC Rules Editing

Use this doc when editing a JSON file exported by `export_pcb_drc_rules`.

Workflow:

1. Call `export_pcb_drc_rules`.
2. Edit the returned JSON file.
3. Call `apply_pcb_drc_rules` with the edited file path.
4. Call `check_pcb_drc`.

The target PCB document must be open in EasyEDA.

## Core Model

The file has two top-level sections:

```json
{
  "ruleConfiguration": {},
  "netRules": []
}
```

- `ruleConfiguration`: library of named rule presets.
- `netRules`: assignments that attach those preset names to nets and groups.

Most changes are:

1. Add or edit a preset in `ruleConfiguration`.
2. Assign that preset name in `netRules`.

Distances are normally millimeters when the preset has `"unit": "mm"`. Keep values in mm.

Preserve unknown fields. Prefer copying an existing similar preset instead of inventing a new shape.

## Adding A New Preset

New presets are added as siblings inside a rule family.

Correct Track preset placement:

```json
{
  "ruleConfiguration": {
    "Physics": {
      "Track": {
        "copperThickness1oz": {},
        "powerTrack": {
          "editName": "powerTrack",
          "unit": "mm",
          "isSetDefault": false,
          "form": {
            "status": 1,
            "data": {
              "1": {
                "minValue": 0.2,
                "defaultValue": 0.3,
                "maxValue": 2.54
              }
            }
          }
        }
      }
    }
  }
}
```

Wrong: do not put preset names inside `form.data`, `tables`, or nested `*.data` maps:

```json
{
  "form": {
    "data": {
      "1": {},
      "powerTrack": {}
    }
  }
}
```

`data` and `tables` keys are layer/table indices such as `"1"` and `"2"`, not preset names. `apply_pcb_drc_rules` rejects preset-name keys inside these maps.

## Preset Locations

Use this map to find where a `netRules` assignment points:

| `netRules` field | Preset location |
| --- | --- |
| `Safe Spacing` | `ruleConfiguration.Spacing["Safe Spacing"]` |
| `Copper Safe Spacing` | `ruleConfiguration.Spacing["Safe Spacing"]` |
| `Plane Safe Spacing` | `ruleConfiguration.Spacing["Safe Spacing"]` |
| `Creepage Distance` | `ruleConfiguration.Spacing["Creepage Distance"]` |
| `Track` | `ruleConfiguration.Physics.Track` |
| `Net Length Range` | `ruleConfiguration.Physics["Net Length Range"]` |
| `Net Length Tolerance` | `ruleConfiguration.Physics["Net Length Tolerance"]` |
| `Differential Pair` | `ruleConfiguration.Physics["Differential Pair"]` |
| `Blind/Buried Via` | `ruleConfiguration.Physics["Blind/Buried Via"]` |
| `Via Size` | `ruleConfiguration.Physics["Via Size"]` |
| `Plane Zone` | `ruleConfiguration.Plane["Plane Zone"]` |
| `Copper Zone` | `ruleConfiguration.Plane["Copper Zone"]` |
| `Solder Mask Expansion` | `ruleConfiguration.Expansion["Solder Mask Expansion"]` |
| `Paste Mask Expansion` | `ruleConfiguration.Expansion["Paste Mask Expansion"]` |

`"default"` means EasyEDA default preset. `null` usually means no override.

## Preset Shape

Most presets look like this:

```json
{
  "editName": "presetName",
  "unit": "mm",
  "isSetDefault": false,
  "form": {}
}
```

Rules:

- The object key and `editName` should normally match.
- Keep `unit`, `status`, `form`, `table`, `tables`, `data`, and unknown fields unless you intentionally edit them.
- When creating a new preset, copy the nearest existing preset in the same family and change only its name and values.

## Important Preset Fields

### Track

Path: `ruleConfiguration.Physics.Track`

```json
{
  "form": {
    "data": {
      "1": {
        "minValue": 0.127,
        "defaultValue": 0.254,
        "maxValue": 2.54
      }
    }
  }
}
```

- `minValue`: minimum allowed track width.
- `defaultValue`: routing/default width.
- `maxValue`: maximum allowed width.

Assign with `"Track": "presetName"`.

### Via Size

Path: `ruleConfiguration.Physics["Via Size"]`

Important fields:

- `viaOuterdiameterMin`
- `viaOuterdiameterMax`
- `viaOuterdiameterDefault`
- `viaInnerdiameterMin`
- `viaInnerdiameterMax`
- `viaInnerdiameterDefault`

Assign with `"Via Size": "presetName"`.

### Safe Spacing

Path: `ruleConfiguration.Spacing["Safe Spacing"]`

This is a clearance matrix:

```json
{
  "column": ["Track", "SMD Pad", "TH Pad"],
  "row": ["Track", "SMD Pad", "TH Pad", "Hole"],
  "tables": {
    "1": {
      "content": [[0.152], [0.152, 0.152]]
    }
  }
}
```

Use this for clearance/spacing/isolation changes. The `content` matrix is EasyEDA-specific; copy an existing preset and edit known values rather than rebuilding the whole matrix.

Assign with `"Safe Spacing": "presetName"`.

### Net Length

Paths:

- `ruleConfiguration.Physics["Net Length Range"]`
- `ruleConfiguration.Physics["Net Length Tolerance"]`

Important fields:

- `netLengthMin`
- `netLengthMax`
- `netLengthTolerance`

Assign with `"Net Length Range": "presetName"` and/or `"Net Length Tolerance": "presetName"`.

### Differential Pair Preset

Path: `ruleConfiguration.Physics["Differential Pair"]`

Important fields:

- `strokeWidthTables`: width for each trace in the pair.
- `diffPairSpacingTables`: gap between pair traces.
- `differentailPairLenTolerMax`: allowed length mismatch. Keep the exported misspelling.

Assign with `"Differential Pair": "presetName"`.

### Plane And Expansion

Common plane fields:

- `lineClearance`
- `lineWidth`
- `lineAngle`
- `connectMode`
- `trackConnectMode`

Common mask/paste fields:

- `padToplayerExpansion`
- `padBottomlayerExpansion`
- `viaToplayerExpansion`
- `viaBottomlayerExpansion`
- `testPointToplayerExpansion`
- `testPointBottomlayerExpansion`

Edit these only when the user asks for plane connection, copper pour, solder mask, or paste mask changes.

## Net Rule Shape

A single net rule looks like:

```json
{
  "type": "net",
  "name": "GND",
  "Safe Spacing": "default",
  "Copper Safe Spacing": null,
  "Plane Safe Spacing": null,
  "Track": "default",
  "Net Length Range": "default",
  "Net Length Tolerance": null,
  "Blind/Buried Via": "default",
  "Via Size": "default",
  "Plane Zone": "default",
  "Copper Zone": "default",
  "Solder Mask Expansion": "default",
  "Paste Mask Expansion": "default",
  "Creepage Distance": "default",
  "targetNet": null
}
```

To change a net, change the preset name in the relevant field. Keep net names exactly as exported, including `$`, `+`, `/`, and case.

## Net Classes

Use `netClass` to group nets such as power rails, SPI/QSPI, GPIO, or high-current nets.

```json
{
  "type": "netClass",
  "name": "power",
  "Safe Spacing": "powerClearance",
  "Track": "powerTrack",
  "Via Size": "powerVia",
  "sub": [
    {
      "type": "net",
      "name": "+3V3",
      "Safe Spacing": "powerClearance",
      "Track": "powerTrack",
      "Via Size": "powerVia"
    }
  ]
}
```

Rules:

- `sub` contains ordinary `type: "net"` objects.
- Move existing net objects into `sub` when grouping.
- Avoid duplicate top-level entries for nets that are inside `sub`.
- Put important assignments on both the parent and each child net when possible.

## Differential Pairs

MCP embeds EasyEDA differential pairs into `netRules` as `type: "differentialPair"` entries.

```json
{
  "type": "differentialPair",
  "name": "DP_USB",
  "positiveNet": "USB_DP",
  "negativeNet": "USB_DM",
  "Differential Pair": "usbDiff",
  "sub": [
    {
      "type": "net",
      "name": "USB_DP",
      "Track": "usbTrack",
      "Differential Pair": "usbDiff"
    },
    {
      "type": "net",
      "name": "USB_DM",
      "Track": "usbTrack",
      "Differential Pair": "usbDiff"
    }
  ]
}
```

Rules:

- `sub` contains ordinary net rule objects, same style as `netClass.sub`.
- `positiveNet` and `negativeNet` must exactly match two `sub[].name` values.
- To change diff-pair rules, update `"Differential Pair"` on the parent and both child nets.
- To change diff-pair track width, update `"Track"` on both child nets.
- To create a pair, move two existing net objects into a new `differentialPair.sub`.
- To delete only the pair relationship, remove the `differentialPair` wrapper and move its `sub` nets back to top-level `netRules`.

## Equal Length Groups

Treat `type: "equalLengthGroup"` as native EasyEDA JSON:

- Preserve unknown fields.
- Keep child nets as ordinary net objects.
- Use `Net Length Range` and `Net Length Tolerance` assignments for length behavior.

If the structure is unfamiliar, edit existing fields instead of inventing new ones.

## Common Tasks

### Make A Net Wider

1. Copy or edit a preset in `ruleConfiguration.Physics.Track`.
2. Set `minValue`, `defaultValue`, and `maxValue`.
3. Assign it with `"Track": "presetName"` on the target net, net class, or diff-pair child nets.

### Increase Clearance

1. Copy or edit a preset in `ruleConfiguration.Spacing["Safe Spacing"]`.
2. Increase known matrix values.
3. Assign it with `"Safe Spacing": "presetName"` on the target net or group.

### Configure USB Differential Pair

1. Create/edit `ruleConfiguration.Physics["Differential Pair"].usbDiff`.
2. Set `strokeWidthTables`, `diffPairSpacingTables`, and `differentailPairLenTolerMax`.
3. Create/edit a `differentialPair` entry for `USB_DP` and `USB_DM`.
4. Set `"Differential Pair": "usbDiff"` on parent and both child nets.
5. Set `"Track": "usbTrack"` on both child nets if a separate track preset is needed.

### Length Match A Bus

1. Create/edit `Net Length Range` and/or `Net Length Tolerance` presets.
2. Assign them to every bus net, net class child, or equal-length group entry.

## Safety Rules

- Keep valid JSON.
- Preserve unknown fields.
- Copy existing presets instead of inventing structure.
- Keep preset object keys and `editName` aligned.
- Do not rename a preset without updating all `netRules` references.
- Do not duplicate a net at top-level and inside `netClass.sub` or `differentialPair.sub`.
- For differential pairs, keep `positiveNet`/`negativeNet` synchronized with `sub[].name`.
- After applying, run `check_pcb_drc`.
