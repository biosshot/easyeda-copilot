type ActiveExecution = {
    id: number;
    startedAt: number;
    cancelRequested: boolean;
    reason: string;
};

export type ExecuteJsControl = {
    readonly executionId: number;
    readonly cancelled: boolean;
    throwIfCancelled(): void;
};

let sequence = 0;
let active: ActiveExecution | undefined;

export function beginJavaScriptExecution() {
    const execution: ActiveExecution = {
        id: ++sequence,
        startedAt: Date.now(),
        cancelRequested: false,
        reason: 'Interrupted by MCP client',
    };
    active = execution;
    const control: ExecuteJsControl = {
        executionId: execution.id,
        get cancelled() { return execution.cancelRequested; },
        throwIfCancelled() {
            if (execution.cancelRequested) {
                throw new Error(`JavaScript execution interrupted: ${execution.reason}`);
            }
        },
    };
    return {
        control,
        finish() {
            if (active === execution) active = undefined;
        },
    };
}

export function interruptJavaScriptExecution(reason = 'Interrupted by MCP client') {
    if (!active) return { interrupted: false, status: 'idle' as const };
    active.cancelRequested = true;
    active.reason = reason;
    return {
        interrupted: true,
        status: 'cancel_requested' as const,
        executionId: active.id,
        startedAt: active.startedAt,
    };
}
