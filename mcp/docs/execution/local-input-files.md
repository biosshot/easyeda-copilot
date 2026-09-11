# Local data into execute_js

The existing transport accepts `code` or a JavaScript `file_path`. MCP reads that script on its host and sends its contents to EasyEDA. A path inside the script is not automatically uploaded; do not assume Node.js `fs`, Python, or the host filesystem exists in the editor.

Local computation can still feed native edits without pasting large data into tool arguments. Generate a JavaScript wrapper locally using JSON serialization, then execute the wrapper by path. This works for geometry JSON and complete Source text. It does not make invalid Source records acceptable to EasyEDA.

## Existing transport: embed a data string safely

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
if len(script.encode('utf-8')) > 1024 * 1024:
    raise ValueError('Generated script exceeds execute_js 1 MiB limit')
output_path.write_bytes(script.encode('utf-8'))
```

Then call `execute_js({file_path: "D:/project/generated-apply.js"})`. For JSON data the body uses `JSON.parse(inputText)`. For Source, `inputText` is the full text passed to `setDocumentSource` only after target and current-baseline validation; follow [file-source.md](file-source.md). Do not use an unguarded setter as the whole apply body.

JSON serialization happens inside a file-writing program. Do not interpolate payload into shell command text or a JavaScript template literal: backticks, `${...}`, quotes and newlines in design content must remain data. The generated wrapper contains the data, so treat it as a project artifact. Neither generating nor reading it applies a board change.

## Possible future API (not implemented)

A small extension to the existing tool could accept named `input_files`, for example `{"source": {"path": "D:/project/edited-source.txt", "encoding": "utf8"}}`, alongside `code` or `file_path`. MCP would read explicit absolute paths and deliver their contents as an `inputs.source` value, separate from executable code.

The implementation should validate all files and aggregate byte limits before requesting a checkpoint/execution, reject missing files/directories and duplicate names, and pass data as serialized arguments rather than executable text. Code and data should have distinct limits. The response can record byte lengths/hashes for reproducibility without echoing file contents. Binary support can follow a real consumer requirement; UTF-8 text covers Source and geometry JSON.

This is data transport, not automatic Source application, arbitrary remote filesystem access, or an atomic board transaction. Native setter rejection, normalization and edits made after the exported baseline still need the normal checks.
