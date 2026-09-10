import { assembleCircuit, deleteCopilotBlockBoxes } from './eda/assemble';
import { annotateDesignators } from './eda/annotate-designators';
import {
    applyRoutingCopper,
    assembleBoard,
    type RoutingCopperApplication,
} from './eda/pcb-assemble';
import { checkpointer } from './eda/checkpointer';
import { executeJavaScript } from './eda/execute-js';
import { checkPcbDrc } from './eda/drc';
import {
    getPcb,
    getPcbExistingPlacement,
    getPcbRaw,
    inspectComponent,
    inspectNet,
} from './eda/pcb';
import { getSchematic } from './eda/schematic';
import { estimateSchematicSheetSpace } from './eda/sheet-space';
import { rmPartFromDesignator, withTimeout } from './eda/utils';
import '@copilot/shared/types/eda';
import { ExplainCircuit } from '@copilot/shared/types/circuit';
import PQueue from 'p-queue';
import {
    type PcbDrcBundle,
    type PcbDrcDifferentialPairRule,
    type PcbDrcEqualLengthGroupRule,
    type PcbDrcNetClassRule,
    type PcbDrcNetRule,
    type PcbDrcNetRuleEntry,
} from '@copilot/shared/types/pcb/drc';

type DesiredDifferentialPair = {
    name: string;
    positiveNet: string;
    negativeNet: string;
};

type McpMessage = {
    event: string;
    body: string;
};

const MCP_WS_ID = 'easyeda-copilot-mcp';
const MCP_WS_URL = 'ws://127.0.0.1:8787';
const MCP_SCAN_INTERVAL_MS = 5000;
const MCP_CONNECT_TIMEOUT_MS = 2000;
const MCP_HEARTBEAT_INTERVAL_MS = 10000;
const MCP_HEARTBEAT_MAX_MISSES = 3;
const MCP_COMMAND_QUEUE_MAX_SIZE = 32;
const MCP_DEADLINE_FIELD = '__easyedaCopilotDeadlineAt';
const MCP_SCAN_TIMER_ID = 'easyeda-copilot-mcp-scan';
const MCP_HEARTBEAT_TIMER_ID = 'easyeda-copilot-mcp-heartbeat';
const MCP_CONNECT_TIMEOUT_TIMER_ID = 'easyeda-copilot-mcp-connect-timeout';
const RETAINED_ROUTING_APPLICATIONS = 20;

const mcpCommandQueue = new PQueue({ concurrency: 1 });
const routingApplicationCache = new Map<string, Promise<unknown>>();

type McpClientState = {
    instanceId: string;
    connectionEpoch: number;
    isRegistered: boolean;
    isConnecting: boolean;
    isScanEnabled: boolean;
    isUserPaused: boolean;
    isStartupInitialized: boolean;
    scanTimer?: ReturnType<typeof setInterval>;
    connectTimeout?: ReturnType<typeof setTimeout>;
    heartbeatTimer?: ReturnType<typeof setInterval>;
    heartbeatTimeout?: ReturnType<typeof setTimeout>;
    heartbeatAwaitingPong: boolean;
    heartbeatMisses: number;
};

function makeMcpInstanceId() {
    const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
    return `easyeda-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const state = ((eda as typeof eda & {
    __easyedaCopilotMcpState?: McpClientState;
}).__easyedaCopilotMcpState ??= {
    instanceId: makeMcpInstanceId(),
    connectionEpoch: 0,
    isRegistered: false,
    isConnecting: false,
    isScanEnabled: false,
    isUserPaused: false,
    isStartupInitialized: false,
    heartbeatAwaitingPong: false,
    heartbeatMisses: 0,
});

// Preserve compatibility with state created by an older extension bundle.
state.connectionEpoch ??= 0;
state.heartbeatAwaitingPong ??= false;
state.heartbeatMisses ??= 0;

function parseBody<T = Record<string, unknown>>(message: McpMessage): T {
    return message.body ? JSON.parse(message.body) as T : {} as T;
}

function send(event: string, body: Record<string, unknown>) {
    eda.sys_WebSocket.send(MCP_WS_ID, JSON.stringify({
        event,
        body: JSON.stringify(body),
    } satisfies McpMessage));
}

function setMcpIntervalTimer(id: string, timeout: number, callback: () => void) {
    try {
        if (eda.sys_Timer.setIntervalTimer(id, timeout, callback)) return undefined;
    } catch {
        // Fall back to the renderer timer when the EasyEDA system timer is unavailable.
    }

    return setInterval(callback, timeout);
}

function clearMcpIntervalTimer(id: string, fallbackTimer?: ReturnType<typeof setInterval>) {
    try {
        eda.sys_Timer.clearIntervalTimer(id);
    } catch {
        // The system timer may not exist in older EasyEDA builds.
    }

    if (fallbackTimer !== undefined) clearInterval(fallbackTimer);
}

function setMcpTimeoutTimer(id: string, timeout: number, callback: () => void) {
    try {
        if (eda.sys_Timer.setTimeoutTimer(id, timeout, callback)) return undefined;
    } catch {
        // Fall back to the renderer timer when the EasyEDA system timer is unavailable.
    }

    return setTimeout(callback, timeout);
}

function clearMcpTimeoutTimer(id: string, fallbackTimer?: ReturnType<typeof setTimeout>) {
    try {
        eda.sys_Timer.clearTimeoutTimer(id);
    } catch {
        // The system timer may not exist in older EasyEDA builds.
    }

    if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const BEAUTIFY_AUXILIARY_COMPONENT_TYPES = new Set<ESCH_PrimitiveComponentType>([
    ESCH_PrimitiveComponentType.NET_FLAG,
    ESCH_PrimitiveComponentType.NET_PORT,
    ESCH_PrimitiveComponentType.SHORT_CIRCUIT_FLAG,
    ESCH_PrimitiveComponentType.NET_LABEL,
    ESCH_PrimitiveComponentType.OFF_PAGE_CONNECTOR,
    ESCH_PrimitiveComponentType.DIFFERENTIAL_PAIRS_FLAG,
    ESCH_PrimitiveComponentType.CBB_SYMBOL,
]);

async function getBeautifyComponentIds(expectedDesignators: string[]) {
    const expected = new Set(expectedDesignators);
    const components = await eda.sch_PrimitiveComponent.getAll();

    return components.filter(component => {
        const componentType = component.getState_ComponentType();
        if (componentType === ESCH_PrimitiveComponentType.COMPONENT) {
            const designator = rmPartFromDesignator(component.getState_Designator?.() ?? '');
            return expected.has(designator);
        }

        return BEAUTIFY_AUXILIARY_COMPONENT_TYPES.has(componentType);
    }).map(component => component.getState_PrimitiveId());
}

async function waitForBeautifyComponents(expectedDesignators: string[], timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let missing = [...expectedDesignators];

    do {
        const components = await eda.sch_PrimitiveComponent.getAll(ESCH_PrimitiveComponentType.COMPONENT);
        const actualDesignators = new Set(components.map(component => (
            rmPartFromDesignator(component.getState_Designator())
        )));
        missing = expectedDesignators.filter(designator => !actualDesignators.has(designator));
        if (!missing.length) return;
        if (Date.now() >= deadline) break;
        await delay(500);
    } while (true);

    throw new Error(`Beautify assembly omitted components after waiting for EasyEDA: ${missing.join(', ')}`);
}

type BeautifyComponentIdentity = {
    designator: string;
    subPartName: string;
    uniqueId: string;
};

async function getBeautifyComponentIdentities(expectedDesignators: string[]) {
    const expected = new Set(expectedDesignators);
    const components = await eda.sch_PrimitiveComponent.getAll(ESCH_PrimitiveComponentType.COMPONENT);
    return components.flatMap(component => {
        const designator = rmPartFromDesignator(component.getState_Designator?.() ?? '');
        const uniqueId = component.getState_UniqueId();
        if (!expected.has(designator) || !uniqueId) return [];
        return [{
            designator,
            subPartName: component.getState_SubPartName?.() ?? '',
            uniqueId,
        } satisfies BeautifyComponentIdentity];
    });
}

async function restoreBeautifyComponentIdentities(saved: BeautifyComponentIdentity[]) {
    const components = await eda.sch_PrimitiveComponent.getAll(ESCH_PrimitiveComponentType.COMPONENT);
    const available = new Set(components);

    for (const identity of saved) {
        const component = [...available].find(candidate => (
            rmPartFromDesignator(candidate.getState_Designator?.() ?? '') === identity.designator
            && (candidate.getState_SubPartName?.() ?? '') === identity.subPartName
        )) ?? [...available].find(candidate => (
            rmPartFromDesignator(candidate.getState_Designator?.() ?? '') === identity.designator
        ));
        if (!component) {
            throw new Error(`Cannot restore Unique ID for beautified component ${identity.designator}`);
        }
        available.delete(component);
        component.setState_UniqueId(identity.uniqueId);
        await component.done();
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertDrcBundle(value: unknown): asserts value is PcbDrcBundle {
    if (!isRecord(value) || !isRecord(value.ruleConfiguration) || !Array.isArray(value.netRules)) {
        throw new Error('Invalid PCB DRC bundle. Expected { ruleConfiguration, netRules }.');
    }
}

function routingNumber(value: unknown, path: string, positive = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
        throw new Error(`Invalid routing application number: ${path}`);
    }
    return value;
}

function routingCopperLayerCount(value: unknown) {
    const count = routingNumber(value, 'copperLayerCount', true);
    if (!Number.isInteger(count) || count < 2 || count > 32 || count % 2 !== 0) {
        throw new Error('Invalid routing application copperLayerCount. Expected an even number from 2 to 32.');
    }
    return count;
}

function routingString(value: unknown, path: string) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid routing application string: ${path}`);
    }
    return value.trim();
}

