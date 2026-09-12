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
    status: OperationStatus;
    stage: string;
    progress?: unknown;
    readProgress?: () => Promise<unknown>;
    controller: AbortController;
    cancelHandler?: CancelHandler;
    applyHandler?: ApplyHandler;
    applyStatus?: ApplyStatus;
    applyResult?: unknown;
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
    initialStage?: string;
}>;

const RETAINED_OPERATION_LIMIT = 20;

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export class OperationManager {
    readonly #operations = new Map<string, ManagedOperation>();

    start<T>(
        kind: OperationKind,
        runner: (context: OperationContext) => Promise<T>,
        options: StartOperationOptions = {},
    ) {
        if (options.resource) {
            const active = [...this.#operations.values()].find(operation => (
                operation.resource === options.resource && operation.status === 'running'
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
            return runner(context);
        }).then(result => {
            operation.result = result;
            operation.status = 'completed';
            operation.stage = 'completed';
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

    async wait(operationId: string, waitMs = 30_000) {
        parseOperationId(operationId);
        const operation = this.#operations.get(operationId);
        if (!operation) throw new Error(`Operation not found: ${operationId}`);

        if (operation.status === 'running') {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([
                    operation.done,
                    new Promise<void>(resolve => { timer = setTimeout(resolve, waitMs); }),
                ]);
            } finally {
                if (timer) clearTimeout(timer);
            }
        }

        let progress = operation.progress;
        if (operation.status === 'running' && operation.readProgress) {
            // A missing or temporarily unreadable log must not fail the operation.
            progress = await operation.readProgress().catch(() => progress);
        }

        if (operation.status === 'completed') {
            return operation.result ?? {
                status: 'completed' as const,
                operation_id: operation.id,
            };
        }
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
        if (operation.status === 'running') {
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
            status: operation.status === 'running' ? 'cancel_requested' as const : operation.status,
            operation_id: operationId,
            ...(cancellationError ? { cancellation_error: cancellationError } : {}),
        };
    }

    async apply(operationId: string) {
        parseOperationId(operationId);
        const operation = this.#operations.get(operationId);
        if (!operation) throw new Error(`Operation not found: ${operationId}`);
        if (!operation.applyHandler) {
            throw new Error(`Operation has no saved result to apply: ${operationId}`);
        }

        const alreadyApplied = operation.applyStatus === 'applied';
        const result = await this.#apply(operation);
        return {
            status: alreadyApplied ? 'already_applied' as const : 'applied' as const,
            operation_id: operationId,
            apply_result: result,
        };
    }

    async #apply(operation: ManagedOperation) {
        if (!operation.applyHandler) {
            throw new Error(`Operation has no saved result to apply: ${operation.id}`);
        }
        if (operation.applyStatus === 'applied') return operation.applyResult;

        operation.applyStatus = 'applying';
        operation.applyError = undefined;
        try {
            const result = await operation.applyHandler();
            operation.applyResult = result;
            operation.applyStatus = 'applied';
            return result;
        } catch (error) {
            if (operation.applyStatus === 'applied') return operation.applyResult;
            operation.applyStatus = 'failed';
            operation.applyError = errorMessage(error);
            throw error;
        }
    }

    #trim() {
        const finished = [...this.#operations.values()]
            .filter(operation => operation.status !== 'running')
            .sort((left, right) => left.createdAt - right.createdAt);
        while (this.#operations.size > RETAINED_OPERATION_LIMIT && finished.length) {
            this.#operations.delete(finished.shift()!.id);
        }
    }
}

export const operationManager = new OperationManager();
