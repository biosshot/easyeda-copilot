# Placement verification

Review the completed solver result before assembly, then verify the live PCB. Read diagnostics and actually view `previewImagePath` or render `previewSvgPath`. Use connectivity and actual pad geometry alongside the image.

| Check | Evidence |
|---|---|
| Completeness and preservation | Intended components are present on the correct side. Protected components, outline and approved mechanics keep their required poses. |
| Local support parts | Decoupling serves the correct supply pad with a short supply-and-return loop. Feedback, compensation, bootstrap and crystal parts connect to the right pins without detours through noisy areas. |
| Ordered paths | High-speed, RF and differential paths stay ordered through series parts. Pads face useful routing directions; both legs of a pair have room to run together. |
| Power and heat | High-current copper, switching loops, exposed pads and thermal vias have sufficient space. Compact placement still permits the required conductor width and clearance. |
| Ground access | Important ground pads can reach the planned pour. Components and planned signal routing leave usable return paths and ground passages. |
| Escape and clearance | Dense packages have plausible pad escapes and via sites. Bodies and pads do not overlap; a support part is not stranded behind the wrong side of its IC. |
| Mechanics | Connectors, controls, antenna exclusions, holes and overhangs meet the [mechanical requirements](mechanical-validation.md). |

Judge closeness from the connected pads and current loop, using device guidance. Nearby body centers alone do not prove a good connection; there is no universal distance for all support components.

After assembly, inspect affected functional areas with `inspect_component`. For a new/full placement, view an overall live `preview_pcb` and use close-ups for ambiguous areas. For an incremental change, inspect its neighborhood and preservation boundary. Reuse known connectivity.

Example separate MCP calls for an actual U1:

```text
inspect_component({ designator: "U1", radius: 5 })
preview_pcb({ layers: ["TOP", "TOP_SILKSCREEN", "BOARD_OUTLINE"], zoom: { mode: "component", designator: "U1" }, padding_mm: 3 })
```

Select the actual designator, radius and layers. Preview layers are uppercase; placement DSL uses lowercase `top`/`bottom`. If pad positions or native poses are missing, read them through [execute_js](../execution/instructions.md).

For `refineGroup`, check each named designator's resulting pose and unchanged neighbors outside the group. An accepted swap must preserve the intended pinout, orientation and mechanical access. Accepting no move can be correct.

On an already routed PCB, run `check_pcb_drc` after moving/adding components: existing copper may remain at its previous position. The placement solver does not model every existing board object.

Fix concrete defects with [iterative local corrections](instructions.md#iterative-local-corrections), then repeat the affected checks. Continue while measurable improvement justifies the next edit. Report checks, corrections and unresolved findings; distinguish blocking defects from accepted warnings. Use [recovery](../recovery.md) for a regression that cannot be repaired safely.