function routingEnum<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw new Error(`Invalid routing application enum: ${path}`);
    }
    return value as T;
}

function routingPoint(value: unknown, path: string) {
    if (!Array.isArray(value) || value.length < 2) {
        throw new Error(`Invalid routing application point: ${path}`);
    }
    return {
        x: routingNumber(value[0], `${path}[0]`),
        y: routingNumber(value[1], `${path}[1]`),
    };
}

function readRoutingApplication(value: unknown): RoutingCopperApplication {
    if (!isRecord(value)) throw new Error('Invalid routing application payload.');
    const tracks = (Array.isArray(value.tracks) ? value.tracks : []).map((candidate, index) => {
        if (!isRecord(candidate)) throw new Error(`Invalid routing track: ${index}`);
        const points = (Array.isArray(candidate.points) ? candidate.points : [])
            .map((point, pointIndex) => routingPoint(point, `tracks[${index}].points[${pointIndex}]`));
        if (points.length < 2) throw new Error(`Routing track has fewer than two points: ${index}`);
        return {
            ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}),
            net: routingString(candidate.net, `tracks[${index}].net`),
            layer: routingNumber(candidate.layer, `tracks[${index}].layer`),
            widthMm: routingNumber(candidate.widthMm, `tracks[${index}].widthMm`, true),
            points,
        };
    });
    const vias = (Array.isArray(value.vias) ? value.vias : []).map((candidate, index) => {
        if (!isRecord(candidate)) throw new Error(`Invalid routing via: ${index}`);
        const at = routingPoint(candidate.location, `vias[${index}].location`);
        return {
            ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}),
            net: routingString(candidate.net, `vias[${index}].net`),
            x: at.x,
            y: at.y,
            diameterMm: routingNumber(candidate.diameterMm, `vias[${index}].diameterMm`, true),
            drillMm: routingNumber(candidate.drillMm, `vias[${index}].drillMm`, true),
        };
    });
    const zones = (Array.isArray(value.zones) ? value.zones : []).map((candidate, index) => {
        if (!isRecord(candidate)) throw new Error(`Invalid routing zone: ${index}`);
        if (Array.isArray(candidate.holes) && candidate.holes.length) {
            throw new Error(`Routing zone holes are not supported by EasyEDA apply: ${index}`);
        }
        const points = (Array.isArray(candidate.outline) ? candidate.outline : [])
            .map((point, pointIndex) => routingPoint(point, `zones[${index}].outline[${pointIndex}]`));
        if (points.length < 3) throw new Error(`Routing zone has fewer than three points: ${index}`);
        const layers = (Array.isArray(candidate.layers) ? candidate.layers : [])
            .map((layer, layerIndex) => routingNumber(layer, `zones[${index}].layers[${layerIndex}]`));
        if (!layers.length) throw new Error(`Routing zone has no layers: ${index}`);

        let fill: RoutingCopperApplication['zones'][number]['fill'];
        if (candidate.fill !== undefined) {
            if (!isRecord(candidate.fill)) throw new Error(`Invalid routing zone fill: ${index}`);
            fill = {
                style: routingEnum(candidate.fill.style, ['solid', 'hatched'] as const, `zones[${index}].fill.style`),
                ...(candidate.fill.hatchThicknessMm === undefined ? {} : {
                    hatchThicknessMm: routingNumber(
                        candidate.fill.hatchThicknessMm,
                        `zones[${index}].fill.hatchThicknessMm`,
                        true,
                    ),
                }),
                ...(candidate.fill.hatchGapMm === undefined ? {} : {
                    hatchGapMm: routingNumber(candidate.fill.hatchGapMm, `zones[${index}].fill.hatchGapMm`, true),
                }),
                ...(candidate.fill.hatchOrientationDeg === undefined ? {} : {
                    hatchOrientationDeg: routingNumber(
                        candidate.fill.hatchOrientationDeg,
                        `zones[${index}].fill.hatchOrientationDeg`,
                    ),
                }),
            };
        }

        let padConnection: RoutingCopperApplication['zones'][number]['padConnection'];
        if (candidate.padConnection !== undefined) {
            if (!isRecord(candidate.padConnection)) {
                throw new Error(`Invalid routing zone padConnection: ${index}`);
            }
            padConnection = {
                mode: routingEnum(
                    candidate.padConnection.mode,
                    ['solid', 'thermal', 'none'] as const,
                    `zones[${index}].padConnection.mode`,
                ),
                ...(candidate.padConnection.thermalGapMm === undefined ? {} : {
                    thermalGapMm: routingNumber(
                        candidate.padConnection.thermalGapMm,
                        `zones[${index}].padConnection.thermalGapMm`,
                        true,
                    ),
                }),
                ...(candidate.padConnection.spokeWidthMm === undefined ? {} : {
                    spokeWidthMm: routingNumber(
                        candidate.padConnection.spokeWidthMm,
                        `zones[${index}].padConnection.spokeWidthMm`,
                        true,
                    ),
                }),
                ...(candidate.padConnection.spokeCount === undefined ? {} : {
                    spokeCount: routingNumber(
                        candidate.padConnection.spokeCount,
                        `zones[${index}].padConnection.spokeCount`,
                        true,
                    ),
                }),
                ...(candidate.padConnection.spokeAngleDeg === undefined ? {} : {
                    spokeAngleDeg: routingNumber(
                        candidate.padConnection.spokeAngleDeg,
                        `zones[${index}].padConnection.spokeAngleDeg`,
                    ),
                }),
            };
        }

        const removeIslandsBelowMm2 = candidate.removeIslandsBelowMm2 === undefined
            ? undefined
            : routingNumber(candidate.removeIslandsBelowMm2, `zones[${index}].removeIslandsBelowMm2`);
        if (removeIslandsBelowMm2 !== undefined && removeIslandsBelowMm2 < 0) {
            throw new Error(`Invalid routing zone island threshold: ${index}`);
        }

        return {
            ...(typeof candidate.id === 'string' ? { id: candidate.id } : {}),
            net: routingString(candidate.net, `zones[${index}].net`),
            layers,
            points,
            ...(typeof candidate.priority === 'number'
                ? { priority: routingNumber(candidate.priority, `zones[${index}].priority`) }
                : {}),
            ...(typeof candidate.minThicknessMm === 'number'
                ? { minThicknessMm: routingNumber(candidate.minThicknessMm, `zones[${index}].minThicknessMm`, true) }
                : {}),
            ...(candidate.clearanceMm === undefined ? {} : {
                clearanceMm: routingNumber(candidate.clearanceMm, `zones[${index}].clearanceMm`, true),
            }),
            ...(candidate.connection === undefined ? {} : {
                connection: routingEnum(
                    candidate.connection,
                    ['solid', 'thermal', 'none'] as const,
                    `zones[${index}].connection`,
                ),
            }),
            ...(fill ? { fill } : {}),
            ...(padConnection ? { padConnection } : {}),
            ...(removeIslandsBelowMm2 === undefined ? {} : { removeIslandsBelowMm2 }),
        };
    });

    let clearRouting: RoutingCopperApplication['clearRouting'];
    if (value.clearRouting !== undefined) {
        if (!isRecord(value.clearRouting)) throw new Error('Invalid clearRouting payload.');
        const scopes: NonNullable<RoutingCopperApplication['clearRouting']> = {};
        for (const item of ['tracks', 'vias', 'zones'] as const) {
            const rawNets = value.clearRouting[item];
            if (rawNets === undefined) continue;
            const nets = rawNets === 'all'
                ? 'all' as const
                : Array.isArray(rawNets)
                    ? rawNets.map((net, index) => routingString(net, `clearRouting.${item}[${index}]`))
                    : undefined;
            if (!nets || (Array.isArray(nets) && !nets.length)) {
                throw new Error(`Invalid clearRouting ${item} scope.`);
            }
            scopes[item] = nets;
        }
        if (!Object.keys(scopes).length) throw new Error('Invalid empty clearRouting payload.');
        clearRouting = scopes;
    }
    const copperLayerCount = value.copperLayerCount === undefined
        ? undefined
        : routingCopperLayerCount(value.copperLayerCount);
    return {
        ...(copperLayerCount === undefined ? {} : { copperLayerCount }),
        ...(clearRouting ? { clearRouting } : {}),
        tracks,
        vias,
        zones,
    };
}

function formatPath(path: Array<string | number>) {
    return path.map(part => typeof part === 'number'
        ? `[${part}]`
        : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)
            ? `.${part}`
            : `[${JSON.stringify(part)}]`
    ).join('').replace(/^\./, '');
}

function rawLayerName(raw: number | string) {
    if (typeof raw === 'string') return raw;
    return EPCB_LayerId[raw] ?? String(raw);
}

async function getPcbStackLayers() {
    const [allLayers, copperLayerCount] = await Promise.all([
        eda.pcb_Layer.getAllLayers().catch(() => []),
        eda.pcb_Layer.getTheNumberOfCopperLayers().catch(() => undefined),
    ]);
    const layers = allLayers
        .filter(l => l.layerStatus && l.type === EPCB_LayerType.SIGNAL)
        .map(l => ({
            id: l.id,
            layer: rawLayerName(l.id),
            name: l.name,
            type: l.type,
            status: l.layerStatus,
            locked: l.locked,
        }));

    return {
        copperLayerCount,
        layers,
    };
}

