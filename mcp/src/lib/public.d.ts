import type { API } from './api.mjs';
export type { API } from './api.mjs';
export * from './constants.mjs';
export * from './units.mjs';

/** Lazy remote call. Await it, or use Promise.all to coalesce calls automatically. */
export interface RemoteCall<T> extends PromiseLike<T> {}
export interface ConnectOptions {
    url?: string;
    instanceId?: string;
    /** Omit to bind the active document. null explicitly allows switching documents. */
    documentUuid?: string | null;
    timeoutMs?: number;
}
export interface EasyEdaInstance {
    instanceId: string;
    projectName: string;
    connectedAt: number;
    lastSeenAt: number;
}
export interface ExecuteJsOptions {
    code?: string;
    file_path?: string;
    inputs?: Record<string, string>;
    input_files?: Record<string, { path: string; encoding?: 'utf8' }>;
}
export declare class SdkError extends Error {
    checkpoint: string | null;
    outcomeUnknown: boolean;
    failedIndex?: number;
}
export declare class Session {
    private constructor();
    readonly id: string;
    readonly instanceId: string;
    readonly eda: API.EDA;
    readonly documentUuid: string | null;
    readonly lastCheckpoint: string | null;
    eval<T = unknown>(code: string, inputs?: unknown): Promise<T>;
    executeJs<T = unknown>(options: ExecuteJsOptions): Promise<T>;
    release(...objects: object[]): Promise<void>;
    beginCheckpointScope(name: string): Promise<CheckpointScope>;
    checkpointScope<T>(name: string, fn: (scope: CheckpointScope) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
export declare class CheckpointScope {
    private constructor();
    readonly eda: API.EDA;
    readonly checkpointId: string;
    close(): Promise<void>;
}
export declare function listInstances(options?: Pick<ConnectOptions, 'url'>): Promise<EasyEdaInstance[]>;
export declare function connect(options?: ConnectOptions): Promise<Session>;
