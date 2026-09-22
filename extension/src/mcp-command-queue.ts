type Entry = { run: () => Promise<void>; finish: (error?: unknown) => void; signal?: AbortSignal };

/** Serial MCP commands with removable waiting entries. Active work owns its cancellation. */
export class McpCommandQueue {
    private waiting: Entry[] = [];
    private active = false;
    get size() { return this.waiting.length; }

    add(run: () => Promise<void>, options: { signal?: AbortSignal } = {}): Promise<void> {
        const { signal } = options;
        if (signal?.aborted) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            const cancel = () => {
                const index = this.waiting.indexOf(entry);
                if (index < 0) return; // Already executing: the command observes its signal.
                this.waiting.splice(index, 1);
                entry.finish();
            };
            const entry: Entry = { run, signal, finish: error => {
                signal?.removeEventListener('abort', cancel);
                if (error === undefined) resolve();
                else reject(error);
            } };
            signal?.addEventListener('abort', cancel, { once: true });
            this.waiting.push(entry);
            this.drain();
        });
    }

    clear() {
        for (const entry of this.waiting.splice(0)) entry.finish();
    }

    private drain() {
        if (this.active) return;
        const entry = this.waiting.shift();
        if (!entry) return;
        this.active = true;
        void Promise.resolve().then(() => {
            if (!entry.signal?.aborted) return entry.run();
        }).then(() => entry.finish(), error => entry.finish(error)).finally(() => {
            this.active = false;
            this.drain();
        });
    }
}
