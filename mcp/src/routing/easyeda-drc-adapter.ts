import type { RoutingRules, RoutingRuleValues } from 'eda-copilot-router';
import type { EasyEdaRoutingApplication } from './easyeda-autoroute-adapter';
import type {
    PcbDrcBundle,
    PcbDrcDifferentialPairRule,
    PcbDrcEqualLengthGroupRule,
    PcbDrcNetClassRule,
    PcbDrcNetRule,
    PcbDrcNetRuleEntry,
} from '@copilot/shared/types/pcb/drc';

type JsonRecord = Record<string, unknown>;
type RelationRule = PcbDrcNetClassRule | PcbDrcEqualLengthGroupRule;

function record(value: unknown): JsonRecord | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function clone<T>(value: T): T {
    return structuredClone(value);
}

function presetFamily(root: JsonRecord, category: string, family: string) {
    const categoryObject = record(root[category]);
    const familyObject = record(categoryObject?.[family]);
    if (!categoryObject || !familyObject) {
        throw new TypeError(`EasyEDA DRC preset family is unavailable: ${category}.${family}`);
    }
    return familyObject;
}

// EasyEDA introduces sub-micron unit-conversion noise when a preset is saved and read back.
const PRESET_NUMBER_EPSILON = 1e-5;
const PRESET_IDENTITY_FIELDS = new Set(['editName', 'isSetDefault']);

function samePresetValue(left: unknown, right: unknown): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
        return Number.isFinite(left) && Number.isFinite(right)
            ? Math.abs(left - right) <= PRESET_NUMBER_EPSILON
            : Object.is(left, right);
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right)
            && left.length === right.length
            && left.every((item, index) => samePresetValue(item, right[index]));
    }
    const leftRecord = record(left);
    const rightRecord = record(right);
    if (leftRecord || rightRecord) {
        if (!leftRecord || !rightRecord) return false;
        const leftKeys = Object.keys(leftRecord).filter(item => !PRESET_IDENTITY_FIELDS.has(item)).sort();
        const rightKeys = Object.keys(rightRecord).filter(item => !PRESET_IDENTITY_FIELDS.has(item)).sort();
        return leftKeys.length === rightKeys.length
            && leftKeys.every((item, index) => item === rightKeys[index]
                && samePresetValue(leftRecord[item], rightRecord[item]));
    }
    return Object.is(left, right);
}

function createPreset(
    root: JsonRecord,
    category: string,
    family: string,
    name: string,
    configure: (preset: JsonRecord) => void,
) {
    const presets = presetFamily(root, category, family);
    const source = Object.values(presets).map(record).find((item): item is JsonRecord => Boolean(item));
    if (!source) throw new TypeError(`EasyEDA DRC preset family is empty: ${category}.${family}`);
    const output = clone<JsonRecord>(source);
    output.editName = name;
    output.isSetDefault = false;
    configure(output);
    const existing = Object.entries(presets).find(([existingName, value]) => {
        const candidate = record(value);
        return existingName !== 'default' && candidate?.isSetDefault !== true
            && samePresetValue(candidate, output);
    });
    if (existing) return { name: existing[0], preset: record(existing[1])! };
    presets[name] = output;
    return { name, preset: output };
}

function rewriteNumbers(value: unknown, replacement: number): unknown {
    if (typeof value === 'number') return replacement;
    if (Array.isArray(value)) return value.map(item => rewriteNumbers(item, replacement));
    const target = record(value);
    if (target) for (const [key, child] of Object.entries(target)) {
        target[key] = rewriteNumbers(child, replacement);
    }
    return value;
}

function replaceNamedValues(value: unknown, fields: Readonly<Record<string, number>>) {
    if (Array.isArray(value)) {
        for (const child of value) replaceNamedValues(child, fields);
        return;
    }
    const target = record(value);
    if (!target) return;
    for (const [key, child] of Object.entries(target)) {
        if (fields[key] !== undefined) target[key] = fields[key];
        else replaceNamedValues(child, fields);
    }
}

function replaceNamedTables(value: unknown, fields: Readonly<Record<string, number>>) {
    if (Array.isArray(value)) {
        for (const child of value) replaceNamedTables(child, fields);
        return;
    }
    const target = record(value);
    if (!target) return;
    for (const [key, child] of Object.entries(target)) {
        if (fields[key] !== undefined) target[key] = rewriteNumbers(child, fields[key]);
        else replaceNamedTables(child, fields);
    }
}

function netOccurrences(netRules: readonly PcbDrcNetRuleEntry[], name: string) {
    const result: PcbDrcNetRule[] = [];
    for (const rule of netRules) {
        if (rule.type === 'net' && rule.name === name) result.push(rule);
        if (rule.type === 'netClass' || rule.type === 'equalLengthGroup') {
            for (const child of rule.sub) if (child.name === name) result.push(child);
        }
    }
    return result;
}

function sourceNetRule(netRules: readonly PcbDrcNetRuleEntry[], name: string): PcbDrcNetRule {
    return clone(netOccurrences(netRules, name)[0] ?? { type: 'net', name });
}

function memberRules(
    netRules: readonly PcbDrcNetRuleEntry[],
    current: readonly PcbDrcNetRule[],
    names: readonly string[],
) {
    const existing = new Map(current.map(item => [item.name, item]));
    return names.map(name => clone(existing.get(name) ?? sourceNetRule(netRules, name)));
}

