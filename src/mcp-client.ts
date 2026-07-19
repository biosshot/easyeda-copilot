import { assembleCircuit } from './eda/assemble';
import { assembleBoard, clearCurrentPcbBoard, pourDefaultGroundAndSutureVias, type GroundSutureOptions } from './eda/pcb-assemble';
import { checkpointer } from './eda/checkpointer';
import { checkPcbDrc } from './eda/drc';
import { getPcb, getPcbRaw, inspectComponent, inspectNet } from './eda/pcb';
import { getSchematic } from './eda/schematic';
import '@copilot/shared/types/eda';
import { ExplainCircuit } from '@copilot/shared/types/circuit';
import PQueue from 'p-queue';
import {
    PcbDrcDifferentialPairType,
    type PcbDrcBundle,
    type PcbDrcDifferentialPairRule,
    type PcbDrcDifferentialPairSubRule,
    type PcbDrcRuleObject,
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

const mcpCommandQueue = new PQueue({ concurrency: 1 });

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDifferentialPairRule(rule: unknown): rule is PcbDrcDifferentialPairRule {
    return Boolean(readDifferentialPairRule(rule));
}

function assertDrcBundle(value: unknown): asserts value is PcbDrcBundle {
    if (!isRecord(value) || !isRecord(value.ruleConfiguration) || !Array.isArray(value.netRules)) {
        throw new Error('Invalid PCB DRC bundle. Expected { ruleConfiguration, netRules }.');
    }
}

function formatPath(path: Array<string | number>) {
    return path.map(part => typeof part === 'number'
        ? `[${part}]`
        : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)
            ? `.${part}`
            : `[${JSON.stringify(part)}]`
    ).join('').replace(/^\./, '');
}

function readBoardPolygon(value: unknown): Parameters<typeof pourDefaultGroundAndSutureVias>[0] | undefined {
    if (!Array.isArray(value)) return undefined;

    const polygon = value
        .filter((point): point is { x: number; y: number } =>
            isRecord(point) &&
            typeof point.x === 'number' &&
            typeof point.y === 'number' &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y),
        )
        .map(point => ({ x: point.x, y: point.y }));

    return polygon.length >= 3 ? { polygon } : undefined;
}

function readGroundSutureOptions(value: unknown): GroundSutureOptions {
    if (!isRecord(value)) return {};

    return {
        gridMm: typeof value.gridMm === 'number' ? value.gridMm : undefined,
        diameterMm: typeof value.diameterMm === 'number' ? value.diameterMm : undefined,
        drillMm: typeof value.drillMm === 'number' ? value.drillMm : undefined,
        edgeMarginMm: typeof value.edgeMarginMm === 'number' ? value.edgeMarginMm : undefined,
        maxCount: typeof value.maxCount === 'number' ? value.maxCount : undefined,
    };
}

function readStringList(value: unknown) {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (!Array.isArray(value)) return [];

    return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean);
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

function readCopperLayerCount(value: unknown): 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32 {
    const allowed = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;
    if (typeof value === 'number' && allowed.includes(value as typeof allowed[number])) {
        return value as typeof allowed[number];
    }

    throw new Error('Invalid copper layer count. Expected an even number from 2 to 32.');
}

function isLayerMapName(name: string) {
    return name === 'data' || name === 'tables';
}

function isNumericObjectKey(key: string) {
    return /^\d+$/.test(key);
}

function collectAllowedLayerMapKeys(value: unknown, path: string[] = [], result = new Map<string, Set<string>>()) {
    if (!isRecord(value)) return result;

    for (const [key, child] of Object.entries(value)) {
        const childPath = [...path, key];

        if (isLayerMapName(key) && isRecord(child)) {
            const pathKey = childPath.join('.');
            const keys = result.get(pathKey) ?? new Set<string>();
            for (const childKey of Object.keys(child)) {
                keys.add(childKey);
            }
            result.set(pathKey, keys);
            continue;
        }

        collectAllowedLayerMapKeys(child, childPath, result);
    }

    return result;
}

