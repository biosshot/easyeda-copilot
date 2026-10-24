# Populated PCB handoff to mechanical CAD and rendering

Use `get_current_project_info` to identify the intended PCB, open it, then call
`export_populated_pcb_3d` with its `document_uuid` and `format: step` or `obj`.
STEP is for mechanical CAD; OBJ returns a ZIP with geometry and its material library
for renderers. Preserve both when needed. Export native component models before
considering placement-derived approximations.

The tool uses the existing managed operation/checkpoint/binary-artifact infrastructure.
It creates a checkpoint, but never edits placement, copper, library bindings or the design.
Outputs receive `.step` or `.zip` extensions. Copy returned artifacts into the project's
presentation inputs directory; record their source document and hashes.

Use `wait_operation` on the returned operation ID when still running. The native export
can outlive a timeout. Do not restart it blindly. One representative export and a check
of orientation/model presence are sufficient; rendering does not require rerunning DRC/FEM.

`auto_generate_models` defaults to true and permits EasyEDA's height-based fallback.
STEP can include only STEP-backed component models; no export guarantees complete vendor
model coverage. Preserve this distinction in handoff notes. Verify board origin, units,
top face and connector orientation before applying the assembly transform; do not assume
STEP and OBJ exporters use identical Z origins.

Focused synthetic tests: `node --import tsx --test tests/pcb-3d-export.test.ts`.
The underlying native STEP and OBJ calls were exercised on a real populated board; tests
of the wrapper never touch a finished PCB.