function ensureNetClass(
    netRules: PcbDrcNetRuleEntry[],
    name: string,
    nets: readonly string[],
) {
    let rule = netRules.find((item): item is PcbDrcNetClassRule => item.type === 'netClass' && item.name === name);
    if (!rule) {
        rule = { type: 'netClass', name, sub: [] };
        netRules.push(rule);
    }
    rule.sub = memberRules(netRules, rule.sub, nets);
    return rule;
}

function ensureEqualLengthGroup(
    netRules: PcbDrcNetRuleEntry[],
    name: string,
    nets: readonly string[],
) {
    let rule = netRules.find((item): item is PcbDrcEqualLengthGroupRule => (
        item.type === 'equalLengthGroup' && item.name === name
    ));
    if (!rule) {
        rule = { type: 'equalLengthGroup', name, sub: [] };
        netRules.push(rule);
    }
    rule.sub = memberRules(netRules, rule.sub, nets);
    return rule;
}

function ensureDifferentialPair(
    netRules: PcbDrcNetRuleEntry[],
    pair: { id: string; positive: string; negative: string },
) {
    let rule = netRules.find((item): item is PcbDrcDifferentialPairRule => (
        item.type === 'differentialPair' && item.name === pair.id
    ));
    if (!rule) {
        rule = {
            type: 'differentialPair',
            name: pair.id,
            positiveNet: pair.positive,
            negativeNet: pair.negative,
            sub: [],
        };
        netRules.push(rule);
    }
    rule.positiveNet = pair.positive;
    rule.negativeNet = pair.negative;
    rule.sub = memberRules(netRules, rule.sub, [pair.positive, pair.negative])
        .map(item => ({ type: 'net', name: item.name }));
    return rule;
}

const PHYSICAL_FIELDS = ['Track', 'Via Size', 'Safe Spacing'] as const;
const TRACK_MAX_WIDTH_MARGIN_MM = 1;

function maximumTrackWidth(values: RoutingRuleValues) {
    return Math.max(values.minTrackWidthMm, values.preferredTrackWidthMm) + TRACK_MAX_WIDTH_MARGIN_MM;
}

function updateTrackPreset(candidate: JsonRecord | undefined, values: RoutingRuleValues, required = false) {
    const formData = record(record(candidate?.form)?.data);
    const widthEntry = formData && (record(formData['1']) ?? Object.values(formData).map(record).find(Boolean));
    if (!widthEntry) {
        if (required) throw new TypeError('EasyEDA Track preset does not expose form.data width fields.');
        return;
    }
    widthEntry.minValue = values.minTrackWidthMm;
    widthEntry.defaultValue = values.preferredTrackWidthMm;
    widthEntry.maxValue = maximumTrackWidth(values);
}

function updateViaPreset(candidate: JsonRecord | undefined, values: RoutingRuleValues) {
    if (!candidate) return;
    replaceNamedValues(candidate, {
        viaOuterdiameterMin: values.via.minDiameterMm,
        viaOuterdiameterDefault: values.via.preferredDiameterMm,
        viaOuterdiameterMax: Math.max(values.via.minDiameterMm, values.via.preferredDiameterMm),
        viaInnerdiameterMin: values.via.minDrillMm,
        viaInnerdiameterDefault: values.via.preferredDrillMm,
        viaInnerdiameterMax: Math.max(values.via.minDrillMm, values.via.preferredDrillMm),
    });
}

function updateSpacingPreset(candidate: unknown, clearanceMm: number) {
    if (Array.isArray(candidate)) {
        for (const child of candidate) updateSpacingPreset(child, clearanceMm);
        return;
    }
    const item = record(candidate);
    if (!item) return;
    for (const [key, child] of Object.entries(item)) {
        if (key === 'content') item[key] = rewriteNumbers(child, clearanceMm);
        else updateSpacingPreset(child, clearanceMm);
    }
}

function copyFields(source: PcbDrcNetRule | RelationRule, targets: readonly PcbDrcNetRule[], fields = PHYSICAL_FIELDS) {
    for (const target of targets) for (const field of fields) {
        if (source[field] === undefined) delete target[field];
        else target[field] = source[field];
    }
}

function assignPhysicalPresets(
    configuration: JsonRecord,
    rule: PcbDrcNetRule | RelationRule,
    values: RoutingRuleValues,
    prefix: string,
) {
    const track = createPreset(
        configuration,
        'Physics',
        'Track',
        `${prefix}_track`,
        preset => updateTrackPreset(preset, values, true),
    );
    rule.Track = track.name;

    const via = createPreset(
        configuration,
        'Physics',
        'Via Size',
        `${prefix}_via`,
        preset => updateViaPreset(preset, values),
    );
    rule['Via Size'] = via.name;

    const spacing = createPreset(
        configuration,
        'Spacing',
        'Safe Spacing',
        `${prefix}_spacing`,
        preset => updateSpacingPreset(preset, values.clearanceMm),
    );
    rule['Safe Spacing'] = spacing.name;
}

