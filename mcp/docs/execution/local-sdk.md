# Local Python and Node.js SDK

Use this SDK when a task benefits from local libraries, calculations or file processing while calling the native EasyEDA API. It ships with MCP; do not install a separate SDK from npm or pip. The existing extension and `execute_js` MCP tool keep their behavior.

Read [execution instructions](instructions.md) and the relevant [API declarations](easyeda-api/references/_index.md). Ordinary PCB primitives use mil, with [field-specific exceptions](pcb-units.md), including filled-pour geometry. A remote call does not add missing API methods or change native commit semantics such as `done()`.

## When to use the SDK

Use the placement/routing DSL for overall layout intent and scoped routing passes. Choose the SDK for native analysis or corrections that combine EasyEDA access with local Python/Node.js work: geometry libraries, file or binary processing, or repeated read–calculate–apply cycles. A typical transition is a routing pass that leaves a diagnosed local clearance or ground-connection problem requiring geometric calculation. Prefer one SDK script over repeatedly exporting board JSON, calculating in another process and generating a separate `execute_js` body for each repair.

Keep `execute_js` for a self-contained operation inside EasyEDA that does not benefit from a local runtime. Starting with MCP does not require finishing through the same execution path. The SDK uses the existing broker and native API; it does not add a routing algorithm, fix native API limitations or make edits atomic.

For example, a local ground-connection repair can follow this workflow:

1. Open the intended PCB and bind an SDK session to its instance and document UUID. Node.js automatically retains one baseline checkpoint for the session; Python can use [checkpoint scopes](checkpoint-scopes.md) when several dependent requests need one baseline.
2. Read the affected pads, nets, nearby copper and current filled regions through `session.eda`. Confirm [units and coordinates](pcb-units.md) before local calculations.
3. Use local geometry libraries to propose a short connection and via positions. The [Shapely examples](shapely-geometry.md) show how to bring native geometry into local calculations.
4. Recheck the document and target preconditions before writing. Apply only the diagnosed correction, await all mutations and retain the checkpoint ID. Re-read objects when the editor splits or replaces primitives.
5. Rebuild affected pours and check native connectivity, DRC and geometry using [refill and DRC](pcb-refill-and-drc.md) and [routing verification](../pcb-routing/verification.md). A successful API call or local geometric calculation alone does not verify the repair.
6. Report a compact before/after result and close the session, including on failure. If an execution outcome is unknown, resolve it before retrying or restoring.

## Locate and run

The MCP tool description gives the absolute docs path. Its parent is the MCP package root, called `MCP_ROOT` below. The distribution contains:

```text
MCP_ROOT/
  dist/lib/node/index.mjs       # JavaScript entry point
  dist/lib/node/index.d.mts     # TypeScript declarations
  dist/lib/node/api.d.mts       # Generated native API surface
  dist/lib/node/constants.mjs   # Native enum values
  dist/lib/node/worker.mjs      # Private Python transport worker
  dist/lib/python/easyeda_copilot/
```

An agent should read the required API signatures, write a local `.mjs` or `.py` script, and run it using the host's Node.js or Python executable. Keep the existing MCP server/broker running. Import the SDK from this installed MCP directory; do not copy only its entry file. Run scripts on the MCP host by default. No new MCP tool or owner process is needed.

Node.js requires the same version as MCP: 20.19 or newer. Python requires 3.10 or newer and uses only its standard library. Python starts the bundled Node worker as a hidden subprocess on Windows; this reuses the existing WebSocket client rather than implementing another transport. Set `EASYEDA_COPILOT_NODE` to an absolute Node executable path if it is not on PATH. Python calculations and third-party libraries run in the selected Python environment.

PowerShell setup, substituting the actual installed MCP directory:

```powershell
$env:EASYEDA_COPILOT_MCP_ROOT = 'D:/path/to/easyeda-copilot/mcp'
$env:PYTHONPATH = "$env:EASYEDA_COPILOT_MCP_ROOT/dist/lib/python" + [IO.Path]::PathSeparator + $env:PYTHONPATH
node ./inspect-board.mjs
python ./inspect-board.py
```

POSIX shells can use `export PYTHONPATH="$EASYEDA_COPILOT_MCP_ROOT/dist/lib/python${PYTHONPATH:+:$PYTHONPATH}"`.

## Node.js

Use a literal import path in TypeScript or editor-checked JavaScript to get the generated types:

```javascript
import { connect, EPCB_LayerId } from 'D:/path/to/mcp/dist/lib/node/index.mjs';

const session = await connect({
  instanceId: 'INSTANCE_UUID',
  documentUuid: 'PCB_DOCUMENT_UUID',
});
try {
  const eda = session.eda;
  const components = await eda.pcb_PrimitiveComponent.getAll();
  const designators = await Promise.all(components.map(c => c.getState_Designator()));
  console.log({ count: components.length, designators, checkpoint: session.lastCheckpoint });
} finally {
  await session.close();
}
```

