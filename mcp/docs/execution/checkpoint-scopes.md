# SDK checkpoint scopes

A scope creates one named baseline for successive requests on one SDK session.
Every `await` still runs normally, so local Python/Node calculations can depend on
earlier results. There is no deferred commit, automatic rollback, automatic document
save, or isolation from manual edits and other clients.

Both the MCP SDK distribution **and the EasyEDA extension** need this feature.
Older extensions reject scope negotiation in the SDK before the callback/context
body is entered. Python ordinary calls remain compatible; Node.js must pass
`checkpointScope: false` to `connect()` when temporarily using an older extension.

Node.js `connect()` opens this scope automatically for the lifetime of the session,
using the entry script filename as its history label. Explicit scope wrappers reuse
that baseline, so older generated scripts remain valid. Pass `checkpointScope: false`
to `connect()` only when checkpoint-per-request behavior is intentional. Python keeps
the explicit context-manager API shown below.

## Python

```python
async with await connect(document_uuid=pcb_uuid) as session:
    async with session.checkpoint_scope('Connect ground islands') as scope:
        eda = scope.eda
        components = await eda.pcb_PrimitiveComponent.getAll()
        # Local computation and awaited edits here.
        drc = await eda.pcb_Drc.check(True, False, True)
        print(scope.checkpoint_id, drc)
    # Scope exit does not save the PCB or decide whether to restore it.
```

## Node.js

```javascript
const session = await connect({ documentUuid: pcbUuid });
try {
  await session.checkpointScope('Connect ground islands', async scope => {
    const eda = scope.eda;
    const components = await eda.pcb_PrimitiveComponent.getAll();
    // Local computation and awaited edits here.
    const drc = await eda.pcb_Drc.check(true, false, true);
    console.log(scope.checkpointId, drc);
  });
} finally {
  await session.close();
}
```

Without a callback, use `const scope = await session.beginCheckpointScope(name)`
and `try { ... } finally { await scope.close(); }`. Closing is idempotent. Callback
return values are preserved. TypeScript declarations include both interfaces.

## Boundaries and errors

- A bound `documentUuid` is required. The scope verifies the document before every
  execution, including legacy `session.executeJs` / `session.execute_js` bodies,
  and checks again afterward. This is identity checking, not an editor lock.
- The scope applies to **all requests on this session**, including `session.eda`,
  `eval` and legacy execution. Do not run unrelated workflows concurrently on the
  same session. Use separate sessions. `Promise.all` / `asyncio.gather` batching
  within the workflow remains supported.
- Nested explicit scopes on a session are rejected. An explicit Node wrapper inside
  its automatic file-level scope is a compatibility view of that same baseline.
  Await entry/exit before starting more
  work, and await edits before leaving the block. Lazy expressions execute when
  awaited, not when constructed; saved remote objects can be used after the scope
  under the session's ordinary checkpoint policy.
- A baseline is created at entry, even if the body only reads. Normal session
  initialization and work outside the block still create ordinary checkpoints.
- A script error leaves completed changes applied. Its `SdkError` carries the
  baseline ID when known. Closing does not claim success or restore anything.
  A callback's original failure is preserved if cleanup also fails.
- A scope token expires after five idle minutes and is renewed by valid requests.
  A disconnected SDK normally closes its group during shutdown; an abruptly killed
  process cannot send cleanup, so its token/pin expires. Editor reconnect/reload
  invalidates existing tokens. There is no automatic retry or new baseline on expiry.
- Active baselines are protected from ordinary history pruning until close/expiry.
  Afterward they remain ordinary saved checkpoints subject to normal retention.
- Timeouts do not cancel JavaScript. Establish the outcome before retrying or
  restoring. See [execution recovery](instructions.md#errors-and-timeout).

## Implementation

The existing `execute-js` wire envelope gains optional `checkpointScope` metadata
with `begin`, `use` and `end` actions. The extension handles it in its existing serial
queue. `begin` returns a fresh token, baseline ID and document identity; `use` checks
the token and logical SDK session; `end` releases its pin. Tokens are capabilities,
not a sandbox/security boundary for arbitrary extension JavaScript.

Control actions do not execute a user script. Missing metadata keeps the old
checkpoint-per-execution behavior. Invalid metadata fails before user execution;
there is no global switch to disable checkpoints. The Python worker uses the same
Node Session implementation for this protocol.