function assignDifferentialPreset(
    configuration: JsonRecord,
    netRules: PcbDrcNetRuleEntry[],
    pair: { id: string; positive: string; negative: string },
    values: RoutingRuleValues,
    index: number,
) {
    if (!values.differential) return;
    const differential = values.differential;
    const name = `copilot_router_diff_${index}`;
    const selection = createPreset(configuration, 'Physics', 'Differential Pair', name, preset => {
        replaceNamedTables(preset, {
            strokeWidthTables: differential.trackWidthMm,
            diffPairSpacingTables: differential.gapMm,
        });
        if (differential.maxSkewMm !== undefined) replaceNamedValues(
            preset,
            { differentailPairLenTolerMax: differential.maxSkewMm },
        );
    });
    for (const net of [pair.positive, pair.negative]) {
        for (const occurrence of netOccurrences(netRules, net)) occurrence['Differential Pair'] = selection.name;
    }
}

function copperZonePadModels(preset: JsonRecord) {
    const form = record(preset.form);
    if (!form) throw new TypeError('EasyEDA Copper Zone preset does not expose form fields.');
    return ['singleLayerPadModel', 'multiLayerPadModel'].map(name => {
        const model = record(form[name]);
        const data = record(model?.data);
        const entry = data && (record(data['1']) ?? Object.values(data).map(record).find(Boolean));
        if (!model || !entry) {
            throw new TypeError(`EasyEDA Copper Zone preset does not expose ${name}.data fields.`);
        }
        model.status = 1;
        return entry;
    });
}

function assignCopperZonePreset(
    configuration: JsonRecord,
    netRules: PcbDrcNetRuleEntry[],
    zone: EasyEdaRoutingApplication['zones'][number],
    index: number,
) {
    let occurrences = netOccurrences(netRules, zone.net);
    if (!occurrences.length) {
        const rule = sourceNetRule(netRules, zone.net);
        netRules.push(rule);
        occurrences = [rule];
    }

    if (zone.clearanceMm !== undefined) {
        const spacingName = `copilot_router_zone_${index}_spacing`;
        const spacing = createPreset(configuration, 'Spacing', 'Safe Spacing', spacingName, preset => {
            const updateContent = (value: unknown) => {
                if (Array.isArray(value)) {
                    for (const child of value) updateContent(child);
                    return;
                }
                const item = record(value);
                if (!item) return;
                for (const [key, child] of Object.entries(item)) {
                    if (key === 'content') item[key] = rewriteNumbers(child, zone.clearanceMm!);
                    else updateContent(child);
                }
            };
            updateContent(preset);
        });
        for (const rule of occurrences) rule['Copper Safe Spacing'] = spacing.name;
    }

    const padConnection = zone.padConnection
        ?? (zone.connection === undefined ? undefined : { mode: zone.connection });
    if (!padConnection) return;

    const presetName = `copilot_router_zone_${index}_copper`;
    const connectMode = { thermal: 0, solid: 1, none: 2 }[padConnection.mode];
    const selection = createPreset(configuration, 'Plane', 'Copper Zone', presetName, preset => {
        for (const model of copperZonePadModels(preset)) {
            model.connectMode = connectMode;
            if (padConnection.thermalGapMm !== undefined) model.lineClearance = padConnection.thermalGapMm;
            if (padConnection.spokeWidthMm !== undefined) model.lineWidth = padConnection.spokeWidthMm;
            if (padConnection.spokeAngleDeg !== undefined) model.lineAngle = padConnection.spokeAngleDeg;
        }
    });
    for (const rule of occurrences) rule['Copper Zone'] = selection.name;
}

/** Add native per-net copper clearance and thermal presets requested by routed zones. */
export function routingZonesToEasyEdaDrcBundle(
    source: PcbDrcBundle,
    zones: EasyEdaRoutingApplication['zones'],
): PcbDrcBundle {
    const ruleConfiguration = clone(source.ruleConfiguration);
    const netRules = clone(source.netRules);
    const byNet = new Map<string, EasyEdaRoutingApplication['zones'][number]>();

    for (const zone of zones) {
        if (zone.clearanceMm === undefined && zone.connection === undefined && zone.padConnection === undefined) {
            continue;
        }
        // EasyEDA exposes Copper Zone settings per net, not per zone. Keep every
        // zone geometry and let the last declared zone select the effective native
        // policy, matching the DSL's normal cascading override semantics.
        byNet.set(zone.net, zone);
    }

    [...byNet.values()].forEach((zone, index) => {
        assignCopperZonePreset(ruleConfiguration, netRules, zone, index);
    });
    return { ruleConfiguration, netRules };
}

function sameValues(left: RoutingRuleValues, right: RoutingRuleValues) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function sameNames(left: readonly string[], right: readonly string[]) {
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return sortedLeft.length === sortedRight.length
        && sortedLeft.every((item, index) => item === sortedRight[index]);
}

function changedKeys<T>(
    source: readonly T[] | undefined,
    target: readonly T[] | undefined,
    key: (item: T) => string,
    equal: (left: T, right: T) => boolean,
) {
    const before = new Map((source ?? []).map(item => [key(item), item]));
    const after = new Map((target ?? []).map(item => [key(item), item]));
    return new Set([...before.keys(), ...after.keys()].filter(name => {
        const left = before.get(name);
        const right = after.get(name);
        return !left || !right || !equal(left, right);
    }));
}