function collectAllowedLayerMapKeysFromFamily(family: unknown) {
    const result = new Map<string, Set<string>>();
    if (!isRecord(family)) return result;

    for (const preset of Object.values(family)) {
        const presetKeys = collectAllowedLayerMapKeys(preset);

        for (const [pathKey, keys] of presetKeys.entries()) {
            const mergedKeys = result.get(pathKey) ?? new Set<string>();
            for (const key of keys) {
                mergedKeys.add(key);
            }
            result.set(pathKey, mergedKeys);
        }
    }

    return result;
}

function validateLayerMapKeys(
    value: unknown,
    allowedKeysByPath: Map<string, Set<string>>,
    path: Array<string | number>,
    relativePath: string[] = [],
    issues: string[] = [],
) {
    if (!isRecord(value)) return issues;

    for (const [key, child] of Object.entries(value)) {
        const childPath = [...path, key];
        const childRelativePath = [...relativePath, key];

        if (isLayerMapName(key) && isRecord(child)) {
            const mapPath = childRelativePath.join('.');
            const allowedKeys = allowedKeysByPath.get(mapPath);

            for (const childKey of Object.keys(child)) {
                if (isNumericObjectKey(childKey) || allowedKeys?.has(childKey)) continue;

                issues.push(`${formatPath([...childPath, childKey])}: invalid key inside "${key}". ` +
                    `This map is for layer/table indices, not preset names. Create a sibling preset in the rule family instead.`);
            }

            continue;
        }

        validateLayerMapKeys(child, allowedKeysByPath, childPath, childRelativePath, issues);
    }

    return issues;
}

function validateDrcRuleConfiguration(ruleConfiguration: PcbDrcRuleObject, baselineRuleConfiguration: PcbDrcRuleObject | undefined) {
    const issues: string[] = [];

    for (const [categoryName, category] of Object.entries(ruleConfiguration)) {
        if (!isRecord(category)) continue;

        const baselineCategory = baselineRuleConfiguration?.[categoryName];
        if (baselineRuleConfiguration && !isRecord(baselineCategory)) {
            issues.push(`ruleConfiguration[${JSON.stringify(categoryName)}]: unknown rule category.`);
            continue;
        }

        for (const [familyName, family] of Object.entries(category)) {
            if (!isRecord(family)) continue;

            const baselineFamily = isRecord(baselineCategory) ? baselineCategory[familyName] : undefined;
            if (isRecord(baselineCategory) && !isRecord(baselineFamily)) {
                issues.push(`ruleConfiguration[${JSON.stringify(categoryName)}][${JSON.stringify(familyName)}]: unknown rule family.`);
                continue;
            }

            const allowedLayerMapKeys = collectAllowedLayerMapKeysFromFamily(baselineFamily);

            for (const [presetName, preset] of Object.entries(family)) {
                validateLayerMapKeys(
                    preset,
                    allowedLayerMapKeys,
                    ['ruleConfiguration', categoryName, familyName, presetName],
                    [],
                    issues,
                );
            }
        }
    }

    if (!issues.length) return;

    throw new Error([
        'Invalid PCB DRC ruleConfiguration.',
        ...issues.slice(0, 20),
        issues.length > 20 ? `...and ${issues.length - 20} more issue(s).` : undefined,
    ].filter(Boolean).join('\n'));
}

function getNetRuleByName(netRules: PcbDrcRuleObject[], netName: string) {
    return netRules.find(rule => rule.type === 'net' && rule.name === netName);
}

function readDifferentialPairRule(rule: unknown): DesiredDifferentialPair | undefined {
    if (!isRecord(rule) || rule.type !== PcbDrcDifferentialPairType || typeof rule.name !== 'string') {
        return undefined;
    }

    if (typeof rule.positiveNet === 'string' && typeof rule.negativeNet === 'string') {
        return {
            name: rule.name,
            positiveNet: rule.positiveNet,
            negativeNet: rule.negativeNet,
        };
    }

    return undefined;
}

