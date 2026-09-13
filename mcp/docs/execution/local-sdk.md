# Local Python and Node.js SDK

Use this SDK when a task benefits from local libraries, calculations or file processing while calling the native EasyEDA API. It ships with MCP; do not install a separate SDK from npm or pip. The existing extension and `execute_js` MCP tool keep their behavior.

Read [execution instructions](instructions.md) and the relevant [API declarations](easyeda-api/references/_index.md). Native PCB coordinates remain in mil. A remote call does not add missing API methods or change native commit semantics such as `done()`.

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

Property access builds an expression. A method call builds a lazy awaitable. `await` dispatches it through the existing broker's `execute-js` event. Merely constructing a call does not execute it. Await all edits before closing.

`Promise.all` / `asyncio.gather` automatically collect calls waiting in the same event-loop turn into one execution. Calls execute in order inside EasyEDA. On failure, the successful prefix remains applied and subsequent calls in that group are skipped. This is not an atomic transaction or rollback. Use `Promise.allSettled` / `gather(return_exceptions=True)` when you need every individual result. There is no separate batch mode to configure.

Returned arrays and plain records are local values; native class instances are remote object references. Their methods preserve `this`. Pass those proxies back as arguments, including nested in arrays/records. Await even synchronous native getters:

```javascript
const designator = await components[0].getState_Designator();
await eda.pcb_PrimitiveComponent.modify(components[0], { x: 100, y: 200 });
```

Node declarations are generated from the pinned native type source at build time, retaining overloads, parameter names and enums. Native methods return `RemoteCall<Awaited<T>>`, including formerly synchronous getters. Import `type API` to name returned objects, e.g. `API.IPCB_PrimitiveComponent`. Python uses a dynamic proxy. Generated types reflect the bundled API version; the connected editor may expose a different version.

Local callbacks, constructors, subscriptions, symbols and proxy assignment cannot be transported as ordinary arguments. Callback parameters are typed `never` where represented by native function types. Use `session.eval` or `executeJs` to create and consume such values inside EasyEDA; do not leave background tasks/subscriptions running after an execution. Mutating an API object still requires its native setter/modify/done methods. An unknown runtime type becomes a remote reference rather than being silently converted into an empty object.

## Binary and large values

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

Every underlying `execute-js`, including reads and session housekeeping, still creates a checkpoint. Keep `session.lastCheckpoint` / `session.last_checkpoint` immediately after the edit of interest; later reads produce new checkpoints. The extension's checkpoint cost remains unchanged.

`SdkError` includes the checkpoint when available, `failedIndex` (`failed_index`) for a grouped call, and `outcomeUnknown` (`outcome_unknown`) for transport failures. A timeout/disconnect closes the SDK connection but does not cancel JavaScript already running in EasyEDA. Do not automatically retry a mutation or restore while its outcome is unknown; follow [execution recovery](instructions.md#errors-and-timeout). Other MCP connections and the broker remain running.
