// Drop-in replacement for `eda.sch_PrimitiveWire` that keeps a local snapshot
// of every wire created/modified/deleted during schematic assembly.
//
// Why: `eda.sch_PrimitiveWire.getAll()` reads EasyEDA's asynchronous internal
// index, so wires can appear with a random delay (up to several seconds). By
// mirroring the API and updating our own cache synchronously we remove that
// latency and uncertainty.
//
// Scope: intended only for schematic assembly (assemble.ts / place-net.ts /
// rm-compoment-with-connections.ts / replacer.ts / free-place-searcher.ts /
// utils.ts). `schematic.ts` is intentionally left untouched.

import { normalizeWireLine, VERSION_EDASYEDA } from "./utils";

type WireLine = number[] | number[][];

interface WireSnapshot {
    primitiveId: string;
    net: string;
    line: WireLine;
    color?: string | null;
    lineWidth?: number | null;
    lineType?: ESCH_PrimitiveLineType | null;
}

const cache = new Map<string, WireSnapshot>();

let active = false;
let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
const TTL_MS = 5000;

function makeSnapshot(wire: ISCH_PrimitiveWire): WireSnapshot {
    return {
        primitiveId: wire.getState_PrimitiveId(),
        net: wire.getState_Net(),
        line: wire.getState_Line(),
    };
}

function setSnapshot(wire: ISCH_PrimitiveWire): void {
    const id = wire.getState_PrimitiveId?.();
    if (!id) return;
    cache.set(id, makeSnapshot(wire));
}

function snapshotToWire(snapshot: WireSnapshot): ISCH_PrimitiveWire {
    const snap = snapshot;
    const allowed = new Set<string | symbol>([
        "primitiveId",
        "line",
        "net",
        "getState_PrimitiveId",
        "getState_Line",
        "getState_Net",
        "done",
    ]);

    const impl = {
        primitiveId: snap.primitiveId,
        line: snap.line,
        net: snap.net,
        getState_PrimitiveId: () => snap.primitiveId,
        getState_Line: () => snap.line,
        getState_Net: () => snap.net,
        done: () => Promise.resolve(),
    };

    return new Proxy(impl, {
        get(target, prop) {

            if (!allowed.has(prop)) {
                eda.sys_Log.add(
                    `[wire-snap] Snapshot wire does not implement "${String(prop)}". ` +
                    `Only ${[...allowed].map(String).join(", ")} are available.`,
                    ESYS_LogType.WARNING
                );
            }

            return (target as any)[prop];
        },
    }) as unknown as ISCH_PrimitiveWire;
}

function wrapWire(wire: ISCH_PrimitiveWire): ISCH_PrimitiveWire {
    return new Proxy(wire, {
        get(target, prop) {
            const value = (target as any)[prop];
            if (prop === "done" && typeof value === "function") {
                return async (...args: unknown[]) => {
                    try {
                        const result = await value.apply(target, args);
                        // EasyEDA sometimes returns the committed primitive from done().
                        // Prefer that object because the original target may still be
                        // missing its primitiveId before the commit has finished.
                        const committed =
                            result &&
                                typeof result === "object" &&
                                typeof (result as any).getState_PrimitiveId === "function"
                                ? (result as ISCH_PrimitiveWire)
                                : target;
                        setSnapshot(committed);
                        return result;
                    } catch (err) {
                        // Still try to capture the current state; rethrow so callers' catch works.
                        setSnapshot(target);
                        throw err;
                    }
                };
            }
            return value;
        },
    }) as ISCH_PrimitiveWire;
}

function idsFromArg(
    arg: string | ISCH_PrimitiveWire | string[] | ISCH_PrimitiveWire[],
): string[] {
    if (Array.isArray(arg)) {
        return arg
            .map((item) =>
                typeof item === "string" ? item : item.getState_PrimitiveId?.(),
            )
            .filter((id): id is string => Boolean(id));
    }
    const id =
        typeof arg === "string" ? arg : arg.getState_PrimitiveId?.();
    return id ? [id] : [];
}

async function refresh(): Promise<void> {
    cache.clear();
    if (VERSION_EDASYEDA[0] < 3) {
        // v2 supports per-net getAll; for the cache we always fetch everything.
        const wires = await eda.sch_PrimitiveWire.getAll().catch(() => [] as ISCH_PrimitiveWire[]);
        for (const wire of wires) {
            setSnapshot(wire);
        }
    } else {
        const wires = await eda.sch_PrimitiveWire.getAll().catch(() => [] as ISCH_PrimitiveWire[]);
        for (const wire of wires) {
            setSnapshot(wire);
        }
    }
}

