# Silkscreen and board geometry

Free-form silkscreen — connector pinouts, board name, revision, logos — plus the
geometry queries needed to place it without hitting anything.

Reference designators are placed by `make_pcb_layout` via `silkscreen.designators()`
and are not affected by these tools.

## Never guess coordinates

`get_current_pcb` lists a component's pads by name and net, but **without positions**.
Use `get_pcb_component_geometry` instead: it returns the bounding box and the exact
coordinate of every pad, in mm.

Two mistakes this prevents, both observed on a real board:

- **Pin order is not guessable.** On a `HDR-TH_4P-P2.54` header, pad 1 sat at the
  *right* end and the numbering ran leftwards. A 50/50 guess would have labelled
  `GND` as `5V` — worse than no labels at all.
- **The bounding box is much larger than the body.** A USB-C receptacle's mounting
  tabs reached 4.93 mm from its centre while the body ended earlier. A label placed
  just outside the body landed on top of the tabs.

For a free spot, prefer `find_pcb_free_space` over arithmetic: it uses the editor's
own bounding boxes, checks all four corners against the board outline, and treats
through-hole parts as blocking both sides.

## Placing text

`add_pcb_silkscreen_text` takes items in mm. Keep height at or above 0.8 mm and
stroke at or above 0.15 mm — below that most fabs drop the text.

Matching for updates is by **text *and* position**. The same wording may therefore
appear in several places — a `GND` label at two different connectors, `5V` at both an
indicator and an output pin. Re-running an identical call updates in place instead of
stacking duplicates.

To move a label, delete it and add it at the new spot. Adding the same text at a new
position creates a second label.

## Placing a logo

`add_pcb_silkscreen_image` reads an SVG file from disk. Supported elements: `path`,
`rect`, `circle`, `ellipse`, `polygon`, `polyline`, including `transform` on the
shapes and on enclosing groups. Convert text to paths first. Content inside `defs`,
`clipPath`, `mask` and `symbol` is ignored, as in any renderer.

Curves and arcs are flattened automatically. Nested subpaths become holes, so an icon
with a cut-out renders correctly rather than as a solid blob.

Aspect ratio is always preserved: pass `width` or `height`, not both.

## Do not mirror the bottom layer

`mirror` defaults to off on both layers, and that is almost always correct: EasyEDA
already flips the bottom layer when rendering, so mirroring here flips it back and the
artwork comes out reversed on the board. Verified visually on a real board.

## Verifying

`preview_pcb` renders silkscreen text and images, so placement can be checked from the
image without opening the GUI.

For images, `get_pcb_silkscreen_images` reports the real `bbox`. Trust it over the
`x`/`y` fields of the primitive: those hold an anchor that does not correspond to where
the artwork is drawn. `add_pcb_silkscreen_image` measures the result and compensates
automatically; a non-zero `correction` in its report is normal, not an error.

## Opening the right document

All of these act on the currently opened PCB. The active document changes whenever the
user clicks around the GUI — opening the 3D view is enough. The bridge re-opens the
document and retries once when the project contains exactly one PCB; with several
boards it fails instead of guessing, and `open_document` must be called explicitly.
