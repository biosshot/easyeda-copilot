# Local SDK verification — 2026-09-13

Audit of the SDK introduced in commit `47506f9`, on branch `feat/local-eda-sdk`. The audit included source review, regression tests that reproduced faults, production-broker integration, isolated package installation, and an open EasyEDA test PCB. Corrections preserve the existing extension and ordinary `execute_js` tool.

## Corrected behavior

| Area | Correction |
|---|---|
| Nested remote calls | Recheck the active document immediately before and after native method execution, including methods used as arguments to another call or `eval`. A document-changing dependency cannot run the outer write on the new document. |
| Argument failures | Evaluate nested argument expressions in order; an error prevents subsequent argument mutations. |
| Serialization | Normalize sparse array holes to `undefined`, retain negative zero, and leave accessor objects remote so serializing them does not execute getters twice. |
| Exceptions | Unprintable native exceptions retain the successful batch prefix and failed index. |
| Node lifecycle | Concurrent `close()` calls share one shutdown. Shutdown drains accepted batches that are still encoding binary arguments. Deferred property expressions have rejection handlers. |
| Python lifecycle | Concurrent close is idempotent; cancelling an RPC terminates its local transport worker without replaying or cancelling already-dispatched editor code. Cancelling one waiter does not cancel another waiter on the same expression. |
| Python local errors | Reject invalid local JSON before dispatch, without closing a usable session or marking a never-sent request as an unknown execution outcome. Preserve the checkpoint attached to worker errors. |
| Python proxy use | `UNDEFINED` is false, returned object handles are true, and a lazy result cannot silently act as a boolean. Iterating an unawaited proxy raises an error instead of constructing an unbounded sequence iterator. Integer property names are sent as strings. |
| Script inputs | Validate scripts, absolute regular files, UTF-8, size limits and timer overflow. File inputs use a dictionary without inherited properties, including for names such as `constructor` and `__proto__`. |
| Existing checkpoint test | Load the test bundle as ESM so its dependencies can use `import.meta.url`; the assertions and checkpoint implementation are unchanged. |

## Automated coverage

`npm run test:sdk --workspace=mcp` runs two suites:

- **24 SDK integration groups:** native objects and receivers, lazy expressions and at-most-once execution, batching and failure prefixes, file inputs, validation, generated TypeScript signatures/overloads/enums, session isolation/release/expiry/reload, shutdown races, document guards, cancellation, numeric edge cases, unknown classes and cyclic returned graphs. Binary checks include every supported typed-array class, byte offsets, empty values, base64 padding/chunk boundaries, File metadata and a Blob exceeding 2 MiB. Nested-data checks include 200 deterministic randomized records. Python runs against the same broker and executor, including its actual Node worker.
- **8 production-broker groups:** two editors with explicit targeting, simultaneous request correlation, 30 connect/close cycles, 10 concurrent SDK sessions with 1000 writes, a mutation finishing after timeout, a lost reply after a completed mutation, owner shutdown without SDK promotion, and handshake rejection with socket cleanup.

The full MCP gate passes with `SPICE_TEST_NGSPICE` configured and `SPICE_TEST_REQUIRED=1`. This includes the existing 36 execute-js cases, checkpoint tools, routing/operations/project checks, real MCP stdio/WebSocket integration, native PCB inspection/preview checks, datasheets, tool-result limits, API documentation, and actual ngspice simulations. No ngspice cases were skipped in the final configured run.

The installed-package check passes outside the source checkout. It checks MCP stdio/WebSocket behavior, SDK runtime imports, bundled Node/Python/type/license files, packaged documentation, and standalone SPICE operation with offline reuse.

## Runtime matrix

All local runs were on Windows x64 with Python **3.11.0**:

| Node.js | Coverage |
|---|---|
| 20.19.0 | SDK suite with Python worker, production-broker suite, live PCB Node test |
| 24.19.0 | SDK suite with Python worker |
| 26.5.0 | Full MCP gate, SDK and broker suites, installed package, live Python transport |

Linux/macOS and other Python versions were not executed locally. The SDK suites are included in the repository's normal MCP check command for its CI matrix.

## Live EasyEDA checks

The opt-in scripts `mcp/scripts/check-sdk-live.mjs` and `mcp/scripts/check-sdk-live.py` ran sequentially against test PCB `b988759eb94f13da`:

- Both read **68 components** through native API proxies.
- Each created, modified, reread and deleted its own DOCUMENT-layer line. The original line-ID set was identical before and after each test.
- Node obtained a local native `Blob`: PNG, **607452 bytes**.
- Python round-tripped that PNG and a Float64Array containing the actual component coordinates without changing their bytes.
- The scripts retained checkpoints and wrote local reports under `mcp/.test-data/sdk-live`.

These tests validate the transport and representative native PCB APIs. They do not establish exhaustive coverage of every EasyEDA method. Native browser callbacks and streaming/zero-copy binary transfer remain outside the SDK contract described in [local-sdk.md](local-sdk.md).