For portable scripts, import using `await import(pathToFileURL(resolve(process.env.EASYEDA_COPILOT_MCP_ROOT, 'dist/lib/node/index.mjs')).href)` with `pathToFileURL` from `node:url` and `resolve` from `node:path`. A dynamic path does not provide the same static TypeScript inference as a literal import.

`connect()` selects the only connected instance or fails if selection is ambiguous. Use `listInstances()` to obtain actual IDs. Omitting `documentUuid` binds the session to the current document. Passing a UUID verifies it is active; it does not open it. Open the intended document first. `documentUuid: null` explicitly permits switching documents, useful for document-management scripts.

In Node.js, `connect()` opens one checkpoint scope automatically and names it after the entry `.js`/`.mjs` file. Every SDK call on that session reuses the same baseline until `session.close()`, so generated scripts do not need to remember `checkpointScope()`. Set `checkpointScope: 'Custom name'` to override its history label, or `checkpointScope: false` to opt into the old checkpoint-per-request behavior. A document-switching session (`documentUuid: null`) cannot have a single document baseline and therefore does not open an automatic scope. Existing explicit `checkpointScope()` wrappers reuse the automatic baseline for compatibility.

The default broker is `ws://127.0.0.1:8787`; `EASYEDA_COPILOT_MCP_WS_HOST` and `EASYEDA_COPILOT_MCP_WS_PORT` override it. `connect({url, timeoutMs})` also accepts an explicit URL and execution timeout. The SDK never becomes broker owner or reconnects automatically.

## Python

```python
import asyncio
from easyeda_copilot import connect
from easyeda_copilot.constants import EPCB_LayerId

async def main():
    async with await connect(instance_id='INSTANCE_UUID', document_uuid='PCB_DOCUMENT_UUID') as session:
        eda = session.eda
        components = await eda.pcb_PrimitiveComponent.getAll()
        names = await asyncio.gather(*(c.getState_Designator() for c in components))
        print({'count': len(components), 'designators': names,
               'checkpoint': session.last_checkpoint})

asyncio.run(main())
```

SDK setup methods use Python names (`list_instances`, `document_uuid`, `instance_id`, `timeout_ms`, `execute_js`). Native API methods and argument order keep their original names. Use positional arguments for native methods; pass native option objects as dictionaries. `UNDEFINED` represents JavaScript `undefined`; `None` represents `null`.

## Execution and types

Node.js uses one baseline automatically. In Python, use [checkpoint scopes](checkpoint-scopes.md)
across dependent requests. This mode requires an updated extension; Node.js can temporarily opt out with `checkpointScope: false` when connecting to an older extension.

Property access builds an expression. A method call builds a lazy awaitable. `await` dispatches it through the existing broker's `execute-js` event. Merely constructing a call does not execute it. Await all edits before closing.

`Promise.all` / `asyncio.gather` automatically collect calls waiting in the same event-loop turn into one execution. Calls execute in order inside EasyEDA. On failure, the successful prefix remains applied and subsequent calls in that group are skipped. This is not an atomic transaction or rollback. Use `Promise.allSettled` / `gather(return_exceptions=True)` when you need every individual result. There is no separate batch mode to configure.

Returned arrays and plain records are local values; native class instances are remote object references. Their methods preserve `this`. Pass those proxies back as arguments, including nested in arrays/records. Await even synchronous native getters:

Objects with native accessor properties also remain remote, so serialization does not trigger their getters. Sparse array holes become explicit `undefined` elements; negative zero and nonfinite numbers are preserved. Nested argument expressions execute in order and stop after an error.

```javascript
const designator = await components[0].getState_Designator();
await eda.pcb_PrimitiveComponent.modify(components[0], { x: 100, y: 200 });
```

Node declarations are generated from the pinned native type source at build time, retaining overloads, parameter names and enums. Native methods return `RemoteCall<Awaited<T>>`, including formerly synchronous getters. Import `type API` to name returned objects, e.g. `API.IPCB_PrimitiveComponent`. Python uses a dynamic proxy. Generated types reflect the bundled API version; the connected editor may expose a different version.

Local callbacks, constructors, subscriptions, symbols and proxy assignment cannot be transported as ordinary arguments. Callback parameters are typed `never` where represented by native function types. Use `session.eval` or `executeJs` to create and consume such values inside EasyEDA; do not leave background tasks/subscriptions running after an execution. Mutating an API object still requires its native setter/modify/done methods. An unknown runtime type becomes a remote reference rather than being silently converted into an empty object.

## Binary and large values

For PCB calculations, read [field-specific units](pcb-units.md) and the optional
[Shapely geometry examples](shapely-geometry.md). Native API unit conventions can
change and require a basic check on the connected editor.

The proxy/eval codec preserves nested `Blob`, `File`, `ArrayBuffer`, `DataView` and numeric typed arrays. In Node.js these are actual local binary objects, ready for filesystem, image or math libraries. `File` retains its name, MIME type and last-modified time. Typed-array views transmit only the view's bytes and preserve the element type; shared backing-buffer identity is not preserved.