type DesiredNamedNetGroup = { name: string; nets: string[]; };

const GENERATED_PRESET_FIELDS = [
    'Track', 'Via Size', 'Safe Spacing', 'Differential Pair', 'Net Length Tolerance',
    'Copper Zone', 'Copper Safe Spacing',
] as const;

function asNetRuleEntries(value: unknown): PcbDrcNetRuleEntry[] {
    if (!Array.isArray(value)) throw new Error('EasyEDA returned malformed net rules.');
    for (const item of value) {
        if (!isRecord(item) || typeof item.type !== 'string' || typeof item.name !== 'string') {
            throw new Error('EasyEDA returned malformed net rule data.');
        }
    }
    return structuredClone(value) as PcbDrcNetRuleEntry[];
}

async function exportRoutingInput() {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const file = await eda.pcb_ManufactureData.getAutoRouteJsonFile('Copilot_Routing_Input');
            const text = file ? await file.text() : '';
            if (file && text.trim()) return { file, text };
            lastError = new Error('EasyEDA returned empty autoroute JSON file');
        } catch (error) {
            lastError = error;
        }
        if (attempt < 2) {
            await eda.pcb_Document.startCalculatingRatline().catch(() => false);
            await delay(150 * (attempt + 1));
        }
    }
    throw new Error(
        `EasyEDA returned empty autoroute JSON file after 3 attempts${lastError instanceof Error ? `: ${lastError.message}` : ''}`,
    );
}

function netRuleTemplate(netRules: readonly PcbDrcNetRuleEntry[], name: string): PcbDrcNetRule {
    for (const rule of netRules) {
        if (rule.type === 'net' && rule.name === name) return structuredClone(rule);
        if (rule.type !== 'net') {
            const child = rule.sub.find(item => item.name === name);
            if (child) return structuredClone(child);
        }
    }
    return { type: 'net', name };
}

function injectNamedGroups(
    netRules: PcbDrcNetRuleEntry[],
    groups: readonly DesiredNamedNetGroup[],
    type: 'netClass' | 'equalLengthGroup',
) {
    for (const group of groups) {
        let rule = netRules.find(item => item.type === type && item.name === group.name) as
            PcbDrcNetClassRule | PcbDrcEqualLengthGroupRule | undefined;
        if (!rule) {
            rule = { type, name: group.name, sub: [] } as PcbDrcNetClassRule | PcbDrcEqualLengthGroupRule;
            netRules.push(rule);
        }
        const current = new Map(rule.sub.map(item => [item.name, item]));
        rule.sub = group.nets.map(name => structuredClone(current.get(name) ?? netRuleTemplate(netRules, name)));
    }
}

function injectDifferentialPairsIntoNetRules(
    netRules: PcbDrcNetRuleEntry[],
    differentialPairs: readonly DesiredDifferentialPair[],
) {
    for (const pair of differentialPairs) {
        let rule = netRules.find(item => item.type === 'differentialPair' && item.name === pair.name) as
            PcbDrcDifferentialPairRule | undefined;
        if (!rule) {
            rule = {
                type: 'differentialPair', name: pair.name,
                positiveNet: pair.positiveNet, negativeNet: pair.negativeNet,
                sub: [],
            };
            netRules.push(rule);
        }
        rule.positiveNet = pair.positiveNet;
        rule.negativeNet = pair.negativeNet;
        rule.sub = [pair.positiveNet, pair.negativeNet].map(name => ({ type: 'net', name }));
    }
    return netRules;
}

function normalizeDifferentialPairArray(value: unknown[]) {
    return value.map(pair => {
        if (
            !isRecord(pair)
            || typeof pair.name !== 'string'
            || typeof pair.positiveNet !== 'string'
            || typeof pair.negativeNet !== 'string'
        ) {
            throw new Error('EasyEDA returned malformed differential pair data.');
        }

        return {
            name: pair.name,
            positiveNet: pair.positiveNet,
            negativeNet: pair.negativeNet,
        };
    });
}

function normalizeDifferentialPairs(value: unknown) {
    if (Array.isArray(value)) {
        return normalizeDifferentialPairArray(value);
    }

    if (isRecord(value)) {
        for (const key of ['differentialPairs', 'pairs', 'items', 'list', 'data']) {
            const candidate = value[key];
            if (Array.isArray(candidate)) {
                return normalizeDifferentialPairArray(candidate);
            }
        }

        const values = Object.values(value);
        if (values.length && values.every(item => isRecord(item) && typeof item.name === 'string')) {
            return normalizeDifferentialPairArray(values);
        }
    }

    throw new Error('EasyEDA getAllDifferentialPairs() returned unsupported data.');
}

function normalizeNamedNetGroups(value: unknown, source: string): DesiredNamedNetGroup[] {
    if (!Array.isArray(value)) {
        throw new Error(`EasyEDA ${source} returned unsupported data.`);
    }

    return value.map(item => {
        if (
            !isRecord(item)
            || typeof item.name !== 'string'
            || !Array.isArray(item.nets)
            || !item.nets.every(net => typeof net === 'string' && net.length > 0)
        ) {
            throw new Error(`EasyEDA returned malformed ${source} data.`);
        }

        return { name: item.name, nets: [...new Set(item.nets as string[])] };
    });
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.length === sortedRight.length
        && sortedLeft.every((item, index) => item === sortedRight[index]);
}

async function reconcileNamedNetGroups(options: {
    kind: string;
    desired: readonly DesiredNamedNetGroup[];
    read: () => Promise<unknown>;
    create: (name: string, nets: string[]) => Promise<boolean>;
    remove: (name: string) => Promise<boolean>;
}) {
    const seen = new Set<string>();
    for (const item of options.desired) {
        if (seen.has(item.name)) throw new Error(`Duplicate ${options.kind} name: ${item.name}`);
        seen.add(item.name);
    }

    const existing = normalizeNamedNetGroups(await options.read(), options.kind);
    const desiredByName = new Map(options.desired.map(item => [item.name, item]));
    const existingByName = new Map(existing.map(item => [item.name, item]));
    const changedNames = new Set<string>();
    const result = {
        created: [] as string[],
        deleted: [] as string[],
        updated: [] as string[],
        unchanged: [] as string[],
    };

    for (const item of existing) {
        const desired = desiredByName.get(item.name);
        const changed = desired !== undefined && !sameStringSet(item.nets, desired.nets);
        if (desired && !changed) {
            result.unchanged.push(item.name);
            continue;
        }

        const success = await options.remove(item.name);
        if (!success) throw new Error(`Failed to delete ${options.kind}: ${item.name}`);
        if (changed) changedNames.add(item.name);
        else result.deleted.push(item.name);
    }

    for (const desired of options.desired) {
        if (existingByName.has(desired.name) && !changedNames.has(desired.name)) continue;
        const success = await options.create(desired.name, [...desired.nets]);
        if (!success) throw new Error(`Failed to create ${options.kind}: ${desired.name}`);
        if (changedNames.has(desired.name)) result.updated.push(desired.name);
        else result.created.push(desired.name);
    }

    return result;
}

function relationKey(rule: PcbDrcNetRuleEntry) {
    return `${rule.type}\u0000${rule.name}`;
}

function generatedAssignments(rule: PcbDrcNetRuleEntry | PcbDrcNetRule) {
    return GENERATED_PRESET_FIELDS.flatMap(field => {
        const value = rule[field];
        return typeof value === 'string' && value.startsWith('copilot_router_') ? [[field, value] as const] : [];
    });
}

function collectRuleReadBackIssues(desired: PcbDrcNetRuleEntry, actual: PcbDrcNetRuleEntry) {
    const issues: string[] = [];
    if (desired.type !== actual.type || desired.name !== actual.name) {
        return [`EasyEDA did not persist DRC scope: ${desired.type} ${desired.name}.`];
    }
    for (const [field, value] of generatedAssignments(desired)) if (actual[field] !== value) {
        issues.push(`EasyEDA did not persist ${field} preset for ${desired.type} ${desired.name}.`);
    }
    if (desired.type === 'net') return issues;
    if (actual.type === 'net' || !sameStringSet(desired.sub.map(item => item.name), actual.sub.map(item => item.name))) {
        issues.push(`EasyEDA did not persist members for ${desired.type} ${desired.name}.`);
        return issues;
    }
    const actualMembers = new Map(actual.sub.map(item => [item.name, item]));
    for (const member of desired.sub) {
        const found = actualMembers.get(member.name);
        if (!found) {
            issues.push(`EasyEDA did not persist member ${member.name} in ${desired.type} ${desired.name}.`);
            continue;
        }
        for (const [field, value] of generatedAssignments(member)) if (found[field] !== value) {
            issues.push(`EasyEDA did not persist ${field} preset for ${desired.type} ${desired.name}/${member.name}.`);
        }
    }
    if (desired.type === 'differentialPair' && actual.type === 'differentialPair' && (
        desired.positiveNet !== actual.positiveNet || desired.negativeNet !== actual.negativeNet
    )) issues.push(`EasyEDA did not persist differential pair terminals for ${desired.name}.`);
    return issues;
}

function collectDrcReadBackIssues(desired: PcbDrcBundle, actual: PcbDrcBundle) {
    const issues: string[] = [];
    const actualByKey = new Map(actual.netRules.map(rule => [relationKey(rule), rule]));
    for (const rule of desired.netRules) {
        const found = actualByKey.get(relationKey(rule));
        if (!found) issues.push(`EasyEDA did not persist DRC scope: ${rule.type} ${rule.name}.`);
        else issues.push(...collectRuleReadBackIssues(rule, found));
    }
    return issues;
}