export type RoutingRulesDiff = Readonly<{
    defaultChanged: boolean;
    nets: ReadonlySet<string>;
    netClasses: ReadonlySet<string>;
    differentialPairs: ReadonlySet<string>;
    matchedGroups: ReadonlySet<string>;
    hasChanges: boolean;
}>;

export function diffRoutingRules(source: RoutingRules, target: RoutingRules): RoutingRulesDiff {
    const nets = changedKeys(source.nets, target.nets, item => item.net, (left, right) => sameValues(left.values, right.values));
    const netClasses = changedKeys(source.netClasses, target.netClasses, item => item.name, (left, right) => (
        sameNames(left.nets, right.nets) && sameValues(left.values, right.values)
    ));
    const differentialPairs = changedKeys(source.differentialPairs, target.differentialPairs, item => item.id, (left, right) => (
        left.positive === right.positive && left.negative === right.negative
    ));
    const matchedGroups = changedKeys(source.matchedGroups, target.matchedGroups, item => item.id, (left, right) => (
        sameNames(left.nets, right.nets) && left.toleranceMm === right.toleranceMm
    ));
    const defaultChanged = !sameValues(source.default, target.default);
    return {
        defaultChanged, nets, netClasses, differentialPairs, matchedGroups,
        hasChanges: defaultChanged || nets.size > 0 || netClasses.size > 0
            || differentialPairs.size > 0 || matchedGroups.size > 0,
    };
}

function preset(configuration: JsonRecord, category: string, family: string, name: unknown) {
    const presets = presetFamily(configuration, category, family);
    if (typeof name === 'string' && record(presets[name])) return record(presets[name]);
    return Object.values(presets).map(record).find(item => item?.isSetDefault === true)
        ?? Object.values(presets).map(record).find(Boolean);
}

function nestedNumber(value: unknown, key: string): number | undefined {
    if (Array.isArray(value)) for (const child of value) {
        const found = nestedNumber(child, key);
        if (found !== undefined) return found;
    }
    const item = record(value);
    if (!item) return undefined;
    const firstNumber = (candidate: unknown): number | undefined => {
        if (typeof candidate === 'number') return candidate;
        if (Array.isArray(candidate)) for (const child of candidate) {
            const found = firstNumber(child);
            if (found !== undefined) return found;
        }
        const nested = record(candidate);
        if (nested) for (const child of Object.values(nested)) {
            const found = firstNumber(child);
            if (found !== undefined) return found;
        }
        return undefined;
    };
    if (item[key] !== undefined) return firstNumber(item[key]);
    for (const child of Object.values(item)) {
        const found = nestedNumber(child, key);
        if (found !== undefined) return found;
    }
    return undefined;
}

function valuesFromNativeRule(
    configuration: JsonRecord,
    rule: PcbDrcNetRuleEntry,
    fallback: RoutingRuleValues,
): RoutingRuleValues {
    const track = preset(configuration, 'Physics', 'Track', rule.Track);
    const via = preset(configuration, 'Physics', 'Via Size', rule['Via Size']);
    const spacing = preset(configuration, 'Spacing', 'Safe Spacing', rule['Safe Spacing']);
    return {
        ...fallback,
        minTrackWidthMm: nestedNumber(track, 'minValue') ?? fallback.minTrackWidthMm,
        preferredTrackWidthMm: nestedNumber(track, 'defaultValue') ?? fallback.preferredTrackWidthMm,
        clearanceMm: nestedNumber(spacing, 'content') ?? fallback.clearanceMm,
        via: {
            minDiameterMm: nestedNumber(via, 'viaOuterdiameterMin') ?? fallback.via.minDiameterMm,
            preferredDiameterMm: nestedNumber(via, 'viaOuterdiameterDefault') ?? fallback.via.preferredDiameterMm,
            minDrillMm: nestedNumber(via, 'viaInnerdiameterMin') ?? fallback.via.minDrillMm,
            preferredDrillMm: nestedNumber(via, 'viaInnerdiameterDefault') ?? fallback.via.preferredDrillMm,
        },
    };
}

/** Add the native EasyEDA relation state that is absent from autoroute JSON. */
export function mergeEasyEdaDrcIntoRoutingRules(source: PcbDrcBundle, rules: RoutingRules): RoutingRules {
    const valuesByNet = new Map(rules.nets.map(item => [item.net, item.values]));
    const netClasses = source.netRules.filter((item): item is PcbDrcNetClassRule => item.type === 'netClass').map(item => ({
        name: item.name,
        nets: item.sub.map(net => net.name),
        values: valuesFromNativeRule(
            source.ruleConfiguration,
            item,
            valuesByNet.get(item.sub[0]?.name ?? '') ?? rules.default,
        ),
    }));
    const differentialPairs = source.netRules
        .filter((item): item is PcbDrcDifferentialPairRule => item.type === 'differentialPair')
        .map(item => ({ id: item.name, positive: item.positiveNet, negative: item.negativeNet }));
    const matchedGroups = source.netRules
        .filter((item): item is PcbDrcEqualLengthGroupRule => item.type === 'equalLengthGroup')
        .map(item => ({
            id: item.name,
            nets: item.sub.map(net => net.name),
            toleranceMm: nestedNumber(
                preset(source.ruleConfiguration, 'Physics', 'Net Length Tolerance', item['Net Length Tolerance']),
                'netLengthTolerance',
            ) ?? 25.4,
        }));
    const {
        netClasses: _autorouteNetClasses,
        differentialPairs: _autorouteDifferentialPairs,
        matchedGroups: _autorouteMatchedGroups,
        ...physicalRules
    } = rules;
    return {
        ...physicalRules,
        ...(netClasses.length ? { netClasses } : {}),
        ...(differentialPairs.length ? { differentialPairs } : {}),
        ...(matchedGroups.length ? { matchedGroups } : {}),
    };
}

