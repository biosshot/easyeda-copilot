# EDA Copilot Backend

Local component search, schematic assembly and PCB placement for EDA Copilot integrations. Source lives in the EasyEDA Copilot repository; `eda-copilot-backend` is an independent npm package. This branch prepares the package locally and does not publish it.

```ts
import { componentSearch, extractCircuit, makePcbLayout, getPcbComponentSizes, disposeBackend } from 'eda-copilot-backend';

const candidates = await componentSearch({ MPN: 'STM32F103C8T6' });
const schematic = await extractCircuit({ circuit: circuitMod, inputCircuit: currentSchematic });
const sizes = await getPcbComponentSizes({ circuit: currentSchematic, footprints });
try {
  const layout = await makePcbLayout({ code: placementDsl, circuit: currentSchematic, footprints }, {
    signal: abortController.signal,
    onProgress: progress => console.error(progress.content),
  });
  // Apply schematic.circuit or layout.pcb through your CAD integration.
} finally {
  await disposeBackend();
}
```

Use `eda-copilot-backend/components`, `/schematic`, `/pcb` or `/types` for individual entry points. The public declarations describe the existing circuit and PCB contracts. Placement does not route copper; EasyEDA MCP continues to use `eda-copilot-router` for routing and DRC.

Search and UUID-based symbol/footprint resolution use the public EasyEDA APIs. No Copilot server, LLM key, LangChain or database is required. PCB accepts supplied footprints for other CAD integrations and offline execution. `searchReusedBlock` returns `[]`; `extractCircuit` rejects nonempty `add_reused_blocks` before doing work.

Runtime requires Node >=20.19. PCB placement also requires the native binary matching the host. Source builds support Windows, Linux with glibc and macOS on x64/arm64; the platform CI builds and checks its host binary. The local development run on this branch verifies Windows x64; CI must verify the other hosts before their support is released. A packaged build must contain the binaries for the platforms it claims to support. No Rust toolchain is needed to use a package containing the matching binary.

From the repository root:

```sh
npm ci
npm run native:build --workspace=eda-copilot-backend
npm run check --workspace=eda-copilot-backend
npm run check --workspace=mcp
npm run test:package --workspace=eda-copilot-backend
```

Rust is needed only for `native:build`. `test:package` creates local tarballs in `backend/.artifacts`, installs them into a temporary project outside the repository, and exercises the public APIs, native worker, assets and TypeScript declarations. It never publishes. Tests use fixtures rather than the private server or a changing component catalogue. The ported schematic checks cover layout/assembly; server-only PNG gallery rendering and inactive pattern implementations are excluded.

The package lazily starts one PCB worker by default. `PCB_LAYOUT_WORKERS`, `PCB_LAYOUT_WORKER_QUEUE_SIZE`, `PCB_LAYOUT_WORKER_TIMEOUT_MS` and the existing `PCB_LAYOUT_SUBTREE_*` settings can tune the worker pools; subtree workers remain disabled by default. `EDA_BACKEND_LOG_LEVEL` controls stderr logging. `PCB_BOARD_PACKER_NATIVE_PATH` is an optional development override; ordinary installations resolve assets relative to this package, never the current working directory.