async function inspectPcbDrcReadBack(desired: PcbDrcBundle) {
    try {
        const bundle = await exportPcbDrcRules();
        const issues = collectDrcReadBackIssues(desired, bundle);
        return { persisted: issues.length === 0, issues, bundle };
    } catch (error) {
        return {
            persisted: false,
            issues: [`EasyEDA DRC read-back was unavailable: ${error instanceof Error ? error.message : String(error)}`],
        };
    }
}

async function reconcileDifferentialPairs(desiredPairs: DesiredDifferentialPair[]) {
    const seen = new Set<string>();

    for (const pair of desiredPairs) {
        if (seen.has(pair.name)) {
            throw new Error(`Duplicate differential pair name: ${pair.name}`);
        }
        seen.add(pair.name);
    }

    const existingPairs = normalizeDifferentialPairs(await eda.pcb_Drc.getAllDifferentialPairs());
    const desiredByName = new Map(desiredPairs.map(pair => [pair.name, pair]));
    const existingByName = new Map(existingPairs.map(pair => [pair.name, pair]));
    const result = {
        created: [] as string[],
        deleted: [] as string[],
        updated: [] as string[],
        unchanged: [] as string[],
    };

    for (const existing of existingPairs) {
        if (desiredByName.has(existing.name)) continue;

        const success = await eda.pcb_Drc.deleteDifferentialPair(existing.name);
        if (!success) throw new Error(`Failed to delete differential pair: ${existing.name}`);
        result.deleted.push(existing.name);
    }

    for (const desired of desiredPairs) {
        const existing = existingByName.get(desired.name);

        if (!existing) {
            const success = await eda.pcb_Drc.createDifferentialPair(desired.name, desired.positiveNet, desired.negativeNet);
            if (!success) throw new Error(`Failed to create differential pair: ${desired.name}`);
            result.created.push(desired.name);
            continue;
        }

        const changed = existing.positiveNet !== desired.positiveNet || existing.negativeNet !== desired.negativeNet;
        if (!changed) {
            result.unchanged.push(desired.name);
            continue;
        }

        const shouldRecreate = existing.positiveNet !== desired.positiveNet
            && existing.negativeNet !== desired.negativeNet;

        if (shouldRecreate) {
            const deleted = await eda.pcb_Drc.deleteDifferentialPair(desired.name);
            if (!deleted) throw new Error(`Failed to recreate differential pair: ${desired.name}`);

            const created = await eda.pcb_Drc.createDifferentialPair(desired.name, desired.positiveNet, desired.negativeNet);
            if (!created) throw new Error(`Failed to recreate differential pair: ${desired.name}`);

            result.updated.push(desired.name);
            continue;
        }

        if (existing.positiveNet !== desired.positiveNet) {
            const success = await eda.pcb_Drc.modifyDifferentialPairPositiveNet(desired.name, desired.positiveNet);
            if (!success) throw new Error(`Failed to update positive net for differential pair: ${desired.name}`);
        }

        if (existing.negativeNet !== desired.negativeNet) {
            const success = await eda.pcb_Drc.modifyDifferentialPairNegativeNet(desired.name, desired.negativeNet);
            if (!success) throw new Error(`Failed to update negative net for differential pair: ${desired.name}`);
        }

        result.updated.push(desired.name);
    }

    return result;
}

async function exportPcbDrcRules(): Promise<PcbDrcBundle> {
    const ruleConfiguration = await eda.pcb_Drc.getCurrentRuleConfiguration();
    if (!ruleConfiguration) throw new Error('Failed to read current PCB DRC rule configuration.');

    const [netRules, rawNetClasses, rawDifferentialPairs, rawEqualLengthGroups] = await Promise.all([
        eda.pcb_Drc.getNetRules(),
        eda.pcb_Drc.getAllNetClasses(),
        eda.pcb_Drc.getAllDifferentialPairs(),
        eda.pcb_Drc.getAllEqualLengthNetGroups(),
    ]);
    const netClasses = normalizeNamedNetGroups(rawNetClasses, 'getAllNetClasses()');
    const differentialPairs = normalizeDifferentialPairs(rawDifferentialPairs);
    const equalLengthGroups = normalizeNamedNetGroups(rawEqualLengthGroups, 'getAllEqualLengthNetGroups()');
    const normalizedNetRules = asNetRuleEntries(netRules);
    injectNamedGroups(normalizedNetRules, netClasses, 'netClass');
    injectNamedGroups(normalizedNetRules, equalLengthGroups, 'equalLengthGroup');
    injectDifferentialPairsIntoNetRules(normalizedNetRules, differentialPairs);

    return {
        ruleConfiguration: ruleConfiguration.config,
        netRules: normalizedNetRules,
    };
}

function extractNetClasses(netRules: readonly PcbDrcNetRuleEntry[]): DesiredNamedNetGroup[] {
    return netRules.filter((rule): rule is PcbDrcNetClassRule => rule.type === 'netClass')
        .map(rule => ({ name: rule.name, nets: rule.sub.map(item => item.name) }));
}

function extractEqualLengthGroups(netRules: readonly PcbDrcNetRuleEntry[]): DesiredNamedNetGroup[] {
    return netRules.filter((rule): rule is PcbDrcEqualLengthGroupRule => rule.type === 'equalLengthGroup')
        .map(rule => ({ name: rule.name, nets: rule.sub.map(item => item.name) }));
}

function extractDifferentialPairs(netRules: readonly PcbDrcNetRuleEntry[]): DesiredDifferentialPair[] {
    return netRules.filter((rule): rule is PcbDrcDifferentialPairRule => rule.type === 'differentialPair')
        .map(rule => ({ name: rule.name, positiveNet: rule.positiveNet, negativeNet: rule.negativeNet }));
}

function mergeNetRuleTrees(nativeRules: readonly PcbDrcNetRuleEntry[], desiredRules: readonly PcbDrcNetRuleEntry[]) {
    const nativeByKey = new Map(nativeRules.map(rule => [relationKey(rule), rule]));
    return desiredRules.map(desired => {
        const native = nativeByKey.get(relationKey(desired));
        if (!native || desired.type === 'net' || native.type === 'net') return { ...native, ...structuredClone(desired) } as PcbDrcNetRuleEntry;
        const nativeMembers = new Map(native.sub.map(item => [item.name, item]));
        return {
            ...native,
            ...structuredClone(desired),
            sub: desired.sub.map(member => ({ ...nativeMembers.get(member.name), ...structuredClone(member) })),
        } as PcbDrcNetRuleEntry;
    });
}

async function applyPcbDrcRules(bundle: PcbDrcBundle) {
    const netClasses = extractNetClasses(bundle.netRules);
    const differentialPairs = extractDifferentialPairs(bundle.netRules);
    const equalLengthGroups = extractEqualLengthGroups(bundle.netRules);

    const ruleConfiguration = await eda.pcb_Drc.overwriteCurrentRuleConfiguration(bundle.ruleConfiguration);
    if (!ruleConfiguration) throw new Error('Failed to overwrite current PCB DRC rule configuration.');

    const netClassResult = await reconcileNamedNetGroups({
        kind: 'net class',
        desired: netClasses,
        read: () => eda.pcb_Drc.getAllNetClasses(),
        create: (name, nets) => eda.pcb_Drc.createNetClass(name, nets, null),
        remove: name => eda.pcb_Drc.deleteNetClass(name),
    });
    const differentialPairResult = await reconcileDifferentialPairs(differentialPairs);
    const equalLengthGroupResult = await reconcileNamedNetGroups({
        kind: 'equal-length net group',
        desired: equalLengthGroups,
        read: () => eda.pcb_Drc.getAllEqualLengthNetGroups(),
        create: (name, nets) => eda.pcb_Drc.createEqualLengthNetGroup(name, nets, null),
        remove: name => eda.pcb_Drc.deleteEqualLengthNetGroup(name),
    });

    const nativeRules = asNetRuleEntries(await eda.pcb_Drc.getNetRules());
    const finalNetRules = mergeNetRuleTrees(nativeRules, bundle.netRules);
    const netRules = await eda.pcb_Drc.overwriteNetRules(finalNetRules);
    if (!netRules) throw new Error('Failed to overwrite PCB net rules.');
    const verification = await inspectPcbDrcReadBack({ ...bundle, netRules: finalNetRules });

    return {
        applied: true,
        ruleConfiguration,
        netRules,
        netRuleScopes: finalNetRules.length,
        netClasses: netClassResult,
        differentialPairs: differentialPairResult,
        equalLengthGroups: equalLengthGroupResult,
        verification: {
            persisted: verification.persisted,
            issues: verification.issues,
            netClasses: verification.bundle ? extractNetClasses(verification.bundle.netRules).length : undefined,
            differentialPairs: verification.bundle ? extractDifferentialPairs(verification.bundle.netRules).length : undefined,
            equalLengthGroups: verification.bundle ? extractEqualLengthGroups(verification.bundle.netRules).length : undefined,
        },
    };
}

