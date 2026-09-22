import { abortable, currentSignal, withExecutionSignal, currentTarget, withTarget, type OperationTarget } from './cancellation';
import { TIMEOUT_POLICY } from '@copilot/shared/timeout-policy';
import { createOperationId, parseOperationId, type OperationKind } from './id';

type OperationStatus = 'running' | 'completed' | 'failed' | 'cancelled';
type CancelHandler = () => void | Promise<void>;
type ApplyHandler = () => Promise<unknown>;
type ApplyStatus = 'pending' | 'applying' | 'applied' | 'failed';

export type OperationContext = Readonly<{
    id: string;
    signal: AbortSignal;
    setStage(stage: string): void;
    setProgress(progress: unknown): void;
    setProgressReader(reader: () => Promise<unknown>): void;
    onCancel(handler: CancelHandler): void;
    setApplyHandler(handler: ApplyHandler): void;
    applyResult(): Promise<unknown>;
}>;

type ManagedOperation = {
    id: string;
    kind: OperationKind;
    resource?: string;
    target?: OperationTarget;
    tool?: string;
    status: OperationStatus;
    stage: string;
    progress?: unknown;
    readProgress?: () => Promise<unknown>;
    controller: AbortController;
    cancelHandler?: CancelHandler;
    applyHandler?: ApplyHandler;
    applyStatus?: ApplyStatus;
    applyResult?: unknown;
    applyPromise?: Promise<unknown>;
    applyError?: string;
    result?: unknown;
    error?: string;
    createdAt: number;
    completedAt?: number;
    done: Promise<void>;
    resolveDone: () => void;
};

export type StartOperationOptions = Readonly<{
    resource?: string;
    target?: OperationTarget;
    tool?: string;
    initialStage?: string;
}>;