function makeDifferentialPairSubRule(rule: PcbDrcRuleObject | undefined, name: string): PcbDrcDifferentialPairSubRule {
    return {
        ...(rule ?? {}),
        type: 'net',
        name,
    };
}

function restoreDifferentialPairSubRule(rule: PcbDrcRuleObject, parentRule: PcbDrcDifferentialPairRule) {
    const netRule = { ...rule };
    if (Object.prototype.hasOwnProperty.call(parentRule, 'Differential Pair')) {
        netRule['Differential Pair'] = parentRule['Differential Pair'];
    }

    return netRule;
}

function injectDifferentialPairsIntoNetRules(
    netRules: PcbDrcRuleObject[],
    differentialPairs: Array<{ name: string; positiveNet: string; negativeNet: string; }>,
) {
    const pairNetNames = new Set(differentialPairs.flatMap(pair => [pair.positiveNet, pair.negativeNet]));
    const regularNetRules = netRules.filter(rule => !(rule.type === 'net'
        && typeof rule.name === 'string'
        && pairNetNames.has(rule.name)));

    const syntheticRules = differentialPairs.map(pair => {
        const positiveNetRule = getNetRuleByName(netRules, pair.positiveNet);
        const negativeNetRule = getNetRuleByName(netRules, pair.negativeNet);
        const pairRule: PcbDrcDifferentialPairRule = {
            type: PcbDrcDifferentialPairType,
            name: pair.name,
            positiveNet: pair.positiveNet,
            negativeNet: pair.negativeNet,
            sub: [
                makeDifferentialPairSubRule(positiveNetRule, pair.positiveNet),
                makeDifferentialPairSubRule(negativeNetRule, pair.negativeNet),
            ],
        };

        if (
            positiveNetRule
            && negativeNetRule
            && positiveNetRule['Differential Pair'] === negativeNetRule['Differential Pair']
            && positiveNetRule['Differential Pair'] !== undefined
        ) {
            pairRule['Differential Pair'] = positiveNetRule['Differential Pair'];
        }

        return pairRule;
    });

    return [...regularNetRules, ...syntheticRules];
}

function splitDifferentialPairsFromNetRules(netRules: Array<PcbDrcRuleObject | PcbDrcDifferentialPairRule>) {
    const extractedPairs: Array<{
        rule: PcbDrcDifferentialPairRule;
        pair: DesiredDifferentialPair;
        hasSubRules: boolean;
    }> = [];
    const subNetNames = new Set<string>();
    const regularNetRules: PcbDrcRuleObject[] = [];

    for (const rule of netRules) {
        if (!isDifferentialPairRule(rule)) continue;

        const pair = readDifferentialPairRule(rule);
        if (!pair) throw new Error(`Invalid differential pair rule: ${String(rule.name)}`);

        const hasSubRules = Boolean(rule.sub?.length);

        extractedPairs.push({ rule, pair, hasSubRules });

        if (!hasSubRules) continue;
        subNetNames.add(pair.positiveNet);
        subNetNames.add(pair.negativeNet);
    }

    for (const rule of netRules) {
        if (isDifferentialPairRule(rule)) continue;
        if (rule.type === 'net' && typeof rule.name === 'string' && subNetNames.has(rule.name)) continue;

        regularNetRules.push(rule);
    }

    for (const { rule, pair, hasSubRules } of extractedPairs) {
        if (hasSubRules) {
            const positiveSub = rule.sub?.find(net => net.name === pair.positiveNet);
            const negativeSub = rule.sub?.find(net => net.name === pair.negativeNet);

            if (!positiveSub) throw new Error(`Differential pair ${pair.name} sub is missing positive net: ${pair.positiveNet}`);
            if (!negativeSub) throw new Error(`Differential pair ${pair.name} sub is missing negative net: ${pair.negativeNet}`);

            regularNetRules.push(restoreDifferentialPairSubRule(positiveSub, rule));
            regularNetRules.push(restoreDifferentialPairSubRule(negativeSub, rule));
            continue;
        }

        if (!Object.prototype.hasOwnProperty.call(rule, 'Differential Pair')) continue;

        const positiveNetRule = getNetRuleByName(regularNetRules, pair.positiveNet);
        const negativeNetRule = getNetRuleByName(regularNetRules, pair.negativeNet);

        if (positiveNetRule) positiveNetRule['Differential Pair'] = rule['Differential Pair'];
        if (negativeNetRule) negativeNetRule['Differential Pair'] = rule['Differential Pair'];
    }

    return {
        regularNetRules,
        differentialPairs: extractedPairs.map(item => item.pair),
    };
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

    const netRules = await eda.pcb_Drc.getNetRules();
    const differentialPairs = normalizeDifferentialPairs(await eda.pcb_Drc.getAllDifferentialPairs());

    return {
        ruleConfiguration: ruleConfiguration.config,
        netRules: injectDifferentialPairsIntoNetRules(netRules, differentialPairs),
    };
}