async function routingTransactionStep<T>(stage: string, action: () => Promise<T>) {
    try {
        return await action();
    } catch (error) {
        throw new Error(
            `Routing transaction ${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

function isSaveableDocumentType(documentType: EDMT_EditorDocumentType) {
    return documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE
        || documentType === EDMT_EditorDocumentType.PCB
        || documentType === EDMT_EditorDocumentType.PANEL;
}

async function saveActiveDocument(documentType: EDMT_EditorDocumentType) {
    if (documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        return eda.sch_Document.save();
    }

    if (documentType === EDMT_EditorDocumentType.PCB) {
        return eda.pcb_Document.save();
    }

    if (documentType === EDMT_EditorDocumentType.PANEL) {
        return eda.pnl_Document.save();
    }

    throw new Error(`Unsupported document type for saving: ${documentType}`);
}

async function saveCurrentDocument(document: IDMT_EditorDocumentItem) {
    return saveActiveDocument(document.documentType);
}

async function syncCurrentDocument(settleMs = 500) {
    const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!document) throw new Error('Current document info not found');

    const saved = await saveCurrentDocument(document);
    if (!saved) throw new Error(`Failed to save current document: ${document.uuid}`);

    const closed = await eda.dmt_EditorControl.closeDocument(document.tabId || document.uuid);
    if (!closed) throw new Error(`Failed to close current document: ${document.uuid}`);

    await delay(settleMs);
    const tabId = await eda.dmt_EditorControl.openDocument(document.uuid);
    if (!tabId) throw new Error(`Failed to reopen current document: ${document.uuid}`);
    await delay(settleMs);

    return {
        document_uuid: document.uuid,
        document_type: document.documentType,
        saved,
        closed,
        settle_ms: settleMs,
    };
}

function getOpenEditorTabs(tree: IDMT_EditorSplitScreenItem | undefined): IDMT_EditorTabItem[] {
    if (!tree) return [];
    return [
        ...(tree.tabs ?? []),
        ...(tree.children ?? []).flatMap(getOpenEditorTabs),
    ];
}

async function saveAllOpenDocuments() {
    const originalDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
    const splitScreenTree = await eda.dmt_EditorControl.getSplitScreenTree();
    const seenTabIds = new Set<string>();
    const tabs = getOpenEditorTabs(splitScreenTree).filter(tab => {
        if (!isSaveableDocumentType(tab.documentType) || seenTabIds.has(tab.tabId)) return false;
        seenTabIds.add(tab.tabId);
        return true;
    });

    if (!tabs.length && originalDocument && isSaveableDocumentType(originalDocument.documentType)) {
        const saved = await saveCurrentDocument(originalDocument);
        if (!saved) throw new Error(`Failed to save current document: ${originalDocument.uuid}`);
        return [{
            document_uuid: originalDocument.uuid,
            document_type: originalDocument.documentType,
        }];
    }

    const savedDocuments: Array<{
        document_uuid: string;
        title: string;
        document_type: EDMT_EditorDocumentType;
    }> = [];

    try {
        for (const tab of tabs) {
            const activated = await eda.dmt_EditorControl.activateDocument(tab.tabId);
            if (!activated) throw new Error(`Failed to activate document before saving: ${tab.title}`);
            await delay(50);

            const saved = await saveActiveDocument(tab.documentType);
            if (!saved) throw new Error(`Failed to save document before switching projects: ${tab.title}`);
            savedDocuments.push({
                document_uuid: tab.uuid,
                title: tab.title,
                document_type: tab.documentType,
            });
        }
    } finally {
        if (originalDocument?.tabId) {
            await eda.dmt_EditorControl.activateDocument(originalDocument.tabId).catch(() => false);
        }
    }

    return savedDocuments;
}

function clearHeartbeatTimeout() {
    if (!state.heartbeatTimeout) return;
    clearTimeout(state.heartbeatTimeout);
    state.heartbeatTimeout = undefined;
}

function stopHeartbeat() {
    clearMcpIntervalTimer(MCP_HEARTBEAT_TIMER_ID, state.heartbeatTimer);
    state.heartbeatTimer = undefined;

    clearHeartbeatTimeout();
    state.heartbeatAwaitingPong = false;
    state.heartbeatMisses = 0;
}

function markMcpDisconnected(reason: string) {
    if (!state.isRegistered && !state.isConnecting) return;

    state.connectionEpoch++;
    state.isRegistered = false;
    state.isConnecting = false;
    mcpCommandQueue.clear();
    clearConnectTimeout();
    stopHeartbeat();
    closeMcpSocket(reason);
    eda.sys_Log.add(`MCP disconnected: ${reason}`, ESYS_LogType.WARNING);
}

function sendHeartbeatPing(connectionEpoch: number) {
    if (connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;

    if (state.heartbeatAwaitingPong) {
        state.heartbeatMisses++;
        if (state.heartbeatMisses >= MCP_HEARTBEAT_MAX_MISSES) {
            markMcpDisconnected(`heartbeat missed ${state.heartbeatMisses} times`);
            return;
        }
    }

    clearHeartbeatTimeout();
    state.heartbeatAwaitingPong = true;

    try {
        send('ping', { ts: Date.now() });
    } catch (error) {
        markMcpDisconnected(`heartbeat send failed: ${(error as Error).message}`);
        return;
    }
}

function startHeartbeat(connectionEpoch: number) {
    stopHeartbeat();
    sendHeartbeatPing(connectionEpoch);
    state.heartbeatTimer = setMcpIntervalTimer(
        MCP_HEARTBEAT_TIMER_ID,
        MCP_HEARTBEAT_INTERVAL_MS,
        () => sendHeartbeatPing(connectionEpoch),
    );
}

async function getProjectInfo() {
    const projectInfo = await eda.dmt_Project.getCurrentProjectInfo();
    if (!projectInfo) throw new Error('Current project info not found');

    const project_data = [];

    const filterSchPage = (page: IDMT_SchematicPageItem) => {
        return {
            name: page.name,
            itemType: page.itemType,
            uuid: page.uuid
        }
    };

    const filterSch = (sch: IDMT_SchematicItem) => {
        return {
            name: sch.name,
            itemType: sch.itemType,
            page: sch.page.map(filterSchPage),
            uuid: sch.uuid
        }
    };

    for (const item of projectInfo.data) {
        if (item.itemType === EDMT_ItemType.BOARD) {

            project_data.push({
                name: item.name,
                itemType: item.itemType,
                schematic: filterSch(item.schematic),
                pcb: {
                    name: item.pcb.name,
                    itemType: item.pcb.itemType,
                    uuid: item.pcb.uuid,
                    parentBoardName: item.pcb.parentBoardName
                },
            })
        }
        else if (item.itemType === EDMT_ItemType.SCHEMATIC) {
            project_data.push({
                name: item.name,
                itemType: item.itemType,
                page: filterSch(item).page,
                uuid: item.uuid,
                parentBoardUuid: item.parentBoardUuid
            })
        }
        else if (item.itemType === EDMT_ItemType.PCB) {
            project_data.push({
                name: item.name,
                itemType: item.itemType,
                uuid: item.uuid,
                parentBoardName: item.parentBoardName
            })
        }
    }

    return {
        project_data,
        project_name: projectInfo.friendlyName,
        description: projectInfo.description
    };
}

type ProjectTreeFolder = {
    type: 'folder';
    uuid: string;
    name: string;
    folders: ProjectTreeFolder[];
    projects: ProjectTreeProject[];
};

type ProjectTreeProject = {
    type: 'project';
    uuid: string;
    name: string;
};

type ProjectTreeTeam = {
    type: 'team';
    uuid: string;
    name: string;
    folders: ProjectTreeFolder[];
    projects: ProjectTreeProject[];
};

async function getAllProjectsTree(): Promise<ProjectTreeTeam[]> {
    const teams = await eda.dmt_Team.getAllTeamsInfo();
    const result: ProjectTreeTeam[] = [];

    for (const team of teams) {
        const folderUuids = await eda.dmt_Folder.getAllFoldersUuid(team.uuid);
        const projectUuids = await eda.dmt_Project.getAllProjectsUuid(team.uuid);
        const folders: IDMT_FolderItem[] = [];
        const projects: IDMT_BriefProjectItem[] = [];

        for (const uuid of folderUuids) {
            const folder = await eda.dmt_Folder.getFolderInfo(team.uuid, uuid);
            if (folder) folders.push(folder);
        }

        for (const uuid of projectUuids) {
            const project = await eda.dmt_Project.getProjectInfo(uuid);
            if (project) projects.push(project);
        }

        const folderMap = new Map<string, ProjectTreeFolder>();
        for (const folder of folders) {
            folderMap.set(folder.uuid, {
                type: 'folder',
                uuid: folder.uuid,
                name: folder.name,
                folders: [],
                projects: [],
            });
        }

        const root: ProjectTreeTeam = {
            type: 'team',
            uuid: team.uuid,
            name: team.name,
            folders: [],
            projects: [],
        };

        for (const folder of folders) {
            const node = folderMap.get(folder.uuid)!;
            if (!folder.parentFolderUuid || folder.parentFolderUuid === team.uuid) {
                root.folders.push(node);
                continue;
            }

            const parent = folderMap.get(folder.parentFolderUuid);
            (parent?.folders ?? root.folders).push(node);
        }

        for (const project of projects) {
            const node: ProjectTreeProject = {
                type: 'project',
                uuid: project.uuid,
                name: project.friendlyName,
            };

            if (!project.folderUuid || project.folderUuid === team.uuid) {
                root.projects.push(node);
                continue;
            }

            const folder = folderMap.get(project.folderUuid);
            (folder?.projects ?? root.projects).push(node);
        }

        result.push(root);
    }

    return result;
}

async function sendEasyEdaHello(connectionEpoch: number) {
    if (connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;
    let projectName = 'Untitled EasyEDA project';

    send('easyeda:hello', {
        instanceId: state.instanceId,
        projectName,
    });

    try {
        projectName = (await getProjectInfo()).project_name || projectName;
    } catch {
        // The project may not be fully available immediately after EasyEDA startup.
        return;
    }

    if (connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;

    send('easyeda:hello', {
        instanceId: state.instanceId,
        projectName,
    });
}

const findDocWithUUID = (data: Awaited<ReturnType<typeof getProjectInfo>>['project_data'], uuid: string) => {
    for (const element of data) {
        if (element.uuid === uuid) {
            return element;
        }

        if (element.pcb?.uuid === uuid) {
            return element.pcb;
        }

        if (element.schematic?.uuid === uuid) {
            return element.schematic;
        }

        for (const page of [...(element.page ?? []), ...(element.schematic?.page ?? [])]) {
            if (page.uuid === uuid) {
                return page;
            }
        }
    }

    return undefined;
}

async function openSchematic() {
    const currentDoc = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(_ => undefined);
    if (!currentDoc) return;
    if (currentDoc.documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE) return;
    const board = await eda.dmt_Board.getCurrentBoardInfo().catch(e => undefined);
    if (!board || !board.schematic || !board.schematic.page?.[0]?.uuid) return;
    await eda.dmt_EditorControl.openDocument(board.schematic.page[0].uuid).catch(e => undefined);
    await new Promise(resolve => setTimeout(resolve, 400));
}

async function handleMessage(message: McpMessage, connectionEpoch: number) {
    if (connectionEpoch !== state.connectionEpoch) return;
    state.heartbeatAwaitingPong = false;
    state.heartbeatMisses = 0;

    if (message.event === 'connected') {
        eda.sys_Log.add('MCP WebSocket connected', ESYS_LogType.INFO);
        return;
    }

    if (message.event === 'pong') {
        clearHeartbeatTimeout();
        return;
    }

    const body = parseBody<{ id?: string } & Record<string, unknown>>(message);
    const id = body.id;

    const reply = (ok: boolean, result?: unknown, error?: unknown) => {
        if (!id || connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;
        send(`${message.event}:result`, {
            id,
            ok,
            result,
            error: error instanceof Error ? error.message : error ? String(error) : undefined,
        });
    };

    try {
        eda.sys_Log.add(`MCP event: ${message.event}`, ESYS_LogType.INFO);

        if (message.event === 'execute-js') {
            if (typeof body.code !== 'string') throw new Error('JavaScript code must be a string.');
            reply(true, await executeJavaScript(body.code, eda, () => checkpointer.save(false)));
            return;
        }

        if (message.event === 'get-schematic') {
            const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
            const schematic = await getSchematic([...primitiveIds], { disableExtractPos: true });
            reply(true, schematic);
            return;
        }

        if (message.event === 'annotate-designators') {
            const mode = body.mode;
            if (mode !== 'preserve' && mode !== 'resequence') throw new Error('Invalid annotation mode.');
            reply(true, await annotateDesignators(mode));
            return;
        }

        if (message.event === 'get-multi-page-schematic') {
            const originalDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
            const fullSch: ExplainCircuit = { components: [] };
            try {
                await openSchematic();
                const extractFootprintUuid = !!body.extractFootprintUuid;
                const allPages = await eda.dmt_Schematic.getCurrentSchematicAllSchematicPagesInfo().catch(() => undefined);
                if (!allPages || !allPages.length) throw new Error('Not open any sch or is empty sch');

                for (const page of allPages) {
                    await eda.dmt_EditorControl.openDocument(page.uuid);
                    await delay(400);
                    const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
                    const schematic = await getSchematic([...primitiveIds], { extractFootprintUuid, disableExtractPos: true });
                    fullSch.components.push(...schematic.components);
                }
            } finally {
                const currentDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
                if (originalDocument?.uuid && currentDocument?.uuid !== originalDocument.uuid) {
                    await eda.dmt_EditorControl.openDocument(originalDocument.uuid);
                    await delay(400);
                }
            }
            reply(true, fullSch);
            return;
        }

        if (message.event === 'get-pcb') {
            reply(true, await getPcb());
            return;
        }

        if (message.event === 'get-pcb-raw') {
            reply(true, await getPcbRaw());
            return;
        }

        if (message.event === 'get-pcb-existing-placement') {
            reply(true, await getPcbExistingPlacement());
            return;
        }

        if (message.event === 'get-pcb-stack-layers') {
            reply(true, await getPcbStackLayers());
            return;
        }

        if (message.event === 'get-pcb-drc-rules') {
            reply(true, await exportPcbDrcRules());
            return;
        }

        if (message.event === 'export-routing-input') {
            const { file, text } = await exportRoutingInput();
            // Autoroute JSON is authoritative for board geometry, copper
            // layers, pads, and effective physical rules. Native DRC remains
            // separate because EasyEDA omits named net classes and equal-
            // length groups from this file on otherwise valid boards.
            const drc = await exportPcbDrcRules();
            reply(true, {
                name: file.name,
                size: file.size,
                type: file.type,
                text,
                drc,
            });
            return;
        }

        if (message.event === 'apply-routing-result') {
            const operationId = typeof body.operationId === 'string' ? body.operationId : undefined;
            let applicationTask = operationId ? routingApplicationCache.get(operationId) : undefined;
            if (!applicationTask) {
                applicationTask = (async () => {
                    const bundle = body.bundle;
                    const application = readRoutingApplication(body.application);
                    if (bundle !== undefined) assertDrcBundle(bundle);

                    // DRC, selective copper deletion, new geometry, refill, and native
                    // verification share one recovery boundary.
                    const checkpointId = await checkpointer.save(false);
                    if (!checkpointId) throw new Error('Failed to create routing transaction checkpoint.');
                    try {
                        const rules = bundle === undefined ? undefined : await routingTransactionStep(
                            'DRC rule application',
                            () => applyPcbDrcRules(bundle),
                        );
                        const hasBoardMutation = Boolean(
                            application.copperLayerCount !== undefined
                            || application.clearRouting
                            || application.tracks.length
                            || application.vias.length
                            || application.zones.length,
                        );
                        const copper = hasBoardMutation
                            ? await routingTransactionStep(
                                'board application',
                                () => applyRoutingCopper(application),
                            )
                            : undefined;
                        await routingTransactionStep(
                            'document synchronization',
                            () => syncCurrentDocument(),
                        );
                        const drc = await routingTransactionStep(
                            'native DRC verification',
                            () => checkPcbDrc(1),
                        );
                        const hasViolations = drc.some(category => category.list.some(group => group.list.length));
                        return {
                            applied: true,
                            rulesApplied: Boolean(rules),
                            boardApplied: Boolean(copper),
                            ...(copper?.zoneRebuild ? { pours: copper.zoneRebuild } : {}),
                            nativeVerification: hasViolations ? 'failed' : 'passed',
                        };
                    } catch (error) {
                        const restored = await checkpointer.restore(checkpointId, true).catch(() => false);
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(restored ? `${message}; routing transaction rolled back` : `${message}; routing rollback failed`);
                    }
                })();
                if (operationId) routingApplicationCache.set(operationId, applicationTask);
            }
            try {
                const result = await applicationTask;
                reply(true, result);
                while (routingApplicationCache.size > RETAINED_ROUTING_APPLICATIONS) {
                    routingApplicationCache.delete(routingApplicationCache.keys().next().value!);
                }
            } catch (error) {
                if (operationId && routingApplicationCache.get(operationId) === applicationTask) {
                    routingApplicationCache.delete(operationId);
                }
                throw error;
            }
            return;
        }

        if (message.event === 'get-current-project-info') {
            const project_data = await getProjectInfo()

            reply(true, {
                current_doc_uuid: await eda.dmt_SelectControl.getCurrentDocumentInfo().then(c => c?.uuid).catch(_ => undefined),
                ...project_data
            });
            return;
        }

        if (message.event === 'get-all-projects') {
            reply(true, await getAllProjectsTree());
            return;
        }

        if (message.event === 'create-project') {
            const projectFriendlyName = typeof body.projectFriendlyName === 'string'
                ? body.projectFriendlyName.trim()
                : '';
            if (!projectFriendlyName) throw new Error('Missing projectFriendlyName');

            const projectName = typeof body.projectName === 'string'
                ? body.projectName.trim()
                : undefined;
            if (projectName !== undefined && !/^[A-Za-z0-9-]+$/.test(projectName)) {
                throw new Error('Invalid projectName: use only ASCII letters, digits, and hyphens');
            }

            const teamUuid = typeof body.teamUuid === 'string' ? body.teamUuid.trim() : undefined;
            const folderUuid = typeof body.folderUuid === 'string' ? body.folderUuid.trim() : undefined;
            const description = typeof body.description === 'string' ? body.description.trim() : undefined;
            if (body.teamUuid !== undefined && !teamUuid) throw new Error('Invalid teamUuid');
            if (body.folderUuid !== undefined && !folderUuid) throw new Error('Invalid folderUuid');

            const projectUuid = await eda.dmt_Project.createProject(
                projectFriendlyName,
                projectName,
                teamUuid,
                folderUuid,
                description,
            );
            if (!projectUuid) throw new Error('EasyEDA failed to create the project');

            reply(true, {
                created: true,
                project_uuid: projectUuid,
                project_friendly_name: projectFriendlyName,
                ...(projectName === undefined ? {} : { project_name: projectName }),
                ...(teamUuid === undefined ? {} : { team_uuid: teamUuid }),
                ...(folderUuid === undefined ? {} : { folder_uuid: folderUuid }),
                ...(description === undefined ? {} : { description }),
            });
            return;
        }

        if (message.event === 'open-project') {
            const projectUuid = typeof body.projectUuid === 'string'
                ? body.projectUuid.trim()
                : '';
            if (!projectUuid) throw new Error('Missing projectUuid');

            const savedDocuments = await saveAllOpenDocuments();
            const opened = await eda.dmt_Project.openProject(projectUuid);
            if (!opened) throw new Error(`EasyEDA failed to open project: ${projectUuid}`);

            reply(true, {
                opened: true,
                project_uuid: projectUuid,
                saved_documents: savedDocuments,
                next_step: 'Call get_current_project_info after EasyEDA finishes opening the project.',
            });
            return;
        }

        if (message.event === 'open-document') {
            const documentUuid = body.documentUuid;
            if (typeof documentUuid !== 'string' || !documentUuid) {
                throw new Error('Missing documentUuid');
            }

            const tabId = await eda.dmt_EditorControl.openDocument(documentUuid);
            if (!tabId) throw new Error(`Failed to open document: ${documentUuid}`);

            reply(true, { opened: true, document_uuid: documentUuid });
            return;
        }

        if (message.event === 'save-document') {
            const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
            if (!document) throw new Error('Current document info not found');

            const saved = await saveCurrentDocument(document);
            if (!saved) throw new Error(`Failed to save current document: ${document.uuid}`);

            reply(true, {
                saved: true,
                document_uuid: document.uuid,
                document_type: document.documentType,
            });
            return;
        }

        if (message.event === 'sync-current-document') {
            const settleMs = typeof body.settleMs === 'number' && Number.isFinite(body.settleMs)
                ? Math.max(0, body.settleMs)
                : 500;
            reply(true, await syncCurrentDocument(settleMs));
            return;
        }

        if (message.event === 'check-pcb-drc') {
            const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
                ? Math.floor(body.limit)
                : 24;

            const result = await checkPcbDrc(limit);
            reply(true, result);
            return;
        }

        if (message.event === 'inspect-net') {
            const netName = typeof body.net === 'string' ? body.net : '';
            if (!netName) throw new Error('Missing net');

            const drcLimit = typeof body.drc_limit === 'number' && Number.isFinite(body.drc_limit) && body.drc_limit > 0
                ? Math.floor(body.drc_limit)
                : 24;

            const result = await inspectNet(netName, drcLimit);
            reply(true, result);
            return;
        }

        if (message.event === 'inspect-component') {
            const designator = typeof body.designator === 'string' ? body.designator : '';
            if (!designator) throw new Error('Missing designator');

            const radius = typeof body.radius === 'number' && Number.isFinite(body.radius) && body.radius > 0
                ? body.radius
                : 10;

            const pcb = await getPcb();
            const result = await inspectComponent(pcb, designator, radius);
            reply(true, result);
            return;
        }

        if (message.event === 'create-schematic') {
            const boardName = typeof body.boardName === 'string' ? body.boardName : undefined;
            const schematicFirstPageUuid = await eda.dmt_Schematic.createSchematic(boardName);
            if (!schematicFirstPageUuid) throw new Error('Failed to create schematic');

            reply(true, { schematicFirstPageUuid });
            return;
        }

        if (message.event === 'create-schematic-page') {
            const schematicUuid = body.schematicUuid;
            if (typeof schematicUuid !== 'string' || !schematicUuid) {
                throw new Error('Missing schematicUuid');
            }

            const schematicPageUuid = await eda.dmt_Schematic.createSchematicPage(schematicUuid);
            if (!schematicPageUuid) throw new Error(`Failed to create schematic page for schematic: ${schematicUuid}`);

            reply(true, { schematicUuid, schematicPageUuid });
            return;
        }

        if (message.event === 'modify-name') {
            const name = body.name;
            if (typeof name !== 'string' || !name) {
                throw new Error('Missing name');
            }

            if (typeof body.board_name === 'string') {
                const success = await eda.dmt_Board.modifyBoardName(body.board_name, name);
                return reply(true, { success, new_board_name: name });
            }

            const uuid = body.uuid;

            if (typeof uuid !== 'string' || !uuid) {
                throw new Error('Missing uuid');
            }

            const projectData = await getProjectInfo().then(d => d.project_data);
            const doc = findDocWithUUID(projectData, uuid);

            if (!doc) return reply(false, undefined, "Not found doc with this uuid");

            if (doc.itemType === EDMT_ItemType.SCHEMATIC) {
                const success = await eda.dmt_Schematic.modifySchematicName(uuid, name);
                reply(true, { success, new_sch_name: name });
            }
            else if (doc.itemType === EDMT_ItemType.SCHEMATIC_PAGE) {
                const success = await eda.dmt_Schematic.modifySchematicPageName(uuid, name);
                return reply(true, { success, new_sch_page_name: name });
            }
            else if (doc.itemType === EDMT_ItemType.PCB) {
                const success = await eda.dmt_Pcb.modifyPcbName(uuid, name);
                return reply(true, { success, new_pcb_name: name });
            }

            return reply(false, undefined, "Unsupported doc format: " + doc.itemType);
        }

        if (message.event === 'create-board') {
            const schematicUuid = typeof body.schematicUuid === 'string' ? body.schematicUuid : undefined;
            const pcbUuid = typeof body.pcbUuid === 'string' ? body.pcbUuid : undefined;

            const boardName = await eda.dmt_Board.createBoard(schematicUuid, pcbUuid);
            if (!boardName) throw new Error('Failed to create board');

            reply(true, { boardName, schematicUuid, pcbUuid });
            return;
        }

        if (message.event === 'delete-doc') {
            if (typeof body.board_name === 'string') {
                const success = await eda.dmt_Board.deleteBoard(body.board_name);
                reply(true, { success });
            }

            const uuid = body.uuid;

            if (typeof uuid !== 'string' || !uuid) {
                throw new Error('Missing uuid');
            }

            const projectData = await getProjectInfo().then(d => d.project_data);
            const doc = findDocWithUUID(projectData, uuid);

            if (!doc) return reply(false, undefined, "Not found doc with this uuid");

            if (doc.itemType === EDMT_ItemType.SCHEMATIC) {
                const success = await eda.dmt_Schematic.deleteSchematic(uuid);
                reply(true, { success });
            }
            else if (doc.itemType === EDMT_ItemType.SCHEMATIC_PAGE) {
                const success = await eda.dmt_Schematic.deleteSchematicPage(uuid);
                return reply(true, { success });
            }
            else if (doc.itemType === EDMT_ItemType.PCB) {
                const success = await eda.dmt_Pcb.deletePcb(uuid);
                return reply(true, { success });
            }

            return reply(false, undefined, "Unsupported doc format: " + doc.itemType);
        }

        if (message.event === 'create-pcb') {
            const boardName = typeof body.boardName === 'string' ? body.boardName : undefined;

            const pcbUuid = await eda.dmt_Pcb.createPcb(boardName);
            if (!pcbUuid) throw new Error('Failed to create PCB');

            reply(true, { pcbUuid, boardName });
            return;
        }

        if (message.event === 'import-pcb-changes') {
            const schematicUuid = typeof body.schematicUuid === 'string' ? body.schematicUuid : undefined;

            const success = await eda.pcb_Document.importChanges(schematicUuid);
            if (success) return reply(true, { success, message: `In EasyEDA, when importing changes, the import dialog window opens if there are changes, or it does not open if there are no changes. In either case, the user must manually confirm the action within that dialog window (if it appears) to complete the import process.` });
            return reply(true, { success });
        }

        if (message.event === 'assemble-circuit') {
            const circuit = body.circuit;
            if (!circuit) throw new Error('Missing circuit in assemble-circuit body');

            await checkpointer.save(false);
            await assembleCircuit(circuit as Parameters<typeof assembleCircuit>[0]);
            const sheetSpace = await withTimeout(
                estimateSchematicSheetSpace(),
                5000,
                'Schematic sheet space estimate timeout',
            ).catch(error => {
                eda.sys_Log.add(
                    `Schematic sheet space estimate failed: ${(error as Error).message}`,
                    ESYS_LogType.WARNING,
                );
                return undefined;
            });
            reply(true, { assembled: true, ...(sheetSpace ? { sheetSpace } : {}) });
            return;
        }

        if (message.event === 'beautify-current-page') {
            const circuit = body.circuit;
            const checkpointId = typeof body.checkpointId === 'string' ? body.checkpointId : undefined;
            const expectedDesignators = Array.isArray(body.expectedDesignators)
                ? body.expectedDesignators.filter((value): value is string => typeof value === 'string')
                : [];

            if (!circuit) throw new Error('Missing circuit in beautify-current-page body');
            if (!checkpointId) throw new Error('Missing checkpointId in beautify-current-page body');
            if (!expectedDesignators.length) throw new Error('Missing expectedDesignators in beautify-current-page body');

            const checkpoint = await checkpointer.read(checkpointId);
            if (!checkpoint) throw new Error(`Checkpoint not found: ${checkpointId}`);

            const currentPage = await eda.dmt_Schematic.getCurrentSchematicPageInfo().catch(() => undefined);
            if (checkpoint.pageId && checkpoint.pageId !== currentPage?.uuid) {
                throw new Error('The current schematic page changed after the beautify checkpoint was created.');
            }

            let mutationStarted = false;
            try {
                const componentIdentities = await getBeautifyComponentIdentities(expectedDesignators);
                mutationStarted = true;

                await deleteCopilotBlockBoxes();

                const wireIds = await eda.sch_PrimitiveWire.getAllPrimitiveId().then(ids => [...ids]);
                if (wireIds.length) {
                    const deleted = await eda.sch_PrimitiveWire.delete(wireIds);
                    if (!deleted) throw new Error('Failed to delete all schematic wires.');
                }

                const componentIds = await getBeautifyComponentIds(expectedDesignators);
                if (componentIds.length) {
                    const deleted = await eda.sch_PrimitiveComponent.delete(componentIds);
                    if (!deleted) throw new Error('Failed to delete all schematic components.');
                }

                const [remainingWireIds, remainingComponentIds] = await Promise.all([
                    eda.sch_PrimitiveWire.getAllPrimitiveId(),
                    getBeautifyComponentIds(expectedDesignators),
                ]);
                if (remainingWireIds.length || remainingComponentIds.length) {
                    throw new Error(`Failed to clear the schematic page completely: ${remainingWireIds.length} wires and ${remainingComponentIds.length} components remain.`);
                }

                await assembleCircuit(circuit as Parameters<typeof assembleCircuit>[0]);
                await waitForBeautifyComponents(expectedDesignators);
                await restoreBeautifyComponentIdentities(componentIdentities);

                reply(true, { assembled: true, checkpointId });
            } catch (error) {
                if (mutationStarted) {
                    const restored = await checkpointer.restore(checkpointId, true).catch(() => false);
                    if (!restored) {
                        const message = error instanceof Error ? error.message : String(error);
                        throw new Error(`${message}; automatic checkpoint restore failed`);
                    }
                }
                throw error;
            }
            return;
        }

        if (message.event === 'assemble-board') {
            const board = body.boardAssemble ?? body.board ?? body.pcb_board_assemble;
            if (!board) throw new Error('Missing board assemble payload in assemble-board body');

            await checkpointer.save(false);
            await assembleBoard(board as Parameters<typeof assembleBoard>[0]);
            reply(true, { assembled: true });
            return;
        }

        if (message.event === 'checkpoint-list') {
            reply(true, await checkpointer.list().then(cs => cs.slice(0, 16)));
            return;
        }

        if (message.event === 'checkpoint-save') {
            const checkpointId = await checkpointer.save(false);
            reply(true, { checkpointId });
            return;
        }

        if (message.event === 'checkpoint-read') {
            const checkpoint = await checkpointer.read(String(body.checkpointId));
            if (!checkpoint) throw new Error('Checkpoint not found');
            reply(true, { ...checkpoint, content: 'too big' });
            return;
        }

        if (message.event === 'checkpoint-restore') {
            const restored = await checkpointer.restore(typeof body.checkpointId === 'string' ? body.checkpointId : undefined, true);
            reply(true, { restored });
            return;
        }

        throw new Error(`Unknown MCP event: ${message.event}`);
    } catch (error) {
        eda.sys_Log.add(`MCP event error: ${message.event}: ${(error as Error).message}`, ESYS_LogType.ERROR);
        reply(false, undefined, error);
    }
}

function replyMcpError(message: McpMessage, error: string, connectionEpoch: number) {
    if (connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;
    const body = parseBody<{ id?: string }>(message);
    if (!body.id) return;

    send(`${message.event}:result`, {
        id: body.id,
        ok: false,
        error,
    });
}

function replyMcpQueueFull(message: McpMessage, connectionEpoch: number) {
    replyMcpError(
        message,
        `EasyEDA MCP command queue is full (${MCP_COMMAND_QUEUE_MAX_SIZE} waiting requests).`,
        connectionEpoch,
    );
}

async function handleQueuedMcpMessage(message: McpMessage, connectionEpoch: number) {
    if (connectionEpoch !== state.connectionEpoch || !state.isRegistered) return;

    const body = parseBody<Record<string, unknown>>(message);
    const deadlineAt = body[MCP_DEADLINE_FIELD];
    if (typeof deadlineAt === 'number' && Number.isFinite(deadlineAt) && Date.now() >= deadlineAt) {
        eda.sys_Log.add(`MCP event expired in queue: ${message.event}`, ESYS_LogType.WARNING);
        replyMcpError(message, `EasyEDA MCP event expired before execution: ${message.event}.`, connectionEpoch);
        return;
    }

    await handleMessage(message, connectionEpoch);
}

function clearConnectTimeout() {
    clearMcpTimeoutTimer(MCP_CONNECT_TIMEOUT_TIMER_ID, state.connectTimeout);
    state.connectTimeout = undefined;
}

function closeMcpSocket(reason: string) {
    try {
        eda.sys_WebSocket.close(MCP_WS_ID, 1000, reason);
    } catch {
        // EasyEDA may throw when the socket id is not registered yet.
    }
}

function tryConnectMcp(showErrors = false) {
    if (state.isRegistered || state.isConnecting || !state.isScanEnabled) {
        return;
    }

    state.isConnecting = true;
    const connectionEpoch = ++state.connectionEpoch;
    closeMcpSocket('Reconnect by EasyEDA Copilot');

    clearConnectTimeout();
    state.connectTimeout = setMcpTimeoutTimer(MCP_CONNECT_TIMEOUT_TIMER_ID, MCP_CONNECT_TIMEOUT_MS, () => {
        if (connectionEpoch !== state.connectionEpoch) return;
        state.connectionEpoch++;
        state.isConnecting = false;
        mcpCommandQueue.clear();
        clearConnectTimeout();
        closeMcpSocket('MCP connect timeout');

        if (showErrors) {
            eda.sys_Log.add('Fail connect MCP WebSocket', ESYS_LogType.ERROR);
            eda.sys_Message.showToastMessage('MCP server not found', ESYS_ToastMessageType.WARNING);
        }
    });

    eda.sys_WebSocket.register(
        MCP_WS_ID,
        MCP_WS_URL,
        async (event) => {
            try {
                if (connectionEpoch !== state.connectionEpoch) return;
                const data = typeof event.data === 'string' ? event.data : String(event.data);
                const message = JSON.parse(data) as McpMessage;

                if (message.event === 'connected' || message.event === 'pong') {
                    await handleMessage(message, connectionEpoch);
                    return;
                }

                if (mcpCommandQueue.size >= MCP_COMMAND_QUEUE_MAX_SIZE) {
                    replyMcpQueueFull(message, connectionEpoch);
                    return;
                }

                void mcpCommandQueue.add(() => handleQueuedMcpMessage(message, connectionEpoch)).catch(error => {
                    eda.sys_Log.add(`MCP queued command error: ${(error as Error).message}`, ESYS_LogType.ERROR);
                });
            } catch (error) {
                eda.sys_Log.add(`MCP message error: ${(error as Error).message}`, ESYS_LogType.ERROR);
            }
        },
        () => {
            if (connectionEpoch !== state.connectionEpoch || !state.isScanEnabled) return;
            state.isRegistered = true;
            state.isConnecting = false;
            clearConnectTimeout();
            sendEasyEdaHello(connectionEpoch).catch(error => {
                eda.sys_Log.add(`MCP hello failed: ${(error as Error).message}`, ESYS_LogType.WARNING);
            });
            startHeartbeat(connectionEpoch);
            eda.sys_Log.add(`MCP WebSocket opened: ${MCP_WS_URL}`, ESYS_LogType.INFO);
            eda.sys_Message.showToastMessage('MCP connected', ESYS_ToastMessageType.SUCCESS);
        }
    );
}

export function startMcpScan(showErrors = false, respectUserPause = false) {
    if (respectUserPause && state.isUserPaused) {
        eda.sys_Log.add('MCP scan is paused by user', ESYS_LogType.INFO);
        return;
    }

    state.isUserPaused = false;

    if (state.isScanEnabled) {
        startMcpScanTimer();
        if (state.isRegistered) startHeartbeat(state.connectionEpoch);
        tryConnectMcp(showErrors);
        return;
    }

    state.isScanEnabled = true;
    tryConnectMcp(showErrors);
    startMcpScanTimer();
    eda.sys_Log.add('MCP scan started', ESYS_LogType.INFO);
}

function startMcpScanTimer() {
    clearMcpIntervalTimer(MCP_SCAN_TIMER_ID, state.scanTimer);
    state.scanTimer = setMcpIntervalTimer(
        MCP_SCAN_TIMER_ID,
        MCP_SCAN_INTERVAL_MS,
        () => tryConnectMcp(false),
    );
}

export function startMcpScanOnStartup() {
    if (!state.isStartupInitialized) {
        state.isStartupInitialized = true;
        state.isUserPaused = false;
        startMcpScan(false);
        return;
    }

    startMcpScan(false, true);
}

export function stopMcpScan(showToast = true) {
    state.connectionEpoch++;
    state.isScanEnabled = false;
    state.isConnecting = false;
    state.isUserPaused = true;
    clearConnectTimeout();
    stopHeartbeat();
    mcpCommandQueue.clear();

    clearMcpIntervalTimer(MCP_SCAN_TIMER_ID, state.scanTimer);
    state.scanTimer = undefined;

    closeMcpSocket('MCP scan stopped by EasyEDA Copilot');
    state.isRegistered = false;

    if (showToast) {
        eda.sys_Message.showToastMessage('MCP scan stopped', ESYS_ToastMessageType.SUCCESS);
    }
    eda.sys_Log.add('MCP scan stopped', ESYS_LogType.INFO);
}

export function toggleMcpScan() {
    if (state.isScanEnabled) {
        stopMcpScan();
        return;
    }

    startMcpScan(true);
    eda.sys_Message.showToastMessage('MCP scan started', ESYS_ToastMessageType.SUCCESS);
}
