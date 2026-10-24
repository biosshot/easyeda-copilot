# Offline PCB tools: validation record

Validated 2026-10-22 on Windows with Node 24.20.0, Python 3.14, NumPy 2.4.4,
and Gerbonara 1.6.3. No live EasyEDA bridge calls, editor mutations, server
replacement, or manufacturing archive rewriting were used.

## Acceptance gates

- TypeScript typecheck and production build passed.
- 3 Node integration tests and 9 Python geometry/rendering tests passed.
- Documentation link check passed.
- npm dry-run package manifest includes the worker, Python requirements, and guide.
- The saved neuro_IR project regression exercised the full geometry and Gerber ZIP.
- The finished release and source snapshot checksums remained unchanged: 19 files.

## Saved project results

The **older routing snapshot** yielded 115 ground escape candidates and 11 explicit
unresolved targets, reusing existing through vias. This is a planner regression,
not a claim about the finished board's connectivity. No routes were applied.
The adapter conservatively expanded one pad envelope by 0.00508 mm to cover a
0.00254 mm difference between duplicate native API readings. This discrepancy is
reported rather than hidden. The synthetic free-pad component was excluded from
the mechanical component count; its pads remain obstacles.

Mechanical export preserved 273 component poses, four mounting holes, and four
pad-derived detector datums. Unprovided heights remained unknown. Coordinates
were derived from the saved routing/world-pad snapshot, not asserted to be a fresh
capture of the final board.

The Gerber preview rendered 333 drill objects and identified 309 redundant via
hits. Both surface images were inspected. A mirrored SVG filter clipping problem
was fixed by rendering drill primitives without filter blending. Pixel checks
confirmed all four mounting holes on both images; underside text reads correctly.
The actual MCP worker invocation also produced SVGs, PNGs, and its JSON report.

## Repeatability and stopping rule

Run `npm run test:pcb-offline`, `npm run typecheck`, and `npm run build` from the
MCP workspace. The optional project regression is
`python scripts/check-pcb-offline-project.py C:/path/to/neuro_IR`.
It reads existing project exports and writes only to a fresh temporary directory.

Stop when these gates pass. Reopen only checks affected by new changes or a
specific failure. No automatic parameter relaxation, rerouting, or live board
validation is part of this feature's test procedure.

Limitations: normalized snapshots require explicit obstacle coverage; unsupported
geometry must be rejected or conservatively converted. Ground plans need a fresh
snapshot check before any separate application and native refill/DRC afterward.
The mechanical JSON is a handoff contract, not a generated CAD assembly or a
collision verification result. See [tool contracts](pcb-offline.md).