```javascript
import { writeFile } from 'node:fs/promises';
const image = await eda.dmt_EditorControl.getCurrentRenderedAreaImage();
if (!image) throw new Error('No preview');
console.log(image instanceof Blob, image.type, image.size);
await writeFile('preview.png', Buffer.from(await image.arrayBuffer()));
// image can also be passed directly to another native API accepting Blob.
```

Python receives `Blob(data: bytes, type)`, `File` with metadata, `ArrayBuffer` (a bytes subclass), or `TypedArray(data: bytes, type)`. A Blob provides `size`, `await text()` and `await arrayBuffer()`. Its `.data` works with `BytesIO`, Pillow or a file writer. For typed data, choose a NumPy dtype matching `.type` and call `numpy.frombuffer(value.data, dtype=...)`. Plain Python bytes arguments become `Uint8Array` in EasyEDA; wrap them in `Blob` or `ArrayBuffer` when the native API requires that type.

Large results go directly to the local script; the MCP tool's 8 KiB artifact threshold does not apply. This version transfers whole values using base64 inside JSON, with copies and memory overhead; it is not a streaming or zero-copy transport. Keep only required data, process bounded chunks for huge datasets, and print a small summary instead of dumping binary or board data into the agent context.

## Existing scripts and an escape hatch

Existing asynchronous JavaScript function bodies work through `executeJs` (`execute_js` in Python):

```javascript
const result = await session.executeJs({
  file_path: 'D:/scripts/inspect-pcb.js',
  input_files: { source: { path: 'D:/data/source.txt' } },
});
// Or: await session.executeJs({code: 'return inputs.name', inputs: {name: 'board'}})
```

The script sees the native `eda` and string `inputs` exactly as an ordinary `execute_js` body does. This direct SDK method returns decoded data, not `{checkpoint,result,artifacts}`. Legacy binary results become a local Blob because the original execute-js wire format retains MIME and bytes, not the original binary class. The MCP tool itself still returns its existing envelope and saves binary/large results to artifacts.

`session.eval(code, inputs)` combines a native JavaScript body with the richer proxy codec. It accepts local data, binary objects and remote references, and returns the corresponding decoded values:

```javascript
const result = await session.eval(`
  const names = inputs.components.map(c => c.getState_Designator());
  return { names, preview: await eda.dmt_EditorControl.getCurrentRenderedAreaImage() };
`, { components });
```

This is useful for browser-only code, a tight native loop or a single coherent edit. `eval` checks the document before and after execution; for long scripts check it again immediately before writes. `executeJs` preserves legacy behavior and does not wrap its code in SDK document checks.

## Lifetime and failures

Use one session for a bounded phase and always close it in `finally` or an async context manager. `release(...objects)` invalidates selected remote handles. Closing frees the session's object registry and cached call results. A remote call expression is cached so awaiting it again or using it as an argument does not repeat a mutation; construct a new call when you want a fresh read. Cached results can retain memory until close. There is a 50,000-handle and 50,000-call limit per session. Abandoned sessions are removed lazily on a subsequent SDK request after 30 minutes of inactivity.

Changing the active document invalidates a bound session. References do not survive closing, expiration or editor reload. After a document save/close/reopen or external state replacement, reconnect and obtain fresh objects; document UUID checks are not revision tracking and do not lock the editor.

In Node.js, the automatic file-level scope makes every underlying `execute-js`, including reads and session housekeeping, reuse one baseline. With `checkpointScope: false`, or in Python outside an explicit scope, every execution creates a checkpoint. Keep `scope.checkpointId` / `scope.checkpoint_id` or the edit's `session.lastCheckpoint` / `session.last_checkpoint`.

`SdkError` includes the checkpoint when available, `failedIndex` (`failed_index`) for a grouped call, and `outcomeUnknown` (`outcome_unknown`) for transport failures. A timeout/disconnect closes the SDK connection but does not cancel JavaScript already running in EasyEDA. Do not automatically retry a mutation or restore while its outcome is unknown; follow [execution recovery](instructions.md#errors-and-timeout). Other MCP connections and the broker remain running.

In Python, cancelling one waiter on a shared proxy expression leaves that expression running for its other waiters. Cancelling a whole `eval`/`execute_js` RPC closes its transport worker to avoid waiting forever on an unread large response; code already sent to EasyEDA can still finish. Invalid local input is rejected before dispatch and does not disconnect the session. `close()` is idempotent even when called concurrently and drains already accepted proxy calls, including binary argument encoding.

## Verification

See the [verification report](local-sdk-verification.md) for reproduced faults, fixes, runtime versions, live checks and coverage limits.

In a source checkout, `npm run test:sdk --workspace=mcp` runs the SDK integration and production-broker suites after a build. They cover codecs, generated types, lifecycle, cancellation, wrong-document guards, concurrent clients and lost responses. `node mcp/scripts/check-sdk-live.mjs <test-pcb-uuid> [instance-id]` and `python mcp/scripts/check-sdk-live.py <test-pcb-uuid> [instance-id]` are **opt-in mutation tests**: each creates, modifies and removes one DOCUMENT-layer line and verifies the original line IDs. Run them sequentially, only on a user-authorized test PCB.
