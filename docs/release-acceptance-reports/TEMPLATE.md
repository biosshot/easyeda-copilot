# EasyEDA Copilot release acceptance report

- Candidate version and commit
- Run date and tester
- Candidate `.eext` and locally generated skill versions, checksums, and sources
- Skill build command, distribution, platform, and `build-info.json` evidence
- Backend and router versions
- Editor version, OS, Node version, and launcher
- Previous report or regression issues, if applicable
- Decision (`Go` or `No-Go`)
- Open blockers

## Candidate checks

| Check | Status | Evidence |
| --- | --- | --- |
| Release dependency and version checks | | |
| Integration CI and platform matrix | | |
| Local skill build and matching `.eext` install | | |
| Generated CLI start, status, tool discovery, and stop | | |
| Shipped helper and package checks | | |

## Mode and fixture evidence

| Item | Full Online | Half Offline |
| --- | --- | --- |
| User confirmed mode at | | |
| Observed editor mode and instance | | |
| Project, schematic, BOARD, and PCB UUIDs | | |
| Library sources and setup | | |
| Tool inventory link and count | | |

Link the fixture specification with exact part IDs, unit identifiers, expected pin and pad nets, and board constraints.

## Workflow results

Use `Pass`, `Fail`, `Blocked`, or `N/A`. Record evidence or the reason next to each status. Add rows for individual checklist cases as needed.

| Check | Full Online | Half Offline |
| --- | --- | --- |
| Project and document lifecycle | | |
| Schematic creation, connectivity, and persistence | | |
| Same-page multi-part assembly, annotation, beautification, and reopen | | |
| Schematic-to-PCB import and repeat import | | |
| User review of the minimal PCB changes after a scoped schematic edit | | |
| Placement of the newly imported footprint on the routed PCB | | |
| Multi-part footprint count and pad-to-net mapping | | |
| Placement validation, preview, and application | | |
| Routing, filled copper, connectivity, and native DRC | | |
| Saved PCB readback and scoped routing preservation | | |
| Checkpoints, execution, and operation recovery | | |
| Live Node.js SDK | | |
| Live Python SDK | | |
| Invalid inputs, wrong target, and reconnect | | |
| Release-specific regressions | | |

For repeat import, link the before/after PCB readbacks and record the schematic edit, expected and observed PCB changes, preservation checks, and the user's verdict for each mode.

## Tool-by-tool coverage

Add a row for each candidate tool. Include the input or workflow case, observed result, and evidence for each mode.

| Tool | Case and expected result | Full Online status and evidence | Half Offline status and evidence |
| --- | --- | --- | --- |
| | | | |

## Defects and retests

| Issue | Build and mode | Reproduction | Expected and observed | Evidence | Retest result |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