export type CompactDrcRange = Readonly<{
    min?: number;
    preferred?: number;
    max?: number;
}>;

export type CompactPhysicalDrc = Readonly<{
    trackWidthMm?: CompactDrcRange;
    viaDiameterMm?: CompactDrcRange;
    viaDrillMm?: CompactDrcRange;
    clearanceMm?: Readonly<Record<string, number>>;
}>;

export type CompactPcbDrcRules = Readonly<{
    global: CompactPhysicalDrc;
    netClasses?: Readonly<Record<string, CompactPhysicalDrc & Readonly<{ nets: readonly string[] }>>>;
    differentialPairs?: Readonly<Record<string, Readonly<{
        positive: string;
        negative: string;
        trackWidthMm?: CompactDrcRange;
        gapMm?: CompactDrcRange;
        maxSkewMm?: number;
    }>>>;
    equalLengthGroups?: Readonly<Record<string, CompactPhysicalDrc & Readonly<{
        nets: readonly string[];
        target?: string;
        toleranceMm?: number;
    }>>>;
    netOverrides?: Readonly<Record<string, CompactPhysicalDrc>>;
    warnings?: readonly string[];
}>;

function roundMm(value: number | undefined) {
    return value === undefined || !Number.isFinite(value)
        ? undefined
        : Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

function compactPreset(
    configuration: JsonRecord,
    category: string,
    family: string,
    name: unknown,
    warnings: string[],
    path: string,
) {
    const presets = record(record(configuration[category])?.[family]);
    if (!presets) {
        warnings.push(`${path}: missing preset family ${category}.${family}`);
        return undefined;
    }
    if (typeof name === 'string' && name !== 'default') {
        const selected = record(presets[name]);
        if (!selected) warnings.push(`${path}: missing preset ${name}`);
        return selected;
    }
    return Object.values(presets).map(record).find(item => item?.isSetDefault === true)
        ?? Object.values(presets).map(record).find(Boolean);
}

function rangeFromData(value: unknown): CompactDrcRange | undefined {
    const data = record(record(value)?.data);
    const entry = data && (record(data['1']) ?? Object.values(data).map(record).find(Boolean));
    if (!entry) return undefined;
    const output = {
        ...(roundMm(typeof entry.minValue === 'number' ? entry.minValue : undefined) === undefined
            ? {} : { min: roundMm(entry.minValue as number)! }),
        ...(roundMm(typeof entry.defaultValue === 'number' ? entry.defaultValue : undefined) === undefined
            ? {} : { preferred: roundMm(entry.defaultValue as number)! }),
        ...(roundMm(typeof entry.maxValue === 'number' ? entry.maxValue : undefined) === undefined
            ? {} : { max: roundMm(entry.maxValue as number)! }),
    };
    return Object.keys(output).length ? output : undefined;
}

function trackRange(value: unknown) {
    return rangeFromData(record(value)?.form);
}

function viaRanges(value: unknown) {
    const diameter = {
        min: roundMm(nestedNumber(value, 'viaOuterdiameterMin')),
        preferred: roundMm(nestedNumber(value, 'viaOuterdiameterDefault')),
        max: roundMm(nestedNumber(value, 'viaOuterdiameterMax')),
    };
    const drill = {
        min: roundMm(nestedNumber(value, 'viaInnerdiameterMin')),
        preferred: roundMm(nestedNumber(value, 'viaInnerdiameterDefault')),
        max: roundMm(nestedNumber(value, 'viaInnerdiameterMax')),
    };
    const compact = (range: typeof diameter): CompactDrcRange | undefined => {
        const output = Object.fromEntries(Object.entries(range).filter(([, child]) => child !== undefined));
        return Object.keys(output).length ? output : undefined;
    };
    return { diameter: compact(diameter), drill: compact(drill) };
}

function clearanceValue(value: unknown, left: string, right: string) {
    const source = record(value);
    const rows = Array.isArray(source?.row) ? source.row : [];
    const columns = Array.isArray(source?.column) ? source.column : [];
    const tables = record(source?.tables);
    const table = tables && (record(tables['1']) ?? Object.values(tables).map(record).find(Boolean));
    const content = Array.isArray(table?.content) ? table.content : [];
    const at = (rowName: string, columnName: string) => {
        const rowIndex = rows.indexOf(rowName);
        const columnIndex = columns.indexOf(columnName);
        const row = rowIndex >= 0 && Array.isArray(content[rowIndex]) ? content[rowIndex] : undefined;
        const candidate = row && columnIndex >= 0 ? row[columnIndex] : undefined;
        return roundMm(typeof candidate === 'number' ? candidate : undefined);
    };
    return at(left, right) ?? at(right, left);
}

function clearanceSummary(value: unknown): Readonly<Record<string, number>> | undefined {
    const smdPad = clearanceValue(value, 'Track', 'SMD Pad');
    const thPad = clearanceValue(value, 'Track', 'TH Pad');
    const output: Record<string, number | undefined> = {
        trackTrack: clearanceValue(value, 'Track', 'Track'),
        ...(smdPad === thPad ? { trackPad: smdPad } : { trackSmdPad: smdPad, trackThPad: thPad }),
        trackVia: clearanceValue(value, 'Track', 'Via'),
        trackCopper: clearanceValue(value, 'Track', 'Copper/Plane Zone'),
        trackBoard: clearanceValue(value, 'Track', 'Board Outline'),
        trackHole: clearanceValue(value, 'Track', 'Hole'),
    };
    const compact = Object.fromEntries(Object.entries(output).filter(([, child]) => child !== undefined)) as Record<string, number>;
    return Object.keys(compact).length ? compact : undefined;
}

function globalPhysicalDrc(configuration: JsonRecord, warnings: string[]): CompactPhysicalDrc {
    const track = compactPreset(configuration, 'Physics', 'Track', undefined, warnings, 'global.Track');
    const via = compactPreset(configuration, 'Physics', 'Via Size', undefined, warnings, 'global.Via Size');
    const spacing = compactPreset(configuration, 'Spacing', 'Safe Spacing', undefined, warnings, 'global.Safe Spacing');
    const viaSummary = viaRanges(via);
    return {
        ...(trackRange(track) ? { trackWidthMm: trackRange(track) } : {}),
        ...(viaSummary.diameter ? { viaDiameterMm: viaSummary.diameter } : {}),
        ...(viaSummary.drill ? { viaDrillMm: viaSummary.drill } : {}),
        ...(clearanceSummary(spacing) ? { clearanceMm: clearanceSummary(spacing) } : {}),
    };
}

function effectivePhysicalDrc(
    configuration: JsonRecord,
    rule: PcbDrcNetRuleEntry,
    fallback: CompactPhysicalDrc,
    warnings: string[],
    path: string,
): CompactPhysicalDrc {
    const track = typeof rule.Track === 'string'
        ? compactPreset(configuration, 'Physics', 'Track', rule.Track, warnings, `${path}.Track`)
        : undefined;
    const via = typeof rule['Via Size'] === 'string'
        ? compactPreset(configuration, 'Physics', 'Via Size', rule['Via Size'], warnings, `${path}.Via Size`)
        : undefined;
    const spacing = typeof rule['Safe Spacing'] === 'string'
        ? compactPreset(configuration, 'Spacing', 'Safe Spacing', rule['Safe Spacing'], warnings, `${path}.Safe Spacing`)
        : undefined;
    const viaSummary = viaRanges(via);
    return {
        trackWidthMm: trackRange(track) ?? fallback.trackWidthMm,
        viaDiameterMm: viaSummary.diameter ?? fallback.viaDiameterMm,
        viaDrillMm: viaSummary.drill ?? fallback.viaDrillMm,
        clearanceMm: clearanceSummary(spacing) ?? fallback.clearanceMm,
    };
}

function physicalDifference(base: CompactPhysicalDrc, target: CompactPhysicalDrc): CompactPhysicalDrc {
    const changed = <T>(left: T, right: T) => JSON.stringify(left) !== JSON.stringify(right);
    return {
        ...(changed(base.trackWidthMm, target.trackWidthMm) ? { trackWidthMm: target.trackWidthMm } : {}),
        ...(changed(base.viaDiameterMm, target.viaDiameterMm) ? { viaDiameterMm: target.viaDiameterMm } : {}),
        ...(changed(base.viaDrillMm, target.viaDrillMm) ? { viaDrillMm: target.viaDrillMm } : {}),
        ...(changed(base.clearanceMm, target.clearanceMm) ? { clearanceMm: target.clearanceMm } : {}),
    };
}

function hasPhysicalDrc(value: CompactPhysicalDrc) {
    return Object.values(value).some(child => child !== undefined);
}

/** Compact routing-relevant projection of the native EasyEDA DRC bundle. */
export function summarizeEasyEdaDrcBundle(source: PcbDrcBundle): CompactPcbDrcRules {
    const warnings: string[] = [];
    const global = globalPhysicalDrc(source.ruleConfiguration, warnings);
    const netOverrides: Record<string, CompactPhysicalDrc> = {};
    const addNetOverride = (net: string, value: CompactPhysicalDrc) => {
        if (!hasPhysicalDrc(value)) return;
        netOverrides[net] = { ...netOverrides[net], ...value };
    };

    const netClasses: Record<string, CompactPhysicalDrc & { nets: readonly string[] }> = {};
    const classPhysicalByNet = new Map<string, CompactPhysicalDrc>();
    for (const rule of source.netRules) if (rule.type === 'netClass') {
        const effective = effectivePhysicalDrc(source.ruleConfiguration, rule, global, warnings, `netClasses.${rule.name}`);
        netClasses[rule.name] = { nets: rule.sub.map(member => member.name), ...physicalDifference(global, effective) };
        for (const member of rule.sub) {
            classPhysicalByNet.set(member.name, effective);
            const memberEffective = effectivePhysicalDrc(
                source.ruleConfiguration, member, effective, warnings, `netClasses.${rule.name}.${member.name}`,
            );
            addNetOverride(member.name, physicalDifference(effective, memberEffective));
        }
    }

    const differentialPairs: Record<string, {
        positive: string;
        negative: string;
        trackWidthMm?: CompactDrcRange;
        gapMm?: CompactDrcRange;
        maxSkewMm?: number;
    }> = {};
    for (const rule of source.netRules) if (rule.type === 'differentialPair') {
        const presetNames = [...new Set([rule.positiveNet, rule.negativeNet]
            .flatMap(net => netOccurrences(source.netRules, net))
            .map(member => member['Differential Pair'])
            .filter((name): name is string => typeof name === 'string'))];
        if (presetNames.length > 1) warnings.push(`differentialPairs.${rule.name}: members use different presets`);
        const selected = presetNames.length
            ? compactPreset(
                source.ruleConfiguration, 'Physics', 'Differential Pair', presetNames[0], warnings,
                `differentialPairs.${rule.name}`,
            )
            : undefined;
        const form = record(selected?.form);
        const width = rangeFromData(form?.strokeWidthTables);
        const gap = rangeFromData(form?.diffPairSpacingTables);
        const maxSkewMm = roundMm(nestedNumber(selected, 'differentailPairLenTolerMax'));
        differentialPairs[rule.name] = {
            positive: rule.positiveNet,
            negative: rule.negativeNet,
            ...(width ? { trackWidthMm: width } : {}),
            ...(gap ? { gapMm: gap } : {}),
            ...(maxSkewMm === undefined ? {} : { maxSkewMm }),
        };
    }

    const equalLengthGroups: Record<string, CompactPhysicalDrc & {
        nets: readonly string[];
        target?: string;
        toleranceMm?: number;
    }> = {};
    for (const rule of source.netRules) if (rule.type === 'equalLengthGroup') {
        const effective = effectivePhysicalDrc(source.ruleConfiguration, rule, global, warnings, `equalLengthGroups.${rule.name}`);
        const groupPhysicalOverrides = physicalDifference(global, effective);
        const toleranceName = typeof rule['Net Length Tolerance'] === 'string'
            ? rule['Net Length Tolerance']
            : rule.sub.map(member => member['Net Length Tolerance'])
                .find((name): name is string => typeof name === 'string');
        const tolerancePreset = toleranceName === undefined
            ? undefined
            : compactPreset(
                source.ruleConfiguration, 'Physics', 'Net Length Tolerance', toleranceName, warnings,
                `equalLengthGroups.${rule.name}.Net Length Tolerance`,
            );
        const toleranceMm = roundMm(nestedNumber(tolerancePreset, 'netLengthTolerance'));
        const target = typeof rule.targetNet === 'string' && rule.targetNet
            ? rule.targetNet
            : rule.sub.map(member => member.targetNet).find((name): name is string => typeof name === 'string' && Boolean(name));
        equalLengthGroups[rule.name] = {
            nets: rule.sub.map(member => member.name),
            ...(target ? { target } : {}),
            ...(toleranceMm === undefined ? {} : { toleranceMm }),
            ...groupPhysicalOverrides,
        };
        for (const member of rule.sub) {
            const memberBase = { ...(classPhysicalByNet.get(member.name) ?? global), ...groupPhysicalOverrides };
            const memberEffective = effectivePhysicalDrc(
                source.ruleConfiguration, member, memberBase, warnings, `equalLengthGroups.${rule.name}.${member.name}`,
            );
            addNetOverride(member.name, physicalDifference(memberBase, memberEffective));
        }
    }

    for (const rule of source.netRules) if (rule.type === 'net') {
        const effective = effectivePhysicalDrc(source.ruleConfiguration, rule, global, warnings, `netOverrides.${rule.name}`);
        addNetOverride(rule.name, physicalDifference(global, effective));
    }

    return {
        global,
        ...(Object.keys(netClasses).length ? { netClasses } : {}),
        ...(Object.keys(differentialPairs).length ? { differentialPairs } : {}),
        ...(Object.keys(equalLengthGroups).length ? { equalLengthGroups } : {}),
        ...(Object.keys(netOverrides).length ? { netOverrides } : {}),
        ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}),
    };
}