export const sch_PrimitiveWireSnap = {
    /**
     * Activate the cache. Must be called before any schematic assembly step
     * that reads or writes wires. It fetches the current wire state from EDA.
     */
    async activate(): Promise<void> {
        if (invalidateTimer) {
            clearTimeout(invalidateTimer);
            invalidateTimer = null;
        }
        await refresh();
        active = true;
    },

    /**
     * Deactivate the cache after schematic assembly. The cache is kept alive
     * for 5000 ms and then invalidated, so closely spaced assemblies can still
     * benefit from a recent snapshot while avoiding stale data later.
     */
    deactivate(): void {
        if (invalidateTimer) {
            clearTimeout(invalidateTimer);
        }
        invalidateTimer = setTimeout(() => {
            sch_PrimitiveWireSnap.invalidate();
        }, TTL_MS);
    },

    /**
     * Immediately clear the cache and mark the snap as inactive.
     */
    invalidate(): void {
        if (invalidateTimer) {
            clearTimeout(invalidateTimer);
            invalidateTimer = null;
        }
        cache.clear();
        active = false;
    },

    /**
     * Whether the cache is currently active.
     */
    isActive(): boolean {
        return active;
    },

    async create(
        line: number[] | number[][],
        net?: string,
        color?: string | null,
        lineWidth?: number | null,
        lineType?: ESCH_PrimitiveLineType | null,
    ): Promise<ISCH_PrimitiveWire | undefined> {
        const wire = await eda.sch_PrimitiveWire.create(line, net, color, lineWidth, lineType);
        if (!wire) return undefined;

        const id = wire.getState_PrimitiveId?.();
        if (id) {
            // Optimistic snapshot; will be refined when done() resolves.
            cache.set(id, {
                primitiveId: id,
                net: net ?? wire.getState_Net() ?? "",
                line,
                color,
                lineWidth,
                lineType,
            });
        }
        return wrapWire(wire);
    },

    async getAll(net?: string | string[]): Promise<ISCH_PrimitiveWire[]> {
        if (!active || cache.size === 0) {
            await refresh();
            active = true;
        }

        let snapshots = [...cache.values()];
        if (net !== undefined) {
            const nets = Array.isArray(net) ? net : [net];
            snapshots = snapshots.filter((s) => nets.includes(s.net));
        }
        return snapshots.map(snapshotToWire);
    },

    async get(primitiveIds: string): Promise<ISCH_PrimitiveWire | undefined> {
        if (cache.has(primitiveIds)) {
            return snapshotToWire(cache.get(primitiveIds)!);
        }
        const wire = await eda.sch_PrimitiveWire.get(primitiveIds).catch(() => undefined);
        if (wire) {
            setSnapshot(wire);
            return wrapWire(wire);
        }
        return undefined;
    },

    async modify(
        primitiveId: string | ISCH_PrimitiveWire,
        property: {
            line?: number[] | number[][];
            net?: string;
            color?: string | null;
            lineWidth?: number | null;
            lineType?: ESCH_PrimitiveLineType | null;
        },
    ): Promise<ISCH_PrimitiveWire | undefined> {
        const id =
            typeof primitiveId === "string"
                ? primitiveId
                : primitiveId.getState_PrimitiveId();

        const wire = await eda.sch_PrimitiveWire.modify(primitiveId, property);

        if (wire) {
            const returnedId = wire.getState_PrimitiveId?.();
            if (returnedId && returnedId !== id) {
                // The API may replace the primitive on a line change; drop the stale id.
                cache.delete(id);
            }

            // Make sure the modification is actually committed. EasyEDA's static
            // modify() sometimes returns an asynchronous object whose changes are
            // only applied after done() is called.
            await (wire as any).done?.().catch(() => undefined);

            setSnapshot(wire);
        }

        // Guarantee the cache reflects the values we asked to set. The object returned
        // by EasyEDA can be slightly behind the real committed state, and relying only
        // on it would leave the cache stale for the next schematic-assembly read.
        const finalId = wire?.getState_PrimitiveId?.() ?? id;
        const snap = cache.get(finalId);
        if (snap) {
            if (property.line !== undefined) snap.line = property.line;
            if (property.net !== undefined) snap.net = property.net;
            if (property.color !== undefined) snap.color = property.color;
            if (property.lineWidth !== undefined) snap.lineWidth = property.lineWidth;
            if (property.lineType !== undefined) snap.lineType = property.lineType;
        }

        return wire ? wrapWire(wire) : undefined;
    },

    async delete(
        primitiveIds:
            | string
            | ISCH_PrimitiveWire
            | string[]
            | ISCH_PrimitiveWire[],
    ): Promise<boolean> {
        if (
            primitiveIds === undefined ||
            primitiveIds === null ||
            (Array.isArray(primitiveIds) && primitiveIds.length === 0)
        ) {
            return false;
        }

        const result = await eda.sch_PrimitiveWire.delete(primitiveIds);
        if (result) {
            for (const id of idsFromArg(primitiveIds)) {
                cache.delete(id);
            }
        }
        return result;
    },
};