async function applyPcbDrcRules(bundle: PcbDrcBundle) {
    const { regularNetRules, differentialPairs } = splitDifferentialPairsFromNetRules(bundle.netRules);
    const currentRuleConfiguration = await eda.pcb_Drc.getCurrentRuleConfiguration();
    if (!currentRuleConfiguration) throw new Error('Failed to read current PCB DRC rule configuration.');
    validateDrcRuleConfiguration(bundle.ruleConfiguration, currentRuleConfiguration.config);

    await checkpointer.save(false);

    const differentialPairResult = await reconcileDifferentialPairs(differentialPairs);
    const ruleConfiguration = await eda.pcb_Drc.overwriteCurrentRuleConfiguration(bundle.ruleConfiguration);
    if (!ruleConfiguration) throw new Error('Failed to overwrite current PCB DRC rule configuration.');

    const netRules = await eda.pcb_Drc.overwriteNetRules(regularNetRules);
    if (!netRules) throw new Error('Failed to overwrite PCB net rules.');

    return {
        applied: true,
        ruleConfiguration,
        netRules,
        regularNetRules: regularNetRules.length,
        differentialPairs: differentialPairResult,
    };
}

async function saveCurrentDocument(document: IDMT_EditorDocumentItem) {
    if (document.documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        return await eda.sch_Document.save();
    }

    if (document.documentType === EDMT_EditorDocumentType.PCB) {
        return await eda.pcb_Document.save(document.uuid);
    }

    throw new Error(`Unsupported current document type for sync: ${document.documentType}`);
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

        if (message.event === 'get-schematic') {
            const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
            const schematic = await getSchematic([...primitiveIds], { disableExtractPos: true });
            reply(true, schematic);
            return;
        }

        if (message.event === 'get-multi-page-schematic') {
            await openSchematic();
            const extractFootprintUuid = !!body.extractFootprintUuid;
            const allPages = await eda.dmt_Schematic.getCurrentSchematicAllSchematicPagesInfo().catch(e => undefined);
            if (!allPages || !allPages.length) throw new Error('Not open any sch or is empty sch');
            const fullSch: ExplainCircuit = { components: [] };

            for (const page of allPages) {
                await eda.dmt_EditorControl.openDocument(page.uuid);
                await new Promise(resolve => setTimeout(resolve, 400));
                const primitiveIds = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(() => []);
                const schematic = await getSchematic([...primitiveIds], { extractFootprintUuid, disableExtractPos: true });
                fullSch.components.push(...schematic.components);
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

        if (message.event === 'get-pcb-stack-layers') {
            reply(true, await getPcbStackLayers());
            return;
        }

        if (message.event === 'set-pcb-copper-layer-count') {
            const count = readCopperLayerCount(body.count);
            await checkpointer.save(false);
            const success = await eda.pcb_Layer.setTheNumberOfCopperLayers(count);
            if (!success) throw new Error(`Failed to set PCB copper layer count: ${count}`);

            reply(true, {
                success,
                count,
                stack: await getPcbStackLayers(),
            });
            return;
        }

        if (message.event === 'export-pcb-autoroute-json') {
            const file = await eda.pcb_ManufactureData.getAutoRouteJsonFile('Copilot_AutoRoute_Json');
            if (!file) throw new Error('EasyEDA returned empty autoroute JSON file');

            reply(true, {
                name: file.name,
                size: file.size,
                type: file.type,
                text: await file.text(),
            });
            return;
        }

        if (message.event === 'import-pcb-autoroute-json') {
            const text = typeof body.text === 'string' ? body.text : '';
            if (!text) throw new Error('Missing routed autoroute JSON text');

            const routeFile = new File([text], 'Copilot_AutoRoute_Result.json', {
                type: 'application/json',
            });

            await checkpointer.save(false);
            const imported = await eda.pcb_Document.importAutoRouteJsonFile(routeFile);
            if (!imported) throw new Error('EasyEDA failed to import autoroute JSON');

            const groundResult = await pourDefaultGroundAndSutureVias(readBoardPolygon(body.boardPolygon), {
                pourGround: body.pourGround !== false,
                sutureGround: body.sutureGround !== false,
                suture: readGroundSutureOptions(body.suture),
            });

            reply(true, { imported, groundResult });
            return;
        }

        if (message.event === 'clear-pcb-routing') {
            await checkpointer.save(false);
            const result = await clearCurrentPcbBoard({
                ignoreToClearNet: readStringList(body.ignoreToClearNet),
                clearOnlyNet: readStringList(body.clearOnlyNet),
                preserveBoardOutline: true,
            });
            await eda.pcb_Document.startCalculatingRatline().catch(() => false);

            reply(true, result);
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

        if (message.event === 'open-document') {
            const documentUuid = body.documentUuid;
            if (typeof documentUuid !== 'string' || !documentUuid) {
                throw new Error('Missing documentUuid');
            }

            const tabId = await eda.dmt_EditorControl.openDocument(documentUuid);
            if (!tabId) throw new Error(`Failed to open document: ${documentUuid}`);

            reply(true, { tabId, documentUuid });
            return;
        }

        if (message.event === 'sync-current-document') {
            const settleMs = typeof body.settleMs === 'number' && Number.isFinite(body.settleMs)
                ? Math.max(0, body.settleMs)
                : 500;
            const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
            if (!document) throw new Error('Current document info not found');

            const saved = await saveCurrentDocument(document);
            if (!saved) throw new Error(`Failed to save current document: ${document.uuid}`);

            const closed = await eda.dmt_EditorControl.closeDocument(document.tabId || document.uuid);
            if (!closed) throw new Error(`Failed to close current document: ${document.uuid}`);

            await delay(settleMs);

            const tabId = await eda.dmt_EditorControl.openDocument(document.uuid);
            if (!tabId) throw new Error(`Failed to reopen current document: ${document.uuid}`);

            reply(true, {
                documentUuid: document.uuid,
                documentType: document.documentType,
                saved,
                closed,
                tabId,
                settleMs,
            });
            return;
        }

        if (message.event === 'export-pcb-drc-rules') {
            reply(true, await exportPcbDrcRules());
            return;
        }

        if (message.event === 'apply-pcb-drc-rules') {
            const bundle = body.bundle;
            assertDrcBundle(bundle);
            reply(true, await applyPcbDrcRules(bundle));
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

            const pcb = await getPcb();
            const result = await inspectNet(pcb, netName, drcLimit);
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
            reply(true, { assembled: true });
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