function updateDefaultPhysicalPresets(configuration: JsonRecord, values: RoutingRuleValues) {
    updateTrackPreset(preset(configuration, 'Physics', 'Track', undefined), values);
    updateViaPreset(preset(configuration, 'Physics', 'Via Size', undefined), values);
    updateSpacingPreset(preset(configuration, 'Spacing', 'Safe Spacing', undefined), values.clearanceMm);
}

/** Translate fully materialized EDA-neutral rules to native EasyEDA DRC trees. */
export function routingRulesToEasyEdaDrcBundle(
    source: PcbDrcBundle,
    sourceRules: RoutingRules,
    rules: RoutingRules,
): PcbDrcBundle {
    const ruleConfiguration = clone(source.ruleConfiguration);
    let netRules = clone(source.netRules);
    const changes = diffRoutingRules(sourceRules, rules);
    if (!changes.hasChanges) return { ruleConfiguration, netRules };
    if (changes.defaultChanged) updateDefaultPhysicalPresets(ruleConfiguration, rules.default);
    const valuesByNet = new Map(rules.nets.map(item => [item.net, item.values]));
    const classForNet = new Map<string, NonNullable<RoutingRules['netClasses']>[number]>();
    const classRuleForNet = new Map<string, PcbDrcNetClassRule>();

    for (const [index, item] of (rules.netClasses ?? []).entries()) {
        const classRule = ensureNetClass(netRules, item.name, item.nets);
        if (changes.netClasses.has(item.name)) {
            assignPhysicalPresets(ruleConfiguration, classRule, item.values, `copilot_router_class_${index}`);
            copyFields(classRule, classRule.sub);
        }
        for (const net of item.nets) {
            classForNet.set(net, item);
            classRuleForNet.set(net, classRule);
        }
    }
    const targetClassNames = new Set((rules.netClasses ?? []).map(item => item.name));
    netRules = netRules.filter(rule => rule.type !== 'netClass' || targetClassNames.has(rule.name));

    for (const [index, assignment] of rules.nets.entries()) {
        if (!changes.nets.has(assignment.net)) continue;
        const inheritedClass = classForNet.get(assignment.net);
        if (inheritedClass && sameValues(inheritedClass.values, assignment.values)) {
            copyFields(classRuleForNet.get(assignment.net)!, netOccurrences(netRules, assignment.net));
            continue;
        }
        let occurrences = netOccurrences(netRules, assignment.net);
        if (!occurrences.length) {
            const rule: PcbDrcNetRule = { type: 'net', name: assignment.net };
            netRules.push(rule);
            occurrences = [rule];
        }
        const assignmentRule = clone(occurrences[0]);
        assignPhysicalPresets(ruleConfiguration, assignmentRule, assignment.values, `copilot_router_net_${index}`);
        copyFields(assignmentRule, occurrences);
    }

    for (const [index, group] of (rules.matchedGroups ?? []).entries()) {
        const groupRule = ensureEqualLengthGroup(netRules, group.id, group.nets);
        if (!changes.matchedGroups.has(group.id)) continue;
        const name = `copilot_router_match_${index}`;
        const tolerance = createPreset(ruleConfiguration, 'Physics', 'Net Length Tolerance', name, preset => {
            replaceNamedValues(preset, { netLengthTolerance: group.toleranceMm });
        });
        groupRule['Net Length Tolerance'] = tolerance.name;
        for (const member of groupRule.sub) member['Net Length Tolerance'] = tolerance.name;
    }
    const targetGroupNames = new Set((rules.matchedGroups ?? []).map(item => item.id));
    netRules = netRules.filter(rule => rule.type !== 'equalLengthGroup' || targetGroupNames.has(rule.name));

    // Native EasyEDA stores class/group members below their relation nodes instead
    // of retaining an additional top-level net entry. Differential-pair nodes are
    // supplementary and therefore do not affect this primary placement.
    const groupedNets = new Set([
        ...(rules.netClasses ?? []).flatMap(item => item.nets),
        ...(rules.matchedGroups ?? []).flatMap(item => item.nets),
    ]);
    const primaryNames = new Set(netRules.filter(rule => rule.type === 'net').map(rule => rule.name));
    for (const assignment of rules.nets) if (!groupedNets.has(assignment.net) && !primaryNames.has(assignment.net)) {
        netRules.push(sourceNetRule(source.netRules, assignment.net));
    }
    const nativeNetRules = netRules.filter(rule => rule.type !== 'net' || !groupedNets.has(rule.name));

    // Differential-pair nodes are supplementary. Apply them only after the
    // primary net/class/length-group placement is final, so a restored
    // standalone net receives (or loses) the pair preset as well.
    const targetPairMembers = new Set((rules.differentialPairs ?? []).flatMap(pair => [pair.positive, pair.negative]));
    const affectedPairMembers = new Set([
        ...(sourceRules.differentialPairs ?? []),
        ...(rules.differentialPairs ?? []),
    ].filter(pair => changes.differentialPairs.has(pair.id)).flatMap(pair => [pair.positive, pair.negative]));
    for (const rule of nativeNetRules) if (rule.type !== 'differentialPair') for (const net of (
        rule.type === 'net' ? [rule] : rule.sub
    )) if (affectedPairMembers.has(net.name) && !targetPairMembers.has(net.name)) {
        delete net['Differential Pair'];
    }
    for (const [index, pair] of (rules.differentialPairs ?? []).entries()) {
        ensureDifferentialPair(nativeNetRules, pair);
        if (!changes.differentialPairs.has(pair.id)) continue;
        const values = valuesByNet.get(pair.positive) ?? valuesByNet.get(pair.negative);
        if (values) assignDifferentialPreset(ruleConfiguration, nativeNetRules, pair, values, index);
    }
    const targetPairNames = new Set((rules.differentialPairs ?? []).map(item => item.id));
    const finalNetRules = nativeNetRules.filter(
        rule => rule.type !== 'differentialPair' || targetPairNames.has(rule.name),
    );

    return { ruleConfiguration, netRules: finalNetRules };
}