const RETAINED_OPERATION_LIMIT = 20;

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export class OperationManager {
    readonly #operations = new Map<string, ManagedOperation>();

    runningIds() {
        return [...this.#operations.values()]
            .filter(operation => operation.status === 'running' || operation.applyStatus === 'applying')
            .map(operation => operation.id);
    }

    start<T>(
        kind: OperationKind,
        runner: (context: OperationContext) => Promise<T>,
        options: StartOperationOptions = {},
    ) {
        currentSignal()?.throwIfAborted();
        const target = options.target ?? currentTarget();
        if (target) options = { ...options, resource: `document:${target.instanceId}:${target.documentUuid ?? ''}` };
        if (options.resource) {
            const active = [...this.#operations.values()].find(operation => (
                operation.resource === options.resource && (operation.status === 'running' || operation.applyStatus === 'applying')
            ));
            if (active) {
                throw new Error(
                    `${active.kind} operation is already using ${options.resource}: ${active.id}`,
                );
            }
        }

        let id: string;
        do id = createOperationId(kind); while (this.#operations.has(id));

        const controller = new AbortController();
        let resolveDone!: () => void;
        const done = new Promise<void>(resolve => { resolveDone = resolve; });
        const operation: ManagedOperation = {
            id,
            kind,
            resource: options.resource,
            target: options.target ?? currentTarget(),
            tool: options.tool,
            status: 'running',
            stage: options.initialStage ?? 'starting',
            controller,
            createdAt: Date.now(),
            done,
            resolveDone,
        };
        this.#operations.set(id, operation);

        const context: OperationContext = {
            id,
            signal: controller.signal,
            setStage: stage => {
                if (operation.status === 'running') operation.stage = stage;
            },
            setProgress: progress => {
                if (operation.status === 'running') operation.progress = progress;
            },
            setProgressReader: reader => {
                if (operation.status === 'running') operation.readProgress = reader;
            },
            onCancel: handler => {
                operation.cancelHandler = handler;
                if (controller.signal.aborted) void Promise.resolve(handler()).catch(console.error);
            },
            setApplyHandler: handler => {
                operation.applyHandler = handler;
                operation.applyStatus = 'pending';
                operation.applyResult = undefined;
                operation.applyError = undefined;
            },
            applyResult: () => this.#apply(operation),
        };

        void Promise.resolve().then(() => {
            controller.signal.throwIfAborted();
            // Detach registered work from the MCP request that merely waits for it.
            return withTarget(operation.target, () => withExecutionSignal(controller.signal, () => runner(context)));
        }).then(result => {
            operation.result = result;
            const failed = Boolean((result as { tool_result?: { isError?: boolean } } | undefined)?.tool_result?.isError);
            operation.status = failed ? 'failed' : 'completed';
            operation.stage = operation.status;
        }).catch(error => {
            operation.status = controller.signal.aborted ? 'cancelled' : 'failed';
            operation.stage = operation.status;
            operation.error = errorMessage(error);
            if (operation.status === 'failed') console.error(error);
        }).finally(() => {
            operation.completedAt = Date.now();
            resolveDone();
            this.#trim();
        });

        return id;
    }

    async wait(operationId: string, waitMs: number = TIMEOUT_POLICY.operationWaitMs) {
        parseOperationId(operationId);
        const operation = this.#operations.get(operationId);
        if (!operation) throw new Error(`Operation not found: ${operationId}`);

        if (operation.status === 'running' || operation.applyStatus === 'applying') {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await abortable(Promise.race([
                    operation.status === 'running' ? operation.done : operation.applyPromise!,
                    new Promise<void>(resolve => { timer = setTimeout(resolve, waitMs); }),
                ]), currentSignal());
            } finally {
                if (timer) clearTimeout(timer);
            }
        }

        let progress = operation.progress;
        if (operation.status === 'running' && operation.readProgress) {
            // A missing or temporarily unreadable log must not fail the operation.
            progress = await abortable(operation.readProgress().catch(() => progress), currentSignal());
        }

        if (operation.applyStatus === 'applying') return { status: 'running' as const, operation_id: operation.id, kind: operation.kind, stage: 'applying' };
        if (operation.status === 'completed') {
            return operation.result ?? {
                status: 'completed' as const,
                operation_id: operation.id,
            };
        }
        if (operation.status === 'failed' && operation.result !== undefined) return operation.result;
        if (operation.status === 'failed' || operation.status === 'cancelled') {
            throw new Error(
                `${operation.error || `${operation.kind} operation ${operation.status}`} (operation_id: ${operation.id})`,
            );
        }
        return {
            status: 'running' as const,
            operation_id: operation.id,
            kind: operation.kind,
            stage: operation.stage,
            ...(progress === undefined ? {} : { progress }),
        };
    }

    async cancel(operationId: string) {
        parseOperationId(operationId);
        const operation = this.#operations.get(operationId);
        if (!operation) throw new Error(`Operation not found: ${operationId}`);

        let cancellationError: string | undefined;
        if (operation.status === 'running' || operation.applyStatus === 'applying') {
            operation.controller.abort(new Error(`Operation cancelled: ${operationId}`));
            if (operation.cancelHandler) {
                try {
                    await operation.cancelHandler();
                } catch (error) {
                    cancellationError = errorMessage(error);
                }
            }
        }
        return {
            status: operation.status === 'running' || operation.applyStatus === 'applying' ? 'cancel_requested' as const : operation.status,
            operation_id: operationId,
            ...(cancellationError ? { cancellation_error: cancellationError } : {}),
        };
    }

    async apply(operationId: string, waitMs?: number) {
        parseOperationId(operationId);
        const operation = this.#operations.get(operationId);
        if (!operation) throw new Error(`Operation not found: ${operationId}`);
        if (!operation.applyHandler) {
            throw new Error(`Operation has no saved result to apply: ${operationId}`);
        }

        const alreadyApplied = operation.applyStatus === 'applied';
        const application = this.#apply(operation);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const running = Symbol('running');
        let result: unknown;
        try {
            result = await abortable(waitMs === undefined ? application : Promise.race([
                application, new Promise<typeof running>(resolve => { timer = setTimeout(() => resolve(running), waitMs); }),
            ]), currentSignal());
        } finally { clearTimeout(timer); }
        if (result === running) return { status: 'running' as const, operation_id: operationId, stage: 'applying' };
        return {
            status: alreadyApplied ? 'already_applied' as const : 'applied' as const,
            operation_id: operationId,
            apply_result: result,
        };
    }

    #apply(operation: ManagedOperation): Promise<unknown> {
        if (!operation.applyHandler) return Promise.reject(new Error(`Operation has no saved result to apply: ${operation.id}`));
        if (operation.applyStatus === 'applied') return Promise.resolve(operation.applyResult);
        if (operation.applyPromise) return operation.applyPromise;
        if (operation.resource) {
            const conflict = [...this.#operations.values()].find(other => other !== operation
                && other.resource === operation.resource && (other.status === 'running' || other.applyStatus === 'applying'));
            if (conflict) return Promise.reject(new Error(`Resource is in use by ${conflict.id}`));
        }
        operation.applyStatus = 'applying';
        operation.applyError = undefined;
        operation.applyPromise = Promise.resolve().then(() => withTarget(operation.target, () =>
            withExecutionSignal(operation.controller.signal, () => operation.applyHandler!()),
        )).then(result => {
            operation.applyResult = result;
            operation.applyStatus = 'applied';
            return result;
        }).catch(error => {
            operation.applyStatus = 'failed';
            operation.applyError = errorMessage(error);
            throw error;
        }).finally(() => { operation.applyPromise = undefined; });
        return operation.applyPromise;
    }

    list() {
        return [...this.#operations.values()].map(operation => ({
            operation_id: operation.id,
            kind: operation.kind,
            ...(operation.tool ? { tool: operation.tool } : {}),
            status: operation.applyStatus === 'applying' ? 'running' : operation.status,
            stage: operation.applyStatus === 'applying' ? 'applying' : operation.stage,
            ...(operation.target ? { target: operation.target } : {}),
            ...(operation.applyStatus ? { apply_status: operation.applyStatus } : {}),
        }));
    }

    #trim() {
        const finished = [...this.#operations.values()]
            .filter(operation => operation.status !== 'running' && operation.applyStatus !== 'applying')
            .sort((left, right) => left.createdAt - right.createdAt);
        while (this.#operations.size > RETAINED_OPERATION_LIMIT && finished.length) {
            this.#operations.delete(finished.shift()!.id);
        }
    }
}

export const operationManager = new OperationManager();
