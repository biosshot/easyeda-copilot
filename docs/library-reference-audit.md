# Library reference audit — 2026-09-22

## Native identity evidence

Test project: `6c6af30f86be44e0b61046a739a35c48`, schematic page `3ebe61fc342f31c0`.

EasyEDA 3.2.149 retains the original reference in the project archive. DEVICE sections contain a `DOCHEAD.uuid` with the project-local device ID and a `META.source` with `originalDeviceUuid|libraryUuid`. SYMBOL and FOOTPRINT sections have their own independent source references and must not be mistaken for devices.

Verified mappings:

| Device | Local device UUID | Original device UUID | Library UUID |
| --- | --- | --- | --- |
| PCA9685 | a9f4d7ddbdc45ac8 | 32d67bb993d443e996e7aab9f54dbcf6 | 7747dd3052f744008bdef710dec476cd |
| SCR0402F10K | 20d9ba71ba4887fc | 905e86004e444423af231dd5329b7f64 | 0819f05c4eef4c71ace90d822a990e87 |

`getState_Component()` returns the local DEVICE UUID, not the symbol UUID. Public HTTP endpoints do not resolve those local IDs. `lib_Device.get(localUuid, ownerLibrary)` returned undefined; using the project library (`getProjectLibraryUuid()` returns `project`) failed with an internal `parent_tag` error in the installed editor. `getDeviceFileByDeviceUuid([...], 'project')` returned undefined. `sys_FileManager.getProjectFile()` successfully returned a ZIP containing `.epru` source sections with the original IDs.

The earlier claim that EasyEDA loses the original mapping was incorrect. The original mapping is available in its project export even though the tested direct getters do not expose it.

## Resulting implementation

- Both LCSC and public device placements retain one `EasyEDA Copilot Part Ref` JSON property.
- Readback prefers a resolved original reference. For unmarked LCSC components the existing supplier-code lookup runs first. Only remaining unresolved local IDs trigger a fresh project export, with at most 20 seconds of waiting. Missing APIs, export failures, unsupported archives and timeouts leave recovery empty; the component remains in readback with `part_uuid: null`. A pending export is not duplicated after timeout.
- Existing LCSC supplier-code lookup remains a fallback. Unresolved local IDs are returned as missing references instead of being sent to the backend as public device IDs.
- This is identity extraction from the open editor. Component search and symbol/footprint downloads still use the backend.

## Regressions and inconsistencies corrected

- Replacement now writes the reference, just like initial placement and source assembly.
- Multipart identity compares device UUID plus library rather than JavaScript object identity.
- Template reuse requires matching device/library as well as any requested subpart. A coincident subpart name alone cannot select a different device.
- An explicit library no longer falls through to unrelated libraries during placement.
- System library UUID and `lcsc` share the same comparison/cache identity.
- A library-qualified provided PCB footprint overrides an ambiguous legacy UUID entry.
- Legacy UI component placement and image lookup accept object references; special-symbol filtering uses the extracted UUID.
- Readback no longer lets a local UUID override the original reference or bypass supplier fallback through `typeof null === 'object'`.

## Validation

- Backend full check: 202 tests passed, typecheck/build passed, including the public API regression test for footprint override precedence.
- Extension: 116 tests passed; changed editor TypeScript files passed ESLint; production extension build/package passed. The repository-wide ESLint command still reports eight pre-existing errors in unchanged checkpoint, MCP client and SSE files.
- MCP full check passed, including CLI, local SDK, lifecycle and native preview checks.
- Executed the new readback code in the connected editor via a temporary bundled script. U1, R1 and R2 recovered their original references with pins and nets preserved, without any Copilot reference properties on these existing components.
- Fed that live readback to the actual backend: all three footprints resolved, including the public PCA9685 TSSOP28 with 28 pads.
- After installing the packaged extension, completed a live schematic-to-PCB test with the public PCA9685 and two LCSC pull-up resistors. Placement and routing completed on the generated 20 x 15 mm board; final native DRC returned no errors. The routed board used 0.2 mm tracks for `I2C_SDA`, `I2C_SCL` and `+3V3`, plus top/bottom GND zones with 18 stitching vias.

## Remaining boundaries

- The native-source fallback is verified for v3 `.epru` project exports. It reads the project archive only when unresolved local IDs occur, so large legacy projects may incur export overhead.
- Locally authored devices with no original source cannot acquire a public identity from this mapping. Modified local symbols/footprints are not guaranteed to match the original library geometry.
- The reference property is editable metadata and is not a guarantee against manual tampering or a third-party replacement that preserves stale custom properties.
- Full standalone extension `tsc` still reports errors in unchanged annotation, preview, schematic-group and MCP adapter files, plus API declaration conflicts. The object-reference multipart error discovered in this audit was fixed. The build command uses esbuild and must not be presented as a clean full TypeScript check.
- The live test validates the current EasyEDA Pro editor build and the tested public-library component. Other editor versions and library record variants still rely on the guarded fallbacks described above.
