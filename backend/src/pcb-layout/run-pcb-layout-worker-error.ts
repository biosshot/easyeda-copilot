import { PlacementError } from "#pcb-layout/pcb-auto-place/auto-place.ts";
import type { PlacementReport } from "#types/pcb/layout-model.ts";
import { isNativeError } from 'node:util/types';

export type SerializedPcbLayoutWorkerError = {
    name: string;
    message: string;
    stack?: string;
    placementReport?: PlacementReport;
};

export type PcbLayoutWorkerResult<T> = {
    ok: true;
    run: T;
} | {
    ok: false;
    error: SerializedPcbLayoutWorkerError;
};

export function serializePcbLayoutWorkerError(error: unknown): SerializedPcbLayoutWorkerError {
    if (error instanceof PlacementError) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            placementReport: error.report,
        };
    }

    // DSL errors originate in node:vm and are not instanceof the host Error.
    if (error instanceof Error || isNativeError(error)) {
        return {
            name: error.name || "Error",
            message: error.message,
            stack: error.stack,
        };
    }

    return {
        name: "Error",
        message: typeof error === "string" ? error : JSON.stringify(error),
    };
}

export function deserializePcbLayoutWorkerError(error: SerializedPcbLayoutWorkerError): Error {
    if (error.name === "PlacementError" && error.placementReport) {
        const placementError = new PlacementError(error.message, error.placementReport);
        placementError.stack = error.stack;
        return placementError;
    }

    const result = new Error(error.message);
    result.name = error.name || "Error";
    result.stack = error.stack;
    return result;
}
