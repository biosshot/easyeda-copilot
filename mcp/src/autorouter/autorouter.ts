import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { ROOT_DIR } from '../utils/dirs';

type RouterRunOptions = {
    timeoutMs: number;
    signal?: AbortSignal;
    onProgress?: (progress: number) => void;
};

type RouterResult = {
    progress?: number;
    routabitity?: number;
    traces?: unknown[];
    vias?: unknown[];
    [key: string]: unknown;
};

const ROUTER_WORKER_WRAPPER = `
const fs = require("fs");
const { parentPort, workerData } = require("worker_threads");

globalThis.self = globalThis;
self.location = {
  href: "file:///" + workerData.workerPath.replace(/\\\\/g, "/"),
  origin: "file://",
};

self.postMessage = (message) => parentPort.postMessage(message);
parentPort.on("message", (message) => {
  if (typeof self.onmessage === "function") {
    self.onmessage({ data: message });
  }
});

const nativeFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
const wasmBytes = fs.readFileSync(workerData.wasmPath);

globalThis.fetch = async (url, options) => {
  const href = String(url);
  if (href.includes("PCBRouter-YFDILLBW-YFDILLBW.wasm")) {
    return new Response(wasmBytes, {
      status: 200,
      headers: { "content-type": "application/wasm" },
    });
  }
  if (!nativeFetch) throw new Error("No fetch implementation for " + href);
  return nativeFetch(url, options);
};

require(workerData.workerPath);
`;

export function runEasyEdaAutoRouter(inputJson: unknown, options: RouterRunOptions): Promise<RouterResult> {
    if (options.signal?.aborted) {
        return Promise.reject(new Error('Auto router operation cancelled.'));
    }

    const routerDir = join(ROOT_DIR, 'autorouter', 'assets');
    const workerPath = join(routerDir, 'pcbRouterWorker.js');
    const wasmPath = join(routerDir, 'PCBRouter-YFDILLBW-YFDILLBW.wasm');

    return new Promise((resolvePromise, rejectPromise) => {
        const worker = new Worker(ROUTER_WORKER_WRAPPER, {
            eval: true,
            workerData: { workerPath, wasmPath },
        });
        let settled = false;
        let lastResult: RouterResult | undefined;

        const finish = async (error?: Error, result?: RouterResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', onAbort);
            await worker.terminate().catch(() => undefined);
            if (error) rejectPromise(error);
            else resolvePromise(result ?? {});
        };

        const onAbort = () => {
            finish(new Error('Auto router operation cancelled.'));
        };

        options.signal?.addEventListener('abort', onAbort, { once: true });

        const timer = setTimeout(() => {
            finish(new Error(`Router timeout after ${options.timeoutMs}ms`));
        }, options.timeoutMs);

        worker.on('message', message => {
            if (message?.topic === 'pcb/routerProgress') {
                const progress = Number(message.message?.progress ?? 0);
                if (Number.isFinite(progress)) options.onProgress?.(progress);
                return;
            }

            if (message?.topic === 'pcb/routerResult') {
                lastResult = message.message as RouterResult;
                const progress = Number(lastResult?.progress ?? 0);
                if (Number.isFinite(progress)) options.onProgress?.(progress);
                if (progress >= 1) {
                    finish(undefined, lastResult);
                }
                return;
            }

            if (message?.topic === 'pcb/routerInterrupt') {
                const messageText = String(message.message?.message ?? message.message ?? 'Router interrupted');
                finish(new Error(messageText));
            }
        });

        worker.on('error', error => finish(error instanceof Error ? error : new Error(String(error))));
        worker.on('exit', code => {
            if (settled) return;
            if (lastResult) finish(undefined, lastResult);
            else finish(new Error(`Router exited without result${code ? `, code ${code}` : ''}`));
        });

        worker.postMessage({
            topic: 'pangolin/autoRouting_wasm',
            type: 'publish',
            message: { json: inputJson, options: {} },
        });
    });
}
