# Local data into execute_js

The transport accepts `code` or a JavaScript `file_path`, plus optional `input_files`. MCP reads that script on its host and sends its contents to EasyEDA. A path inside the script is not automatically uploaded; do not assume Node.js `fs`, Python, or the host filesystem exists in the editor.

Local computation can still feed native edits without pasting large data into tool arguments. Generate a JavaScript wrapper locally using JSON serialization, then execute the wrapper by path. This works for geometry JSON and complete Source text. It does not make invalid Source records acceptable to EasyEDA.

## Named input files (preferred)

```json
{
  "file_path": "D:/project/apply.js",
  "input_files": {
    "source": { "path": "D:/project/edited-source.txt", "encoding": "utf8" },
    "geometry": { "path": "D:/project/geometry.json" }
  }
}
```

The script reads `inputs.source` as text and `JSON.parse(inputs.geometry)` as geometry data. Without input files, `inputs` is an empty object. Files require absolute paths on the MCP host; only UTF-8 is supported, and it is the default encoding. BOM and line endings are preserved. Files are passed as function arguments, not interpolated into JavaScript code. File contents never need to be echoed into model context.

Script size is limited to 64 MiB in UTF-8 bytes; input files have a separate combined 512 MiB limit. MCP validates file types, aggregate size and UTF-8 before dispatch, and rechecks actual bytes after reading. Read/validation failures do not create a checkpoint or execute code. Both the MCP server and extension must be updated for this interface.

Transfer uses the existing JSON WebSocket transport, with its payload ceiling raised to account for escaped/nested JSON. These are admission limits, not guarantees of editor capacity: strings and JSON serialization create memory copies, and runtime string/memory limits may reject very large payloads. No streaming/chunking is introduced. Timeout still does not cancel an execution; a transport error does not prove the script failed to run.

For Source, follow [file-source.md](file-source.md): inspect the intended diff, check target and baseline, apply once, check the setter result and native readback. Uploading text does not guarantee EasyEDA accepts its records. This transport does not apply Source automatically or provide a revision lock.

## Compatibility alternative: embed a data string safely

Save the following as a local Python script, adapt the paths, and run it locally. `apply-body.js` is a prepared async-function body that reads the string `inputText`, checks the exact target/baseline, performs the authorized change and verifies readback.

```python
import json
from pathlib import Path

data_path = Path('D:/project/edited-source.txt')
body_path = Path('D:/project/apply-body.js')
output_path = Path('D:/project/generated-apply.js')
with data_path.open(encoding='utf-8', newline='') as stream:
    payload = stream.read()
body = body_path.read_text(encoding='utf-8')
script = 'const inputText = ' + json.dumps(payload, ensure_ascii=True) + ';\n' + body
if len(script.encode('utf-8')) > 64 * 1024 * 1024:
    raise ValueError('Generated script exceeds execute_js 64 MiB limit')
output_path.write_bytes(script.encode('utf-8'))
```

Then call `execute_js({file_path: "D:/project/generated-apply.js"})`. For JSON data the body uses `JSON.parse(inputText)`. For Source, `inputText` is the full text passed to `setDocumentSource` only after target and current-baseline validation; follow [file-source.md](file-source.md). Do not use an unguarded setter as the whole apply body.

JSON serialization happens inside a file-writing program. Do not interpolate payload into shell command text or a JavaScript template literal: backticks, `${...}`, quotes and newlines in design content must remain data. The generated wrapper contains the data, so treat it as a project artifact. Neither generating nor reading it applies a board change.
