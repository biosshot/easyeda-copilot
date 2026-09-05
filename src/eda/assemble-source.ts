import { CircuitAssembly } from "@copilot/shared/types/circuit";
import PQueue from "p-queue";
import { searchFreePlaceV2 } from "./free-place-searcher";
import { getLibraryUuidList, placeComponent } from "./place-component";
import { getAllPrimitivePins, getPrimitiveComponentPins, searchComponentInSCH } from "./search";
import { AddedNet, ECHOSYS_LIB, GND_PORT_COMPONENT, NET_PORT_COMPONENT, Offset, shortSymbolsMap, VCC_PORT_COMPONENT } from "./types";
import { getPageSize, normalizeWireLine, normWireY, rmPartFromDesignator, to2, VERSION_EDASYEDA, yieldToEventLoop } from "./utils";
import { sch_PrimitiveWireSnap } from "./wire-snap";
import {
    appendDocumentSource,
    cloneSourceRecord,
    getMaxTicket,
    getMaxZIndex,
    makeSourceId,
    parseDocumentSource,
    serializeDocumentSource,
    SourceRecord,
} from "./source-document";

type AssemblyComponent = CircuitAssembly['components'][number];
type PrimitiveComponent = ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1;
type LegacyAssembler = (circuit: CircuitAssembly) => Promise<void>;
type LegacyBlockDrawer = (blocks: CircuitAssembly['blocks_rect'], offset: Offset) => Promise<void>;

interface PlannedComponent {
    input: AssemblyComponent;
    layoutX: number;
    layoutY: number;
    apiX: number;
    apiY: number;
    templateKey: string;
    primitiveId?: string;
    pins?: ISCH_PrimitiveComponentPin[];
    replacement?: ReplacementContext;
}

interface ReplacementPinSnapshot {
    pinNumber: string;
    pinName: string;
    x: number;
    y: number;
    nets: string[];
}

interface ReplacementContext {
    oldPrimitiveId: string;
    oldPins: ReplacementPinSnapshot[];
    preservedAttributes: Map<string, unknown>;
    shiftX: number;
    shiftY: number;
}

interface ComponentTemplate {
    originApiX: number;
    originApiY: number;
    firstPlanSeeded: boolean;
    component: SourceRecord;
    attributes: SourceRecord[];
}

interface WireSpec {
    segments: WireSegment[];
    net: string;
    description: string;
}

type WireSegment = [number, number, number, number];

interface CachedComponentTemplate {
    projectUuid: string;
    templateKey: string;
    seedApiX: number;
    seedApiY: number;
    component: SourceRecord;
    attributes: SourceRecord[];
}

const componentTemplateCache = new Map<string, CachedComponentTemplate>();

function selectWireAttributeTemplates(records: SourceRecord[], parentId: string): SourceRecord[] {
    const selected = new Map<string, SourceRecord>();
    for (const record of records) {
        if (record.outer.type !== 'ATTR' || record.inner?.parentId !== parentId) continue;
        const key = String(record.inner.key ?? '');
        if (key !== 'NET' && key !== 'Relevance') continue;
        if (!selected.has(key)) selected.set(key, record);
    }
    return [...selected.values()];
}

function normalizeWireNetAttribute(attribute: Record<string, unknown>, net: string, segment: WireSegment): void {
    const [startX, startY, endX, endY] = segment;
    attribute.value = net;
    attribute.x = to2((startX + endX) / 2);
    attribute.y = to2((startY + endY) / 2);
    attribute.rotation = startX === endX ? 90 : null;
    attribute.color = null;
    attribute.fontFamily = null;
    attribute.fontSize = null;
    attribute.fontWeight = null;
    attribute.italic = null;
    attribute.underline = null;
    attribute.strikeout = false;
    attribute.align = null;
    attribute.fillColor = null;
    attribute.keyVisible = false;
    attribute.valueVisible = true;
}

const applyOffset = (x: number, y: number, offset: Offset) => {
    if (offset.x) x += offset.x;
    if (offset.y) y = offset.y - y;
    return { x, y };
};

const getComponentLayoutPosition = (component: AssemblyComponent) => ({
    x: component.pos.x + (component.pos.center?.x ?? component.pos.width / 2),
    y: component.pos.y + (component.pos.center?.y ?? component.pos.height / 2),
});

const getNetFlagKind = (component: AssemblyComponent) =>
    component.part_uuid === 'GND' || component.part_uuid === GND_PORT_COMPONENT.uuid
        ? 'Ground'
        : component.part_uuid === 'VCC' || component.part_uuid === VCC_PORT_COMPONENT.uuid
            ? 'Power'
            : undefined;

const usesNativeNetPort = (component: AssemblyComponent) =>
    component.part_uuid === NET_PORT_COMPONENT.uuid &&
    !eda.sys_Environment.isOnlineMode();

// After done(), BI needs +90 degrees to match the library port's pin orientation.
const getComponentRotation = (component: AssemblyComponent) =>
    normalizeRotation((component.pos.rotate ?? 0) + (usesNativeNetPort(component) ? 90 : 0));

const getSpecialSignalName = (component: AssemblyComponent) =>
    component.pins[0]?.signal_name || (getNetFlagKind(component) === 'Ground' ? 'GND' : 'VCC');

const isNamedNetSymbol = (component: AssemblyComponent) =>
    getNetFlagKind(component) !== undefined ||
    component.value === 'unknown_shortsym' ||
    component.designator.includes('|');

const getComponentTemplateKey = (component: AssemblyComponent) => JSON.stringify({
    partUuid: component.part_uuid,
    subPartName: component.sub_part_name ?? '',
    kind: component.part_uuid === 'GND'
        ? 'GND'
        : component.part_uuid === 'VCC'
            ? 'VCC'
            : component.value === 'unknown_shortsym'
                ? 'UNKNOWN_SHORT'
                : component.designator.includes('|')
                    ? 'ECOSYSTEM_SHORT'
                    : 'DEVICE',
});

const getDesignatorPartIndex = (component: AssemblyComponent): number | undefined => {
    const match = component.designator.trim().match(/\.(\d+)$/);
    if (!match) return undefined;
    const index = Number(match[1]);
    return Number.isInteger(index) && index > 0 ? index : undefined;
};

async function resolveMultipartSubPartNames(plans: PlannedComponent[]): Promise<void> {
    const unresolved = plans.filter(plan => !plan.input.sub_part_name && getDesignatorPartIndex(plan.input));
    if (!unresolved.length) return;

    const byPartUuid = new Map<string, PlannedComponent[]>();
    for (const plan of unresolved) {
        const partUuid = plan.input.part_uuid;
        if (!partUuid || partUuid === 'GND' || partUuid === 'VCC') continue;
        const group = byPartUuid.get(partUuid) ?? [];
        group.push(plan);
        byPartUuid.set(partUuid, group);
    }

    const libraryUuids = await getLibraryUuidList('lcsc');
    for (const [partUuid, partPlans] of byPartUuid) {
        let subPartNames: string[] = [];
        for (const libraryUuid of libraryUuids) {
            const device = await eda.lib_Device.get(partUuid, libraryUuid).catch(() => undefined);
            const names = device?.subPartNames as unknown as string[] | undefined;
            if (names?.length) {
                subPartNames = names;
                break;
            }
        }

        for (const plan of partPlans) {
            const index = getDesignatorPartIndex(plan.input)!;
            const subPartName = subPartNames[index - 1];
            if (!subPartName) {
                throw new Error(
                    `Cannot resolve multi-part ${plan.input.designator} for ${partUuid}; ` +
                    `library returned ${subPartNames.length} sub-parts`,
                );
            }
            plan.input.sub_part_name = subPartName;
            plan.templateKey = getComponentTemplateKey(plan.input);
            eda.sys_Log.add(
                `[source-assemble] Multi-part ${plan.input.designator} -> ${subPartName}`,
                ESYS_LogType.INFO,
            );
        }
    }
}

async function createSeedComponent(plan: PlannedComponent): Promise<PrimitiveComponent> {
    const component = plan.input;
    const partUuid = component.part_uuid;
    if (!partUuid) throw new Error(`Missing part_uuid for ${component.designator}`);

    const rotation = getComponentRotation(component);
    const mirror = component.pos.mirror ?? false;
    const netFlagKind = getNetFlagKind(component);
    let primitive: PrimitiveComponent | undefined;

    if (netFlagKind) {
        primitive = await eda.sch_PrimitiveComponent.createNetFlag(
            netFlagKind, getSpecialSignalName(component), to2(plan.apiX), to2(plan.apiY), rotation, mirror,
        );
    } else if (usesNativeNetPort(component)) {
        primitive = await eda.sch_PrimitiveComponent.createNetPort(
            'BI', getSpecialSignalName(component), to2(plan.apiX), to2(plan.apiY), rotation, mirror,
        );
    } else if (component.value === 'unknown_shortsym') {
        primitive = await placeComponent({ libraryUuid: 'lcsc', uuid: partUuid }, {
            x: plan.apiX,
            y: plan.apiY,
            rotate: rotation,
            mirror,
        });
    } else if (component.designator.includes('|')) {
        primitive = await placeComponent({ libraryUuid: ECHOSYS_LIB, uuid: partUuid }, {
            x: plan.apiX,
            y: plan.apiY,
            rotate: rotation,
            mirror,
        });
    } else {
        primitive = await placeComponent({ libraryUuid: 'lcsc', uuid: partUuid }, {
            x: plan.apiX,
            y: plan.apiY,
            rotate: rotation,
            mirror,
            subPartName: component.sub_part_name,
        });
        primitive = primitive.setState_Designator(rmPartFromDesignator(component.designator));
    }

    if (!primitive) throw new Error(`Component creation failed for ${component.designator}: ${partUuid}`);

    if (isNamedNetSymbol(component)) {
        const signalName = getSpecialSignalName(component);
        try {
            primitive.setState_Name(signalName);
            primitive.setState_OtherProperty({ "Global Net Name": signalName });
        } catch {
            // Some library symbols expose neither Name nor OtherProperty.
        }
    }

    const committed = await primitive.done();
    return (committed || primitive) as PrimitiveComponent;
}

function planComponents(circuit: CircuitAssembly, offset: Offset): PlannedComponent[] {
    return circuit.components
        .filter(component => Boolean(component.part_uuid))
        .map(originalInput => {
            const input = structuredClone(originalInput);
            const layout = getComponentLayoutPosition(input);
            const api = applyOffset(layout.x, layout.y, offset);
            return {
                input,
                layoutX: layout.x,
                layoutY: layout.y,
                apiX: to2(api.x),
                apiY: to2(api.y),
                templateKey: getComponentTemplateKey(input),
            };
        });
}

function groupPlans(plans: PlannedComponent[]): Map<string, PlannedComponent[]> {
    const groups = new Map<string, PlannedComponent[]>();
    for (const plan of plans) {
        const group = groups.get(plan.templateKey) ?? [];
        group.push(plan);
        groups.set(plan.templateKey, group);
    }
    return groups;
}

const getTemplateCacheKey = (projectUuid: string, templateKey: string) => `${projectUuid}:${templateKey}`;

async function cacheTemplatesFromCurrentPage(
    groups: Map<string, PlannedComponent[]>,
    projectUuid: string,
    records: SourceRecord[],
): Promise<number> {
    const missing = [...groups.entries()].filter(([key, group]) =>
        !componentTemplateCache.has(getTemplateCacheKey(projectUuid, key)) &&
        group[0].input.part_uuid !== 'GND' &&
        group[0].input.part_uuid !== 'VCC',
    );
    if (!missing.length) return 0;

    const primitives = await eda.sch_PrimitiveComponent.getAll().catch(() => []);
    let cached = 0;
    for (const primitive of primitives) {
        const componentState = primitive.getState_Component?.();
        if (!componentState?.uuid) continue;
        const subPartName = primitive.getState_SubPartName?.() ?? '';
        const candidate = missing.find(([key, group]) =>
            !componentTemplateCache.has(getTemplateCacheKey(projectUuid, key)) &&
            (
                (Boolean(group[0].input.sub_part_name) && group[0].input.sub_part_name === subPartName) ||
                (group[0].input.part_uuid === componentState.uuid && !group[0].input.sub_part_name)
            ),
        );
        if (!candidate) continue;

        const [templateKey] = candidate;
        const primitiveId = primitive.getState_PrimitiveId();
        const component = records.find(record =>
            record.outer.type === 'COMPONENT' && record.outer.id === primitiveId && record.inner,
        );
        if (!component) continue;
        const attributes = records.filter(record =>
            record.outer.type === 'ATTR' && record.inner?.parentId === primitiveId,
        );
        if (!attributes.length) continue;

        componentTemplateCache.set(getTemplateCacheKey(projectUuid, templateKey), {
            projectUuid,
            templateKey,
            seedApiX: to2(primitive.getState_X()),
            seedApiY: to2(primitive.getState_Y()),
            component: cloneSourceRecord(component),
            attributes: attributes.map(cloneSourceRecord),
        });
        cached++;
    }
    return cached;
}

async function placeSeeds(
    groups: Map<string, PlannedComponent[]>,
    projectUuid: string,
): Promise<Set<string>> {
    const seededKeys = new Set<string>();
    const pending = [...groups.entries()].filter(([key]) =>
        !componentTemplateCache.has(getTemplateCacheKey(projectUuid, key)),
    );
    if (!pending.length) return seededKeys;

    const commitSeed = async (key: string, seed: PlannedComponent) => {
        const primitive = await createSeedComponent(seed);
        seed.primitiveId = primitive.getState_PrimitiveId();
        seededKeys.add(key);
        eda.sys_Log.add(`[source-assemble] Seed ${seed.input.designator}: ${seed.primitiveId}`);
    };
    const placementQueue = new PQueue({ concurrency: 5 });
    const batchResults = await placementQueue.addAll(pending.map(([key, group]) => async () => {
        const seed = group[0];
        try {
            await commitSeed(key, seed);
            return { key, seed };
        } catch (error) {
            return { key, seed, error };
        }
    }));

    for (const failed of batchResults.filter(result => result.error)) {
        let lastError = failed.error;
        eda.sys_Log.add(
            `[source-assemble] Parallel seed failed for ${failed.seed.input.designator}; retrying serially: ` +
            `${(lastError as Error).message}`,
            ESYS_LogType.WARNING,
        );
        for (let attempt = 1; attempt <= 4; attempt++) {
            await new Promise<void>(resolve => setTimeout(resolve, attempt * 75));
            try {
                await commitSeed(failed.key, failed.seed);
                lastError = undefined;
                break;
            } catch (error) {
                lastError = error;
            }
        }
        if (lastError) {
            throw new Error(
                `Component seed failed for ${failed.seed.input.designator}: ${(lastError as Error).message}`,
            );
        }
    }
    return seededKeys;
}

function collectComponentTemplates(
    records: SourceRecord[],
    groups: Map<string, PlannedComponent[]>,
    projectUuid: string,
    seededKeys: Set<string>,
): Map<string, ComponentTemplate> {
    const templates = new Map<string, ComponentTemplate>();

    for (const [key, group] of groups) {
        const cached = componentTemplateCache.get(getTemplateCacheKey(projectUuid, key));
        if (cached && !seededKeys.has(key)) {
            templates.set(key, {
                originApiX: cached.seedApiX,
                originApiY: cached.seedApiY,
                firstPlanSeeded: false,
                component: cloneSourceRecord(cached.component),
                attributes: cached.attributes.map(cloneSourceRecord),
            });
            continue;
        }

        const seed = group[0];
        if (!seed.primitiveId) throw new Error(`Seed primitive id missing for ${seed.input.designator}`);

        const component = records.find(record =>
            record.outer.type === 'COMPONENT' && record.outer.id === seed.primitiveId,
        );
        if (!component?.inner) throw new Error(`Source COMPONENT not found for ${seed.input.designator}`);

        const attributes = records.filter(record =>
            record.outer.type === 'ATTR' && record.inner?.parentId === seed.primitiveId,
        );
        if (!attributes.length) throw new Error(`Source ATTR records not found for ${seed.input.designator}`);

        const template: ComponentTemplate = {
            originApiX: seed.apiX,
            originApiY: seed.apiY,
            firstPlanSeeded: true,
            component,
            attributes,
        };
        templates.set(key, template);
        componentTemplateCache.set(getTemplateCacheKey(projectUuid, key), {
            projectUuid,
            templateKey: key,
            seedApiX: seed.apiX,
            seedApiY: seed.apiY,
            component: cloneSourceRecord(component),
            attributes: attributes.map(cloneSourceRecord),
        });
    }

    return templates;
}

function updateInstanceAttribute(inner: Record<string, unknown>, plan: PlannedComponent): void {
    const key = inner.key;
    if (key === 'Unique ID') inner.value = '';

    if (!isNamedNetSymbol(plan.input) && key === 'Designator') {
        inner.value = rmPartFromDesignator(plan.input.designator);
    }

    if (isNamedNetSymbol(plan.input) && (key === 'Name' || key === 'Global Net Name')) {
        inner.value = getSpecialSignalName(plan.input);
        inner.rotation = 0;
    }

    if (plan.replacement?.preservedAttributes.has(String(key))) {
        inner.value = plan.replacement.preservedAttributes.get(String(key));
    }
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

function rotateVector(x: number, y: number, rotation: number): { x: number; y: number } {
    const radians = normalizeRotation(rotation) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return {
        x: Math.round((x * cosine - y * sine) * 1e9) / 1e9,
        y: Math.round((x * sine + y * cosine) * 1e9) / 1e9,
    };
}

function transformAttributePoint(
    x: number,
    y: number,
    seedX: number,
    seedY: number,
    targetX: number,
    targetY: number,
    seedRotation: number,
    targetRotation: number,
    seedMirror: boolean,
    targetMirror: boolean,
): { x: number; y: number } {
    const base = rotateVector(x - seedX, y - seedY, -seedRotation);
    if (seedMirror) base.x *= -1;
    if (targetMirror) base.x *= -1;
    const target = rotateVector(base.x, base.y, targetRotation);
    return { x: to2(targetX + target.x), y: to2(targetY + target.y) };
}

function cloneComponentsIntoSource(
    source: string,
    records: SourceRecord[],
    groups: Map<string, PlannedComponent[]>,
    templates: Map<string, ComponentTemplate>,
): { source: string; addedCount: number } {
    let ticket = getMaxTicket(records);
    let zIndex = getMaxZIndex(records);
    const appended: SourceRecord[] = [];

    for (const [key, group] of groups) {
        const template = templates.get(key);
        if (!template?.component.inner) throw new Error(`Component template missing for ${key}`);

        const sourceSeedX = Number(template.component.inner.x);
        const sourceSeedY = Number(template.component.inner.y);
        const yFactor = Math.abs(sourceSeedY - template.originApiY) <= Math.abs(sourceSeedY + template.originApiY) ? 1 : -1;
        const seedRotation = Number(template.component.inner.rotation) || 0;
        const seedMirror = Boolean(template.component.inner.isMirror);
        const plansToClone = template.firstPlanSeeded ? group.slice(1) : group;

        for (const plan of plansToClone) {
            const primitiveId = makeSourceId();
            plan.primitiveId = primitiveId;

            const dx = to2(plan.apiX - template.originApiX);
            const dy = to2((plan.apiY - template.originApiY) * yFactor);
            const targetX = to2(sourceSeedX + dx);
            const targetY = to2(sourceSeedY + dy);
            const targetRotation = getComponentRotation(plan.input);
            const targetMirror = plan.input.pos.mirror ?? false;
            const component = cloneSourceRecord(template.component);

            component.outer.id = primitiveId;
            component.outer.ticket = ++ticket;
            component.inner!.x = targetX;
            component.inner!.y = targetY;
            component.inner!.rotation = targetRotation;
            component.inner!.isMirror = targetMirror;
            component.inner!.zIndex = ++zIndex;
            appended.push(component);

            for (const attributeTemplate of template.attributes) {
                const attribute = cloneSourceRecord(attributeTemplate);
                if (!attribute.inner) continue;

                attribute.outer.id = makeSourceId();
                attribute.outer.ticket = ++ticket;
                attribute.inner.parentId = primitiveId;

                if (typeof attribute.inner.x === 'number' && typeof attribute.inner.y === 'number') {
                    const point = transformAttributePoint(
                        attribute.inner.x,
                        attribute.inner.y,
                        sourceSeedX,
                        sourceSeedY,
                        targetX,
                        targetY,
                        seedRotation,
                        targetRotation,
                        seedMirror,
                        targetMirror,
                    );
                    attribute.inner.x = point.x;
                    attribute.inner.y = point.y;
                }
                if (typeof attribute.inner.rotation === 'number') {
                    attribute.inner.rotation = normalizeRotation(
                        attribute.inner.rotation - seedRotation + targetRotation,
                    );
                }
                updateInstanceAttribute(attribute.inner, plan);
                appended.push(attribute);
            }
        }
    }

    return {
        source: appendDocumentSource(source, appended),
        addedCount: appended.length,
    };
}

async function loadPins(plans: PlannedComponent[]): Promise<void> {
    const load = async (plan: PlannedComponent) => {
        if (!plan.primitiveId) throw new Error(`Primitive id missing for ${plan.input.designator}`);

        let pins: ISCH_PrimitiveComponentPin[] | undefined;
        let lastError: unknown;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                pins = await getPrimitiveComponentPins(plan.primitiveId);
                if (pins.length) break;
            } catch (error) {
                lastError = error;
            }
            await new Promise<void>(resolve => setTimeout(resolve, 50));
        }

        if (!pins?.length) {
            throw new Error(`Pins not loaded for ${plan.input.designator}: ${String(lastError ?? 'empty pin list')}`);
        }
        plan.pins = pins;
    };

    const concurrency = 16;
    for (let index = 0; index < plans.length; index += concurrency) {
        await Promise.all(plans.slice(index, index + concurrency).map(load));
    }
}

function splitPinShape(shape?: string): { designator: string; pinNumber: string } | undefined {
    if (!shape) return undefined;
    const marker = shape.lastIndexOf('_pin_');
    if (marker < 0) return undefined;
    return {
        designator: shape.slice(0, marker),
        pinNumber: shape.slice(marker + 5),
    };
}

function findPlan(plans: PlannedComponent[], designator: string, pinNumber: string): PlannedComponent | undefined {
    const exact = plans.filter(plan => plan.input.designator === designator);
    const normalized = exact.length
        ? exact
        : plans.filter(plan => rmPartFromDesignator(plan.input.designator) === rmPartFromDesignator(designator));

    return normalized.find(plan => plan.pins?.some(pin => pin.getState_PinNumber() == pinNumber)) ?? normalized[0];
}

function findPlanPin(plan: PlannedComponent | undefined, pinNumber: string): ISCH_PrimitiveComponentPin | undefined {
    if (!plan?.pins) return undefined;
    const pinName = plan.input.pins.find(pin => pin.pin_number == pinNumber)?.name;
    return plan.pins.find(pin => pin.getState_PinNumber() == pinNumber) ??
        plan.pins.find(pin => pinName && pin.getState_PinName() === pinName);
}

function filterUniqueCoordinatePairs(values: number[]): number[] {
    const result: number[] = [];
    const seen = new Set<string>();
    for (let index = 0; index + 1 < values.length; index += 2) {
        const x = values[index];
        const y = values[index + 1];
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(x, y);
    }
    return result;
}

function orthogonalize(values: number[]): number[] {
    let result = [...values];
    for (let index = 0; index + 3 < result.length; index += 2) {
        if (result[index] === result[index + 2] || result[index + 1] === result[index + 3]) continue;
        const dx = Math.abs(result[index] - result[index + 2]);
        const dy = Math.abs(result[index + 1] - result[index + 3]);
        const bend = dx < dy
            ? [result[index + 2], result[index + 1]]
            : [result[index], result[index + 3]];
        result = [...result.slice(0, index + 2), ...bend, ...result.slice(index + 2)];
    }
    return filterUniqueCoordinatePairs(result);
}

function getSignalName(
    circuit: CircuitAssembly,
    sourceRef: ReturnType<typeof splitPinShape>,
    targetRef: ReturnType<typeof splitPinShape>,
): string {
    for (const ref of [sourceRef, targetRef]) {
        if (!ref) continue;
        const component = circuit.components.find(item => item.designator === ref.designator) ??
            circuit.components.find(item => rmPartFromDesignator(item.designator) === rmPartFromDesignator(ref.designator));
        const signal = component?.pins.find(pin => pin.pin_number == ref.pinNumber)?.signal_name;
        if (signal) return signal;
    }
    return 'unknown net';
}

function pointToWire(point: { x: number; y: number }, offset: Offset): [number, number] {
    const transformed = applyOffset(point.x, point.y, offset);
    return [to2(transformed.x), to2(normWireY(transformed.y))];
}

function buildWireSpecs(
    circuit: CircuitAssembly,
    plans: PlannedComponent[],
    offset: Offset,
): WireSpec[] {
    const rawSpecs: WireSpec[] = [];

    for (const edge of circuit.edges) {
        for (const section of edge.sections ?? []) {
            const sourceRef = splitPinShape(section.incomingShape);
            const targetRef = splitPinShape(section.outgoingShape);
            const sourcePlan = sourceRef ? findPlan(plans, sourceRef.designator, sourceRef.pinNumber) : undefined;
            const targetPlan = targetRef ? findPlan(plans, targetRef.designator, targetRef.pinNumber) : undefined;
            const sourcePin = sourceRef ? findPlanPin(sourcePlan, sourceRef.pinNumber) : undefined;
            const targetPin = targetRef ? findPlanPin(targetPlan, targetRef.pinNumber) : undefined;

            const start = sourcePin
                ? [sourcePin.getState_X(), sourcePin.getState_Y()]
                : pointToWire(section.startPoint, offset);
            const end = targetPin
                ? [targetPin.getState_X(), targetPin.getState_Y()]
                : pointToWire(section.endPoint, offset);

            if (!sourcePin && sourceRef) {
                eda.sys_Log.add(`[source-assemble] Pin not found: ${sourceRef.designator} ${sourceRef.pinNumber}`, ESYS_LogType.WARNING);
            }
            if (!targetPin && targetRef) {
                eda.sys_Log.add(`[source-assemble] Pin not found: ${targetRef.designator} ${targetRef.pinNumber}`, ESYS_LogType.WARNING);
            }

            const values = [...start];
            for (const bend of section.bendPoints ?? []) values.push(...pointToWire(bend, offset));
            values.push(...end);

            const normalized = orthogonalize(values.map(value => to2(value)));
            if (normalized.length < 4) continue;

            rawSpecs.push({
                segments: wireSegments(normalized),
                net: getSignalName(circuit, sourceRef, targetRef),
                description: `${section.incomingShape ?? '?'} -> ${section.outgoingShape ?? '?'}`,
            });
        }
    }

    return normalizeWireSpecs(rawSpecs);
}

function wireSegments(values: number[]): WireSegment[] {
    const segments: WireSegment[] = [];
    for (let index = 0; index + 3 < values.length; index += 2) {
        segments.push([values[index], values[index + 1], values[index + 2], values[index + 3]]);
    }
    return segments;
}

const coordinateKey = (x: number, y: number) => `${to2(x)},${to2(y)}`;

function canonicalSegment(segment: WireSegment): WireSegment | undefined {
    let [x1, y1, x2, y2] = segment.map(to2) as WireSegment;
    if (x1 === x2 && y1 === y2) return undefined;
    if (x1 !== x2 && y1 !== y2) return undefined;
    if ((x1 === x2 && y1 > y2) || (y1 === y2 && x1 > x2)) {
        [x1, y1, x2, y2] = [x2, y2, x1, y1];
    }
    return [x1, y1, x2, y2];
}

function mergeCollinearSegments(segments: WireSegment[]): WireSegment[] {
    const groups = new Map<string, WireSegment[]>();
    for (const raw of segments) {
        const segment = canonicalSegment(raw);
        if (!segment) continue;
        const key = segment[1] === segment[3] ? `H:${segment[1]}` : `V:${segment[0]}`;
        const group = groups.get(key) ?? [];
        group.push(segment);
        groups.set(key, group);
    }

    const merged: WireSegment[] = [];
    for (const [key, group] of groups) {
        const horizontal = key.startsWith('H:');
        group.sort((a, b) => (horizontal ? a[0] - b[0] : a[1] - b[1]));
        let current = [...group[0]] as WireSegment;
        for (const next of group.slice(1)) {
            const currentEnd = horizontal ? current[2] : current[3];
            const nextStart = horizontal ? next[0] : next[1];
            const nextEnd = horizontal ? next[2] : next[3];
            if (nextStart <= currentEnd) {
                if (horizontal) current[2] = Math.max(currentEnd, nextEnd);
                else current[3] = Math.max(currentEnd, nextEnd);
            } else {
                merged.push(current);
                current = [...next] as WireSegment;
            }
        }
        merged.push(current);
    }
    return merged;
}

function pointOnWireSegment(x: number, y: number, segment: WireSegment): boolean {
    const [x1, y1, x2, y2] = segment;
    if (x1 === x2) return x === x1 && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
    return y === y1 && x >= Math.min(x1, x2) && x <= Math.max(x1, x2);
}

function splitSegmentsAtJunctions(segments: WireSegment[]): WireSegment[] {
    const points = new Map<string, [number, number]>();
    for (const [x1, y1, x2, y2] of segments) {
        points.set(coordinateKey(x1, y1), [x1, y1]);
        points.set(coordinateKey(x2, y2), [x2, y2]);
    }

    for (let leftIndex = 0; leftIndex < segments.length; leftIndex++) {
        const left = segments[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex++) {
            const right = segments[rightIndex];
            const leftHorizontal = left[1] === left[3];
            const rightHorizontal = right[1] === right[3];
            if (leftHorizontal === rightHorizontal) continue;
            const horizontal = leftHorizontal ? left : right;
            const vertical = leftHorizontal ? right : left;
            const x = vertical[0];
            const y = horizontal[1];
            if (pointOnWireSegment(x, y, horizontal) && pointOnWireSegment(x, y, vertical)) {
                points.set(coordinateKey(x, y), [x, y]);
            }
        }
    }

    const split: WireSegment[] = [];
    for (const segment of segments) {
        const onSegment = [...points.values()]
            .filter(([x, y]) => pointOnWireSegment(x, y, segment))
            .sort((a, b) => segment[1] === segment[3] ? a[0] - b[0] : a[1] - b[1]);
        for (let index = 0; index + 1 < onSegment.length; index++) {
            const part = canonicalSegment([
                onSegment[index][0],
                onSegment[index][1],
                onSegment[index + 1][0],
                onSegment[index + 1][1],
            ]);
            if (part) split.push(part);
        }
    }

    return [...new Map(split.map(segment => [`${coordinateKey(segment[0], segment[1])}:${coordinateKey(segment[2], segment[3])}`, segment])).values()];
}

function connectedSegmentGroups(segments: WireSegment[]): WireSegment[][] {
    const remaining = new Set(segments.map((_, index) => index));
    const groups: WireSegment[][] = [];
    while (remaining.size) {
        const first = remaining.values().next().value as number;
        remaining.delete(first);
        const queue = [first];
        const group: WireSegment[] = [];
        const points = new Set<string>();

        while (queue.length) {
            const index = queue.shift()!;
            const segment = segments[index];
            group.push(segment);
            points.add(coordinateKey(segment[0], segment[1]));
            points.add(coordinateKey(segment[2], segment[3]));

            for (const candidate of [...remaining]) {
                const other = segments[candidate];
                if (points.has(coordinateKey(other[0], other[1])) || points.has(coordinateKey(other[2], other[3]))) {
                    remaining.delete(candidate);
                    queue.push(candidate);
                }
            }
        }
        groups.push(group);
    }
    return groups;
}

function normalizeWireSpecs(specs: WireSpec[]): WireSpec[] {
    const byNet = new Map<string, WireSegment[]>();
    for (const spec of specs) {
        const segments = byNet.get(spec.net) ?? [];
        segments.push(...spec.segments);
        byNet.set(spec.net, segments);
    }

    const normalized: WireSpec[] = [];
    for (const [net, segments] of byNet) {
        const split = splitSegmentsAtJunctions(mergeCollinearSegments(segments));
        for (const [index, connected] of connectedSegmentGroups(split).entries()) {
            normalized.push({
                net,
                segments: connected,
                description: `${net} normalized group ${index + 1}`,
            });
        }
    }
    return normalized;
}

function scoreWireYTransform(
    sourceLine: Record<string, unknown>,
    segment: [number, number, number, number],
    factor: 1 | -1,
): number {
    const [x1, y1, x2, y2] = segment;
    const direct = Math.abs(Number(sourceLine.startX) - x1) +
        Math.abs(Number(sourceLine.startY) - y1 * factor) +
        Math.abs(Number(sourceLine.endX) - x2) +
        Math.abs(Number(sourceLine.endY) - y2 * factor);
    const reverse = Math.abs(Number(sourceLine.startX) - x2) +
        Math.abs(Number(sourceLine.startY) - y2 * factor) +
        Math.abs(Number(sourceLine.endX) - x1) +
        Math.abs(Number(sourceLine.endY) - y1 * factor);
    return Math.min(direct, reverse);
}

async function bulkAddWires(specs: WireSpec[]): Promise<number> {
    if (!specs.length) return 0;

    let source = await eda.sys_FileManager.getDocumentSource();
    if (!source) throw new Error('Document source is empty before bulk wires');
    let records = parseDocumentSource(source);
    let wireTemplate = records.find(record => {
        if (record.outer.type !== 'WIRE' || !record.inner) return false;
        const id = String(record.outer.id ?? '');
        return records.some(item => item.outer.type === 'LINE' && item.inner?.lineGroup === id) &&
            records.some(item => item.outer.type === 'ATTR' && item.inner?.parentId === id && item.inner.key === 'NET');
    });
    let temporarySeedId: string | undefined;
    let templateApiSegment: WireSegment | undefined;

    if (wireTemplate) {
        const templateId = String(wireTemplate.outer.id);
        const templatePrimitive = await sch_PrimitiveWireSnap.get(templateId).catch(() => undefined);
        const values = templatePrimitive ? normalizeWireLine(templatePrimitive.getState_Line())[0] : undefined;
        if (values) templateApiSegment = canonicalSegment(values.map(to2) as WireSegment);
    } else {
        const seedSpec = specs[0];
        const seedSegment = seedSpec.segments[0];
        let lastError: unknown;
        for (let attempt = 1; attempt <= 4 && !temporarySeedId; attempt++) {
            try {
                const seedWire = await sch_PrimitiveWireSnap.create(seedSegment, seedSpec.net);
                if (!seedWire) throw new Error('wire create returned undefined');
                const committed = await seedWire.done();
                const seedPrimitive = committed && typeof committed === 'object'
                    ? committed as ISCH_PrimitiveWire
                    : seedWire;
                temporarySeedId = seedPrimitive.getState_PrimitiveId();
                if (!temporarySeedId) throw new Error('seed wire primitive id is empty');
            } catch (error) {
                lastError = error;
                eda.sys_Log.add(
                    `[source-assemble] Simple wire seed attempt ${attempt} failed: ${(error as Error).message}`,
                    ESYS_LogType.WARNING,
                );
                await new Promise<void>(resolve => setTimeout(resolve, attempt * 75));
            }
        }
        if (!temporarySeedId) {
            throw new Error(`Simple wire template seed failed: ${(lastError as Error)?.message ?? 'unknown error'}`);
        }
        templateApiSegment = seedSegment;
        source = await eda.sys_FileManager.getDocumentSource();
        if (!source) throw new Error('Document source is empty after seed wire placement');
        records = parseDocumentSource(source);
        wireTemplate = records.find(record => record.outer.type === 'WIRE' && record.outer.id === temporarySeedId);
    }

    if (!wireTemplate?.inner) throw new Error('Bulk wire source template is incomplete');
    const templateId = String(wireTemplate.outer.id);
    const lineTemplates = records.filter(record => record.outer.type === 'LINE' && record.inner?.lineGroup === templateId);
    const attributeTemplates = selectWireAttributeTemplates(records, templateId);
    if (!lineTemplates[0]?.inner) throw new Error('Bulk wire LINE template is missing');
    const firstSegment = templateApiSegment ?? specs[0].segments[0];
    const yFactor: 1 | -1 = scoreWireYTransform(lineTemplates[0].inner, firstSegment, 1) <=
        scoreWireYTransform(lineTemplates[0].inner, firstSegment, -1) ? 1 : -1;
    let ticket = getMaxTicket(records);
    let zIndex = getMaxZIndex(records);
    const appended: SourceRecord[] = [];

    for (const spec of specs) {
        const wireId = makeSourceId();
        const wire = cloneSourceRecord(wireTemplate);
        wire.outer.id = wireId;
        wire.outer.ticket = ++ticket;
        wire.inner!.zIndex = ++zIndex;
        appended.push(wire);

        for (const [startX, startY, endX, endY] of spec.segments) {
            const line = cloneSourceRecord(lineTemplates[0]);
            line.outer.id = makeSourceId();
            line.outer.ticket = ++ticket;
            line.inner!.lineGroup = wireId;
            line.inner!.startX = startX;
            line.inner!.startY = startY * yFactor;
            line.inner!.endX = endX;
            line.inner!.endY = endY * yFactor;
            appended.push(line);
        }

        const lastSegment = spec.segments.at(-1)!;
        const sourceLastSegment: WireSegment = [
            lastSegment[0],
            lastSegment[1] * yFactor,
            lastSegment[2],
            lastSegment[3] * yFactor,
        ];
        for (const attributeTemplate of attributeTemplates) {
            const attribute = cloneSourceRecord(attributeTemplate);
            if (!attribute.inner) continue;
            attribute.outer.id = makeSourceId();
            attribute.outer.ticket = ++ticket;
            attribute.inner.parentId = wireId;
            if (attribute.inner.key === 'NET') {
                normalizeWireNetAttribute(attribute.inner, spec.net, sourceLastSegment);
            }
            appended.push(attribute);
        }
    }

    if (temporarySeedId) {
        const retained = records.filter(record =>
            record.outer.id !== temporarySeedId &&
            record.inner?.lineGroup !== temporarySeedId &&
            record.inner?.parentId !== temporarySeedId,
        );
        source = serializeDocumentSource(retained);
    }
    const nextSource = appendDocumentSource(source, appended);
    await setSourceAndRefresh(nextSource, 'bulk wire');
    return specs.length;
}

function getUnusedPinNets(circuit: CircuitAssembly, plans: PlannedComponent[]) {
    const usedPins = new Set<string>();
    for (const edge of circuit.edges) {
        for (const section of edge.sections ?? []) {
            if (section.incomingShape) usedPins.add(section.incomingShape);
            if (section.outgoingShape) usedPins.add(section.outgoingShape);
        }
    }

    const usedCoordinates = new Set<string>();
    for (const pinId of usedPins) {
        const ref = splitPinShape(pinId);
        if (!ref) continue;
        const plan = findPlan(plans, ref.designator, ref.pinNumber);
        const pin = findPlanPin(plan, ref.pinNumber);
        if (pin) usedCoordinates.add(coordinateKey(pin.getState_X(), pin.getState_Y()));
    }

    return plans.flatMap(plan => plan.input.pins
        .filter(pin => pin.signal_name && pin.signal_name.toLowerCase().trim() !== 'nc')
        .filter(pin => !usedPins.has(`${plan.input.designator}_pin_${pin.pin_number}`))
        .filter(pin => {
            const placedPin = findPlanPin(plan, String(pin.pin_number));
            return !placedPin || !usedCoordinates.has(coordinateKey(placedPin.getState_X(), placedPin.getState_Y()));
        })
        .map(pin => ({
            designator: plan.input.designator,
            pin_number: pin.pin_number,
            pin_name: pin.name,
            net: pin.signal_name,
        })));
}

interface ResolvedNetPin {
    pin: ISCH_PrimitiveComponentPin;
    pins: ISCH_PrimitiveComponentPin[];
}

interface OccupiedWireSegment {
    net: string;
    segment: WireSegment;
}

const selectPortForNet = (net: string) => {
    const type = (Object.keys(shortSymbolsMap) as Array<keyof typeof shortSymbolsMap>)
        .find(key => shortSymbolsMap[key].is(net));
    return type ? shortSymbolsMap[type].data : NET_PORT_COMPONENT;
};

async function resolveNetPin(net: AddedNet, plans: PlannedComponent[]): Promise<ResolvedNetPin | undefined> {
    const plan = findPlan(plans, net.designator, String(net.pin_number));
    if (plan?.pins?.length) {
        const pin = plan.pins.find(item => item.getState_PinNumber() == net.pin_number) ??
            plan.pins.find(item => net.pin_name && item.getState_PinName() === net.pin_name);
        if (pin) return { pin, pins: plan.pins };
    }

    const components = await searchComponentInSCH(net.designator).catch(() => undefined);
    for (const component of components ?? []) {
        const pins = await getPrimitiveComponentPins(component.primitiveId).catch(() => []);
        const pin = pins.find(item => item.getState_PinNumber() == net.pin_number) ??
            pins.find(item => net.pin_name && item.getState_PinName() === net.pin_name);
        if (pin) return { pin, pins };
    }
    return undefined;
}

function pointIsWireEndpoint(x: number, y: number, segment: WireSegment): boolean {
    return coordinateKey(x, y) === coordinateKey(segment[0], segment[1]) ||
        coordinateKey(x, y) === coordinateKey(segment[2], segment[3]);
}

function wireSegmentsConflict(left: WireSegment, right: WireSegment): boolean {
    const leftHorizontal = left[1] === left[3];
    const rightHorizontal = right[1] === right[3];
    if (leftHorizontal && rightHorizontal) {
        if (left[1] !== right[1]) return false;
        return Math.min(left[2], right[2]) > Math.max(left[0], right[0]);
    }
    if (!leftHorizontal && !rightHorizontal) {
        if (left[0] !== right[0]) return false;
        return Math.min(left[3], right[3]) > Math.max(left[1], right[1]);
    }

    const horizontal = leftHorizontal ? left : right;
    const vertical = leftHorizontal ? right : left;
    const x = vertical[0];
    const y = horizontal[1];
    if (!pointOnWireSegment(x, y, horizontal) || !pointOnWireSegment(x, y, vertical)) return false;
    return pointIsWireEndpoint(x, y, left) || pointIsWireEndpoint(x, y, right);
}

async function getOccupiedWireSegments(specs: WireSpec[]): Promise<OccupiedWireSegment[]> {
    const occupied = specs.flatMap(spec => spec.segments.map(segment => ({ net: spec.net, segment })));
    const wires = await sch_PrimitiveWireSnap.getAll().catch(() => [] as ISCH_PrimitiveWire[]);
    for (const wire of wires) {
        for (const values of normalizeWireLine(wire.getState_Line())) {
            const segment = canonicalSegment(values.map(to2) as WireSegment);
            if (segment) occupied.push({ net: wire.getState_Net(), segment });
        }
    }
    return occupied;
}

const getReplacementDesignators = (circuit: CircuitAssembly) => new Set(
    (circuit.replace_components ?? []).map(rmPartFromDesignator),
);

function createSourceWorkingCircuit(circuit: CircuitAssembly): CircuitAssembly {
    const working = structuredClone(circuit);
    const replacements = getReplacementDesignators(working);
    if (!replacements.size) return working;

    working.rm_components = working.rm_components?.filter(designator =>
        !replacements.has(rmPartFromDesignator(designator)),
    );
    working.edges = working.edges.filter(edge => !(edge.sections ?? []).some(section => {
        const incoming = splitPinShape(section.incomingShape);
        const outgoing = splitPinShape(section.outgoingShape);
        return (incoming && replacements.has(rmPartFromDesignator(incoming.designator))) ||
            (outgoing && replacements.has(rmPartFromDesignator(outgoing.designator)));
    }));
    return working;
}

const getSubPartSuffix = (value?: string) => value?.split('.').at(-1)?.toLowerCase();

async function bindReplacementPlans(
    circuit: CircuitAssembly,
    plans: PlannedComponent[],
    source: string,
): Promise<void> {
    const replacements = getReplacementDesignators(circuit);
    if (!replacements.size) return;

    const records = parseDocumentSource(source);
    const occupied = await getOccupiedWireSegments([]);
    const attributesByParent = new Map<string, Map<string, unknown>>();
    for (const record of records) {
        if (record.outer.type !== 'ATTR' || !record.inner) continue;
        const parentId = String(record.inner.parentId ?? '');
        if (!parentId) continue;
        const attributes = attributesByParent.get(parentId) ?? new Map<string, unknown>();
        attributes.set(String(record.inner.key ?? ''), record.inner.value);
        attributesByParent.set(parentId, attributes);
    }

    for (const designator of replacements) {
        const targets = plans.filter(plan => rmPartFromDesignator(plan.input.designator) === designator);
        if (!targets.length) throw new Error(`Replacement ${designator} is absent from circuit components`);
        const primitives = await searchComponentInSCH(designator);
        if (!primitives?.length) throw new Error(`Replacement target ${designator} is absent from schematic`);
        const unused = new Set(primitives.map(primitive => primitive.primitiveId));

        for (const plan of targets) {
            const wantedSubPart = getSubPartSuffix(plan.input.sub_part_name) ??
                getDesignatorPartIndex(plan.input)?.toString();
            let target = primitives.find(primitive =>
                unused.has(primitive.primitiveId) &&
                wantedSubPart &&
                getSubPartSuffix(primitive.component.getState_SubPartName?.()) === wantedSubPart,
            );
            if (!target && unused.size === 1) {
                target = primitives.find(primitive => unused.has(primitive.primitiveId));
            }
            if (!target) {
                throw new Error(`Cannot match replacement unit ${plan.input.designator} to existing ${designator}`);
            }
            unused.delete(target.primitiveId);

            const oldPins = await getPrimitiveComponentPins(target.primitiveId);
            if (!oldPins.length) throw new Error(`Replacement target ${plan.input.designator} has no readable pins`);
            const oldPinSnapshots = oldPins.map(pin => {
                const x = to2(pin.getState_X());
                const y = to2(pin.getState_Y());
                return {
                    pinNumber: String(pin.getState_PinNumber()),
                    pinName: pin.getState_PinName(),
                    x,
                    y,
                    nets: [...new Set(occupied
                        .filter(item => pointOnWireSegment(x, y, item.segment))
                        .map(item => item.net)
                        .filter(Boolean))],
                };
            });
            const oldComponent = target.component;
            plan.apiX = to2(oldComponent.getState_X());
            plan.apiY = to2(oldComponent.getState_Y());
            plan.input.pos.rotate = normalizeRotation(oldComponent.getState_Rotation());
            plan.input.pos.mirror = Boolean(oldComponent.getState_Mirror());
            const oldAttributes = attributesByParent.get(target.primitiveId) ?? new Map<string, unknown>();
            const preservedAttributes = new Map<string, unknown>();
            for (const key of ['Designator', 'Unique ID', 'Add into BOM', 'Convert to PCB']) {
                if (oldAttributes.has(key)) preservedAttributes.set(key, oldAttributes.get(key));
            }
            plan.replacement = {
                oldPrimitiveId: target.primitiveId,
                oldPins: oldPinSnapshots,
                preservedAttributes,
                shiftX: 0,
                shiftY: 0,
            };
            eda.sys_Log.add(
                `[source-assemble] Replacement bound: ${plan.input.designator} <- ${target.primitiveId}`,
                ESYS_LogType.INFO,
            );
        }
    }
}

function validateSourceReplacements(
    plans: PlannedComponent[],
    occupied: OccupiedWireSegment[],
): WireSpec[] {
    const bridges: WireSpec[] = [];
    for (const plan of plans.filter(item => item.replacement)) {
        const replacement = plan.replacement!;
        if (!plan.pins?.length) throw new Error(`Replacement pins not loaded for ${plan.input.designator}`);
        if (plan.pins.length !== replacement.oldPins.length) {
            throw new Error(
                `Unsafe replacement ${plan.input.designator}: pin count ` +
                `${replacement.oldPins.length} -> ${plan.pins.length}`,
            );
        }

        const unusedOldPins = new Set(replacement.oldPins);
        const pairs = plan.pins.map(newPin => {
            const pinNumber = String(newPin.getState_PinNumber());
            const pinName = newPin.getState_PinName();
            const inputPin = plan.input.pins.find(pin => String(pin.pin_number) === pinNumber) ??
                plan.input.pins.find(pin => pin.name === pinName);
            const signal = inputPin?.signal_name ?? '';
            const candidates = [...unusedOldPins];
            const signalCandidates = signal ? candidates.filter(pin => pin.nets.includes(signal)) : [];
            const oldPin = signalCandidates.find(pin => pin.pinNumber === pinNumber) ??
                (signalCandidates.length === 1 ? signalCandidates[0] : undefined) ??
                candidates.find(pin => pin.pinNumber === pinNumber) ??
                candidates.find(pin => pin.pinName.toLowerCase() === pinName.toLowerCase());
            if (!oldPin) {
                throw new Error(
                    `Unsafe replacement ${plan.input.designator}: cannot map pin ${pinNumber} (${pinName})`,
                );
            }
            unusedOldPins.delete(oldPin);
            return {
                oldPin,
                newX: to2(newPin.getState_X()),
                newY: to2(newPin.getState_Y()),
                net: signal || oldPin.nets[0] || '',
            };
        });

        const deltaX = pairs.map(pair => to2(pair.oldPin.x - pair.newX));
        const deltaY = pairs.map(pair => to2(pair.oldPin.y - pair.newY));
        replacement.shiftX = deltaX.every(value => value === deltaX[0]) ? deltaX[0] : 0;
        replacement.shiftY = deltaY.every(value => value === deltaY[0]) ? deltaY[0] : 0;

        for (const pair of pairs) {
            const targetX = to2(pair.newX + replacement.shiftX);
            const targetY = to2(pair.newY + replacement.shiftY);
            const residualX = to2(pair.oldPin.x - targetX);
            const residualY = to2(pair.oldPin.y - targetY);
            if (residualX && residualY) {
                throw new Error(
                    `Unsafe replacement ${plan.input.designator}.${pair.oldPin.pinNumber}: ` +
                    `diagonal pin mismatch ${residualX},${residualY}`,
                );
            }
            if (Math.abs(residualX) >= 30 || Math.abs(residualY) >= 30) {
                throw new Error(
                    `Unsafe replacement ${plan.input.designator}.${pair.oldPin.pinNumber}: ` +
                    `pin mismatch ${residualX},${residualY}`,
                );
            }
            if ((residualX || residualY) && pair.net) {
                const targetConflict = occupied.some(item =>
                    item.net !== pair.net && pointOnWireSegment(targetX, targetY, item.segment),
                );
                const bridge = canonicalSegment([pair.oldPin.x, pair.oldPin.y, targetX, targetY]);
                const routeConflict = bridge && occupied.some(item =>
                    item.net !== pair.net && wireSegmentsConflict(bridge, item.segment),
                );
                if (targetConflict || routeConflict) {
                    throw new Error(
                        `Unsafe replacement ${plan.input.designator}.${pair.oldPin.pinNumber}: ` +
                        `bridge conflicts with another net`,
                    );
                }
                bridges.push({
                    segments: [[pair.oldPin.x, pair.oldPin.y, targetX, targetY]],
                    net: pair.net,
                    description: `replacement bridge ${plan.input.designator}.${pair.oldPin.pinNumber}`,
                });
            }
        }
    }
    return bridges;
}

function applySourceReplacements(source: string, plans: PlannedComponent[]): string {
    const replacementPlans = plans.filter(plan => plan.replacement);
    if (!replacementPlans.length) return source;
    const oldIds = new Set(replacementPlans.map(plan => plan.replacement!.oldPrimitiveId));
    const records = parseDocumentSource(source).filter(record =>
        !oldIds.has(String(record.outer.id ?? '')) &&
        !oldIds.has(String(record.inner?.parentId ?? '')),
    );

    for (const plan of replacementPlans) {
        const replacement = plan.replacement!;
        const component = records.find(record =>
            record.outer.type === 'COMPONENT' && record.outer.id === plan.primitiveId && record.inner,
        );
        if (!component?.inner) throw new Error(`New replacement source missing for ${plan.input.designator}`);
        const sourceY = Number(component.inner.y);
        const yFactor: 1 | -1 = Math.abs(sourceY - plan.apiY) <= Math.abs(sourceY + plan.apiY) ? 1 : -1;
        component.inner.x = to2(Number(component.inner.x) + replacement.shiftX);
        component.inner.y = to2(sourceY + replacement.shiftY * yFactor);
        for (const record of records) {
            if (record.outer.type !== 'ATTR' || !record.inner || record.inner.parentId !== plan.primitiveId) continue;
            const inner = record.inner;
            if (typeof inner.x === 'number') inner.x = to2(inner.x + replacement.shiftX);
            if (typeof inner.y === 'number') inner.y = to2(inner.y + replacement.shiftY * yFactor);
            const key = String(inner.key ?? '');
            if (replacement.preservedAttributes.has(key)) {
                inner.value = replacement.preservedAttributes.get(key);
            }
        }
        plan.apiX = to2(plan.apiX + replacement.shiftX);
        plan.apiY = to2(plan.apiY + replacement.shiftY);
    }
    return serializeDocumentSource(records);
}

async function bulkAddNetAttachments(
    nets: AddedNet[],
    plans: PlannedComponent[],
    projectUuid: string,
    circuitWireSpecs: WireSpec[],
): Promise<{ wireSpecs: WireSpec[]; portCount: number; unresolved: number; apiSeeds: number }> {
    if (!nets.length) return { wireSpecs: [], portCount: 0, unresolved: 0, apiSeeds: 0 };
    const occupied = await getOccupiedWireSegments(circuitWireSpecs);
    const portPlans: PlannedComponent[] = [];
    const portWires: WireSpec[] = [];
    const handled = new Set<string>();
    const netCountByDesignator = new Map<string, number>();
    for (const net of nets) {
        netCountByDesignator.set(net.designator, (netCountByDesignator.get(net.designator) ?? 0) + 1);
    }
    let unresolved = 0;

    for (const net of nets) {
        const resolved = await resolveNetPin(net, plans);
        if (!resolved) {
            unresolved++;
            eda.sys_Log.add(
                `[source-assemble] added_net pin not found: ${net.designator} ${net.pin_number}`,
                ESYS_LogType.WARNING,
            );
            continue;
        }

        const pinX = to2(resolved.pin.getState_X());
        const pinY = to2(resolved.pin.getState_Y());
        const attachmentKey = `${coordinateKey(pinX, pinY)}:${net.net}`;
        if (handled.has(attachmentKey)) continue;
        handled.add(attachmentKey);

        if (occupied.some(item => item.net === net.net && pointOnWireSegment(pinX, pinY, item.segment))) {
            continue;
        }
        if (occupied.some(item => item.net !== net.net && pointOnWireSegment(pinX, pinY, item.segment))) {
            unresolved++;
            eda.sys_Log.add(
                `[source-assemble] added_net conflict at ${net.designator}.${net.pin_number}: ${net.net}`,
                ESYS_LogType.WARNING,
            );
            continue;
        }

        const requestedPort = (netCountByDesignator.get(net.designator) ?? 0) < 5;
        const rotation = normalizeRotation(resolved.pin.getState_Rotation());
        const primaryDirection = rotation >= 270 ? 3 : rotation >= 180 ? 2 : rotation >= 90 ? 1 : 0;
        const directions = [
            { dx: 1, dy: 0, portOffsetY: normWireY(1) },
            { dx: 0, dy: normWireY(1), portOffsetY: 0 },
            { dx: -1, dy: 0, portOffsetY: normWireY(1) },
            { dx: 0, dy: normWireY(-1), portOffsetY: 0 },
        ];
        const forbiddenDirection = (primaryDirection + 2) % 4;
        const directionOrder = resolved.pins.length >= 3
            ? [primaryDirection]
            : [primaryDirection, ...[0, 1, 2, 3].filter(index =>
                index !== primaryDirection && index !== forbiddenDirection,
            )];
        const lengths = [20, 30, ...Array.from({ length: 39 }, (_, index) => 40 + index * 20), 15, 10, 5];
        const portOffsetLengths = Array.from({ length: 80 }, (_, index) => (index + 1) * 10);
        let selected: {
            segments: WireSegment[];
            canonicalSegments: WireSegment[];
            direction: typeof directions[number];
            endX: number;
            endY: number;
            makePort: boolean;
        } | undefined;

        for (const directionIndex of directionOrder) {
            const direction = directions[directionIndex];
            for (const makePort of requestedPort ? [true, false] : [false]) {
                for (const length of lengths) {
                    const middleX = pinX + direction.dx * length;
                    const middleY = pinY + direction.dy * length;
                    const offsets = makePort && direction.portOffsetY !== 0 ? portOffsetLengths : [0];
                    for (const portOffsetLength of offsets) {
                        const endX = middleX;
                        const endY = middleY + direction.portOffsetY * portOffsetLength;
                        const segments: WireSegment[] = [[pinX, pinY, middleX, middleY]];
                        if (middleX !== endX || middleY !== endY) {
                            segments.push([middleX, middleY, endX, endY]);
                        }
                        const canonicalSegments = segments
                            .map(canonicalSegment)
                            .filter((segment): segment is WireSegment => Boolean(segment));
                        if (canonicalSegments.length !== segments.length) continue;

                        const hitsPin = resolved.pins.some(pin =>
                            pin !== resolved.pin &&
                            coordinateKey(pin.getState_X(), pin.getState_Y()) === coordinateKey(endX, endY),
                        );
                        const hitsWire = occupied.some(item => pointOnWireSegment(endX, endY, item.segment));
                        const conflicts = canonicalSegments.some(candidate => occupied.some(item =>
                            item.net !== net.net && wireSegmentsConflict(candidate, item.segment),
                        ));
                        if (!hitsPin && !hitsWire && !conflicts) {
                            selected = { segments, canonicalSegments, direction, endX, endY, makePort };
                            break;
                        }
                    }
                    if (selected) break;
                }
                if (selected) break;
            }
            if (selected) break;
        }

        if (!selected) {
            unresolved++;
            eda.sys_Log.add(
                `[source-assemble] No free bulk net-port route: ${net.net} at ${net.designator}.${net.pin_number}`,
                ESYS_LogType.WARNING,
            );
            continue;
        }

        const { endX, endY } = selected;
        if (selected.makePort) {
            const portData = selectPortForNet(net.net);
            let portRotation = selected.direction.dy === normWireY(-1) ? 180 : 0;
            if (portData.rotateToIdle === -1) portRotation += 180;
            const input = {
                designator: `${net.net}|${makeSourceId().slice(0, 6)}`,
                value: 'bulk_net_port',
                pins: [{ pin_number: 1, name: '', signal_name: net.net }],
                block_name: '__bulk_net__',
                search_query: net.net,
                part_uuid: portData.uuid,
                pos: {
                    x: endX,
                    y: normWireY(endY),
                    center: { x: 0, y: 0 },
                    width: 0,
                    height: 0,
                    rotate: normalizeRotation(portRotation),
                    mirror: false,
                },
            } as AssemblyComponent;
            portPlans.push({
                input,
                layoutX: endX,
                layoutY: normWireY(endY),
                apiX: endX,
                apiY: normWireY(endY),
                templateKey: getComponentTemplateKey(input),
            });
        }
        const wireSpec = {
            segments: selected.segments,
            net: net.net,
            description: `bulk port ${net.designator}.${net.pin_number}`,
        };
        portWires.push(wireSpec);
        occupied.push(...selected.canonicalSegments.map(segment => ({ net: net.net, segment })));
    }

    if (!portPlans.length) return { wireSpecs: portWires, portCount: 0, unresolved, apiSeeds: 0 };
    const groups = groupPlans(portPlans);
    let source = await eda.sys_FileManager.getDocumentSource();
    if (!source) throw new Error('Document source is empty before bulk net ports');
    let records = parseDocumentSource(source);
    await cacheTemplatesFromCurrentPage(groups, projectUuid, records);
    const seededKeys = await placeSeeds(groups, projectUuid);
    source = await eda.sys_FileManager.getDocumentSource();
    if (!source) throw new Error('Document source is empty after net-port seeds');
    records = parseDocumentSource(source);
    const templates = collectComponentTemplates(records, groups, projectUuid, seededKeys);
    const result = cloneComponentsIntoSource(source, records, groups, templates);
    if (result.addedCount) await setSourceAndRefresh(result.source, 'bulk net ports');

    return {
        wireSpecs: portWires,
        portCount: portPlans.length,
        unresolved,
        apiSeeds: seededKeys.size,
    };
}

interface SourceRemovalPoint {
    x: number;
    y: number;
    net?: string;
    reason: string;
}

interface SourceRemovalPlan {
    componentIds: Set<string>;
    points: SourceRemovalPoint[];
    pinPoints: Array<[number, number]>;
}

async function findExistingPin(
    designator: string,
    pinNumber: string | number,
): Promise<ISCH_PrimitiveComponentPin | undefined> {
    const components = await searchComponentInSCH(designator).catch(() => undefined);
    if (!components?.length) return undefined;
    for (const component of components) {
        const pins = await getPrimitiveComponentPins(component.primitiveId).catch(() => []);
        const pin = pins.find(item => item.getState_PinNumber() == pinNumber);
        if (pin) return pin;
    }
    return undefined;
}

async function buildSourceRemovalPlan(circuit: CircuitAssembly): Promise<SourceRemovalPlan> {
    const componentIds = new Set<string>();
    const points: SourceRemovalPoint[] = [];

    for (const designator of circuit.rm_components ?? []) {
        const components = await searchComponentInSCH(designator).catch(() => undefined);
        for (const component of components ?? []) {
            componentIds.add(component.primitiveId);
            const pins = await getPrimitiveComponentPins(component.primitiveId).catch(() => []);
            for (const pin of pins) {
                points.push({
                    x: to2(pin.getState_X()),
                    y: to2(pin.getState_Y()),
                    reason: `component ${designator}`,
                });
            }
        }
    }

    for (const removedNet of circuit.rm_net ?? []) {
        const pin = await findExistingPin(removedNet.designator, removedNet.pin_number);
        if (!pin) {
            eda.sys_Log.add(
                `[source-assemble] rm_net pin not found: ${removedNet.designator} ${removedNet.pin_number}`,
                ESYS_LogType.WARNING,
            );
            continue;
        }
        points.push({
            x: to2(pin.getState_X()),
            y: to2(pin.getState_Y()),
            net: removedNet.net,
            reason: `rm_net ${removedNet.designator}.${removedNet.pin_number}`,
        });
    }

    const pinPoints = (await getAllPrimitivePins().catch(() => []))
        .flatMap(item => item.pins)
        .map(pin => [to2(pin.getState_X()), to2(pin.getState_Y())] as [number, number]);
    return { componentIds, points, pinPoints };
}

const sourceLineSegment = (record: SourceRecord): WireSegment | undefined => {
    if (record.outer.type !== 'LINE' || !record.inner?.lineGroup) return undefined;
    const values = [record.inner.startX, record.inner.startY, record.inner.endX, record.inner.endY].map(Number);
    if (values.some(value => !Number.isFinite(value))) return undefined;
    return values.map(to2) as WireSegment;
};

interface WireTopology {
    key: string;
    net: string;
    wireIds: Set<string>;
    wireTemplate: SourceRecord;
    lineTemplate: SourceRecord;
    attributeTemplates: SourceRecord[];
    segments: WireSegment[];
}

function splitSegmentsAtPoints(segments: WireSegment[], points: Array<[number, number]>): WireSegment[] {
    const result: WireSegment[] = [];
    for (const segment of segments) {
        const splitPoints = [
            [segment[0], segment[1]] as [number, number],
            [segment[2], segment[3]] as [number, number],
            ...points.filter(([x, y]) => pointOnWireSegment(x, y, segment)),
        ];
        const unique = [...new Map(splitPoints.map(point => [coordinateKey(point[0], point[1]), point])).values()]
            .sort((a, b) => segment[1] === segment[3] ? a[0] - b[0] : a[1] - b[1]);
        for (let index = 0; index + 1 < unique.length; index++) {
            const part = canonicalSegment([unique[index][0], unique[index][1], unique[index + 1][0], unique[index + 1][1]]);
            if (part) result.push(part);
        }
    }
    return result;
}

function removeBranchesToFirstJunction(
    segments: WireSegment[],
    point: [number, number],
    stopPoints: Array<[number, number]>,
): { segments: WireSegment[]; removed: number; detachedEnds: Array<[number, number]> } {
    const split = splitSegmentsAtPoints(segments, [point, ...stopPoints]);
    const adjacency = new Map<string, Set<number>>();
    const add = (key: string, index: number) => {
        const edges = adjacency.get(key) ?? new Set<number>();
        edges.add(index);
        adjacency.set(key, edges);
    };
    split.forEach((segment, index) => {
        add(coordinateKey(segment[0], segment[1]), index);
        add(coordinateKey(segment[2], segment[3]), index);
    });

    const startKey = coordinateKey(point[0], point[1]);
    const stopKeys = new Set(stopPoints.map(item => coordinateKey(item[0], item[1])));
    const startingEdges = [...(adjacency.get(startKey) ?? [])];
    const removed = new Set<number>();
    const detachedEnds = new Map<string, [number, number]>();

    for (const startingEdge of startingEdges) {
        let edgeIndex: number | undefined = startingEdge;
        let fromKey = startKey;
        while (edgeIndex !== undefined && !removed.has(edgeIndex)) {
            removed.add(edgeIndex);
            const segment = split[edgeIndex];
            const start = coordinateKey(segment[0], segment[1]);
            const end = coordinateKey(segment[2], segment[3]);
            const nextKey = start === fromKey ? end : start;
            const connected = adjacency.get(nextKey) ?? new Set<number>();
            if (nextKey !== startKey && stopKeys.has(nextKey)) {
                if (connected.size === 1) {
                    const [x, y] = nextKey.split(',').map(Number);
                    detachedEnds.set(nextKey, [x, y]);
                }
                break;
            }
            if (connected.size !== 2) {
                if (connected.size === 1 && nextKey !== startKey) {
                    const [x, y] = nextKey.split(',').map(Number);
                    detachedEnds.set(nextKey, [x, y]);
                }
                break;
            }
            const nextEdge = [...connected].find(index => index !== edgeIndex && !removed.has(index));
            if (nextEdge === undefined) break;
            fromKey = nextKey;
            edgeIndex = nextEdge;
        }
    }

    return {
        segments: split.filter((_, index) => !removed.has(index)),
        removed: removed.size,
        detachedEnds: [...detachedEnds.values()],
    };
}

function buildWireTopologies(records: SourceRecord[], wireNets: Map<string, string>): Map<string, WireTopology> {
    const wireTemplates = new Map(records
        .filter(record => record.outer.type === 'WIRE')
        .map(record => [String(record.outer.id), record]));
    const attributesByWire = new Map<string, Map<string, SourceRecord>>();
    for (const record of records) {
        if (record.outer.type !== 'ATTR') continue;
        const parentId = String(record.inner?.parentId ?? '');
        const key = String(record.inner?.key ?? '');
        if (!wireTemplates.has(parentId) || (key !== 'NET' && key !== 'Relevance')) continue;
        const attributes = attributesByWire.get(parentId) ?? new Map<string, SourceRecord>();
        if (!attributes.has(key)) attributes.set(key, record);
        attributesByWire.set(parentId, attributes);
    }

    const topologies = new Map<string, WireTopology>();
    for (const record of records) {
        const segment = sourceLineSegment(record);
        if (!segment) continue;
        const wireId = String(record.inner!.lineGroup);
        const wireTemplate = wireTemplates.get(wireId);
        if (!wireTemplate?.inner) continue;
        const net = wireNets.get(wireId) ?? '';
        const key = net ? `net:${net}` : `wire:${wireId}`;
        let topology = topologies.get(key);
        if (!topology) {
            topology = {
                key,
                net,
                wireIds: new Set<string>(),
                wireTemplate,
                lineTemplate: record,
                attributeTemplates: [...(attributesByWire.get(wireId)?.values() ?? [])],
                segments: [],
            };
            topologies.set(key, topology);
        }
        topology.wireIds.add(wireId);
        topology.segments.push(segment);
    }

    for (const topology of topologies.values()) {
        topology.segments = splitSegmentsAtJunctions(mergeCollinearSegments(topology.segments));
    }
    return topologies;
}

interface SourceRemovalResult {
    source: string;
    removedRecords: number;
    detachedNets: Array<{ x: number; y: number; net: string }>;
}

function removeSourceObjects(source: string, plan: SourceRemovalPlan): SourceRemovalResult {
    if (!plan.componentIds.size && !plan.points.length) return { source, removedRecords: 0, detachedNets: [] };
    const records = parseDocumentSource(source);
    const wireNets = new Map<string, string>();
    for (const record of records) {
        if (record.outer.type !== 'ATTR' || record.inner?.key !== 'NET') continue;
        const parentId = String(record.inner.parentId ?? '');
        if (parentId) wireNets.set(parentId, String(record.inner.value ?? ''));
    }

    const topologies = buildWireTopologies(records, wireNets);
    const affected = new Map<string, WireSegment[]>();
    const detachedNets = new Map<string, { x: number; y: number; net: string }>();
    for (const point of plan.points) {
        let removed = 0;
        for (const topology of topologies.values()) {
            if (point.net && topology.net !== point.net) continue;
            const current = affected.get(topology.key) ?? topology.segments;
            const sourcePoint = ([point.y, -point.y] as number[])
                .map(y => [point.x, y] as [number, number])
                .find(([x, y]) => current.some(segment => pointOnWireSegment(x, y, segment)));
            if (!sourcePoint) continue;
            const sourcePinPoints = plan.pinPoints.flatMap(([x, y]) => [
                [x, y] as [number, number],
                [x, -y] as [number, number],
            ]).filter(([x, y]) => current.some(segment => pointOnWireSegment(x, y, segment)));
            const result = removeBranchesToFirstJunction(current, sourcePoint, sourcePinPoints);
            if (!result.removed) continue;
            affected.set(topology.key, result.segments);
            removed += result.removed;
            const yFactor = sourcePoint[1] === point.y ? 1 : -1;
            for (const [x, y] of result.detachedEnds) {
                if (!topology.net) continue;
                const detached = { x: to2(x), y: to2(y * yFactor), net: topology.net };
                detachedNets.set(`${coordinateKey(detached.x, detached.y)}:${detached.net}`, detached);
            }
        }
        if (!removed) {
            eda.sys_Log.add(`[source-assemble] No wire segment found for ${point.reason}`, ESYS_LogType.WARNING);
        }
    }

    const affectedWireIds = new Set([...affected.keys()].flatMap(key => [...topologies.get(key)!.wireIds]));
    const filtered = records.filter(record => {
        const id = String(record.outer.id ?? '');
        const parentId = String(record.inner?.parentId ?? '');
        if (record.outer.type === 'COMPONENT' && plan.componentIds.has(id)) return false;
        if (record.outer.type === 'ATTR' && plan.componentIds.has(parentId)) return false;
        if (record.outer.type === 'LINE' && affectedWireIds.has(String(record.inner?.lineGroup ?? ''))) return false;
        if (record.outer.type === 'WIRE' && affectedWireIds.has(id)) return false;
        if (record.outer.type === 'ATTR' && affectedWireIds.has(parentId)) return false;
        return true;
    });

    let ticket = getMaxTicket(filtered);
    let zIndex = getMaxZIndex(filtered);
    const added: SourceRecord[] = [];
    for (const [key, remainingSegments] of affected) {
        const topology = topologies.get(key)!;
        for (const group of connectedSegmentGroups(remainingSegments)) {
            const newWireId = makeSourceId();
            const newWire = cloneSourceRecord(topology.wireTemplate);
            newWire.outer.id = newWireId;
            newWire.outer.ticket = ++ticket;
            newWire.inner!.zIndex = ++zIndex;
            added.push(newWire);

            for (const [startX, startY, endX, endY] of group) {
                const line = cloneSourceRecord(topology.lineTemplate);
                line.outer.id = makeSourceId();
                line.outer.ticket = ++ticket;
                line.inner!.lineGroup = newWireId;
                line.inner!.startX = startX;
                line.inner!.startY = startY;
                line.inner!.endX = endX;
                line.inner!.endY = endY;
                added.push(line);
            }
            for (const attributeTemplate of topology.attributeTemplates) {
                const attribute = cloneSourceRecord(attributeTemplate);
                attribute.outer.id = makeSourceId();
                attribute.outer.ticket = ++ticket;
                attribute.inner!.parentId = newWireId;
                if (attribute.inner!.key === 'NET') {
                    const lastSegment = group.at(-1)!;
                    normalizeWireNetAttribute(attribute.inner!, topology.net, lastSegment);
                }
                added.push(attribute);
            }
        }
    }

    return {
        source: serializeDocumentSource([...filtered, ...added]),
        removedRecords: records.length - filtered.length,
        detachedNets: [...detachedNets.values()],
    };
}

async function resolveDetachedNets(points: SourceRemovalResult['detachedNets']): Promise<AddedNet[]> {
    if (!points.length) return [];
    const primitives = await eda.sch_PrimitiveComponent.getAll().catch(() => []);
    const result: AddedNet[] = [];
    for (const primitive of primitives) {
        const designator = primitive.getState_Designator?.();
        if (!designator) continue;
        const pins = await getPrimitiveComponentPins(primitive.getState_PrimitiveId()).catch(() => []);
        for (const pin of pins) {
            const point = points.find(item =>
                to2(pin.getState_X()) === item.x && to2(pin.getState_Y()) === item.y,
            );
            if (!point) continue;
            result.push({
                designator,
                pin_number: pin.getState_PinNumber(),
                pin_name: pin.getState_PinName(),
                net: point.net,
            });
        }
    }
    return [...new Map(result.map(item => [`${item.designator}:${item.pin_number}:${item.net}`, item])).values()];
}

async function refreshSchematicIndexes(): Promise<void> {
    await yieldToEventLoop();
    sch_PrimitiveWireSnap.invalidate();
    await Promise.all([
        eda.sch_PrimitiveComponent.getAll().catch(() => []),
        eda.sch_PrimitiveWire.getAll().catch(() => []),
        eda.sch_Net.getAllNets().catch(() => []),
    ]);
    await sch_PrimitiveWireSnap.activate();
}

async function setSourceAndRefresh(source: string, label: string): Promise<void> {
    const applied = await eda.sys_FileManager.setDocumentSource(source);
    if (!applied) throw new Error(`EasyEDA rejected ${label} document source`);
    await refreshSchematicIndexes();
}

async function removeUnusedShortSymbols(): Promise<number> {
    const primitives = await eda.sch_PrimitiveComponent.getAll().catch(() => []);
    const shortSymbols = primitives.filter(primitive => {
        const type = primitive.getState_ComponentType();
        return type === ESCH_PrimitiveComponentType.NET_FLAG ||
            type === ESCH_PrimitiveComponentType.NET_PORT ||
            type === ESCH_PrimitiveComponentType.SHORT_CIRCUIT_FLAG;
    });
    if (!shortSymbols.length) return 0;

    const source = await eda.sys_FileManager.getDocumentSource();
    if (!source) return 0;
    const records = parseDocumentSource(source);
    const wireNets = new Map<string, string>();
    for (const record of records) {
        if (record.outer.type === 'ATTR' && record.inner?.key === 'NET') {
            wireNets.set(String(record.inner.parentId ?? ''), String(record.inner.value ?? ''));
        }
    }
    const lines = records.filter(record => sourceLineSegment(record));
    const removeIds = new Set<string>();

    for (const symbol of shortSymbols) {
        const symbolId = symbol.getState_PrimitiveId();
        const net = symbol.getState_Net?.() || String(symbol.getState_OtherProperty?.()?.['Global Net Name'] ?? '');
        const pins = await getPrimitiveComponentPins(symbolId).catch(() => []);
        const points = pins.length
            ? pins.map(pin => [to2(pin.getState_X()), to2(pin.getState_Y())] as [number, number])
            : [[to2(symbol.getState_X()), to2(normWireY(symbol.getState_Y()))] as [number, number]];
        const connected = points.some(([x, y]) => lines.some(record => {
            const wireId = String(record.inner?.lineGroup ?? '');
            const wireNet = wireNets.get(wireId) ?? '';
            if (net && wireNet && net !== wireNet) return false;
            const segment = sourceLineSegment(record)!;
            return pointOnWireSegment(x, y, segment) || pointOnWireSegment(x, -y, segment);
        }));
        if (!connected) removeIds.add(symbolId);
    }

    if (!removeIds.size) return 0;
    const filtered = records.filter(record => {
        const id = String(record.outer.id ?? '');
        const parentId = String(record.inner?.parentId ?? '');
        return !removeIds.has(id) && !removeIds.has(parentId);
    });
    await setSourceAndRefresh(serializeDocumentSource(filtered), 'unused short-symbol cleanup');
    return removeIds.size;
}

function requiresLegacyAssembler(circuit: CircuitAssembly): string | undefined {
    if (VERSION_EDASYEDA[0] < 3) return 'EasyEDA editor version is older than v3';
    return undefined;
}

async function getAssemblyOffset(circuit: CircuitAssembly): Promise<Offset> {
    let root = circuit.blocks_rect?.find(block => block.name.includes('__v_root__'));
    if (!root) {
        eda.sys_Log.add(
            '[source-assemble] Root not found in asm circuit; using 10x10 fallback',
            ESYS_LogType.ERROR,
        );
        root = { name: '__v_root__', description: '', x: 0, y: 0, width: 10, height: 10 };
    }
    const pageSize = await getPageSize();
    const target = {
        x: (pageSize.width - root.width) / 2,
        y: ((pageSize.height - root.height) / 2) + root.height,
    };
    if (target.x === 0) target.x = 10;
    if (target.y === 0) target.y = 10;
    return searchFreePlaceV2(target, { w: root.width, h: root.height });
}

export async function assembleCircuitSourceTask(
    circuit: CircuitAssembly,
    legacyAssembler: LegacyAssembler,
    legacyBlockDrawer: LegacyBlockDrawer,
): Promise<void> {
    const fallbackReason = requiresLegacyAssembler(circuit);
    if (fallbackReason) {
        eda.sys_Log.add(`[source-assemble] Legacy fallback: ${fallbackReason}`, ESYS_LogType.INFO);
        return legacyAssembler(circuit);
    }

    const startedAt = Date.now();
    eda.sys_Message.showToastMessage('Assemble circuit from source...', ESYS_ToastMessageType.INFO);
    eda.sys_Log.add('[source-assemble] Start', ESYS_LogType.INFO);
    const checkpointCreated = Boolean(await eda.checkpointer?.save(true));
    let detachedNets: AddedNet[] = [];

    try {
        const workingCircuit = createSourceWorkingCircuit(circuit);
        const currentDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo();
        if (!currentDocument) throw new Error('Current schematic document info not found');
        const projectUuid = currentDocument.parentProjectUuid ?? currentDocument.uuid;

        const removalPlan = await buildSourceRemovalPlan(workingCircuit);
        if (removalPlan.componentIds.size || removalPlan.points.length) {
            const currentSource = await eda.sys_FileManager.getDocumentSource();
            if (!currentSource) throw new Error('Document source is empty before source removals');
            const removalResult = removeSourceObjects(currentSource, removalPlan);
            if (removalResult.removedRecords) {
                await setSourceAndRefresh(removalResult.source, 'rm_components/rm_net');
                detachedNets = await resolveDetachedNets(removalResult.detachedNets);
                eda.sys_Log.add(`[source-assemble] Removed ${removalResult.removedRecords} source records`);
            }
        }

        const offset = await getAssemblyOffset(workingCircuit);
        const plans = planComponents(workingCircuit, offset);
        await resolveMultipartSubPartNames(plans);
        let source = await eda.sys_FileManager.getDocumentSource();
        if (!source) throw new Error('Document source is empty before component placement');
        await bindReplacementPlans(workingCircuit, plans, source);
        const groups = groupPlans(plans);
        let records = parseDocumentSource(source);
        const pageCachedVariants = await cacheTemplatesFromCurrentPage(groups, projectUuid, records);
        const cachedVariants = [...groups.keys()].filter(key =>
            componentTemplateCache.has(getTemplateCacheKey(projectUuid, key)),
        ).length;
        eda.sys_Log.add(
            `[source-assemble] ${plans.length} components, ${groups.size} variants, ` +
            `${cachedVariants} cached (${pageCachedVariants} from page)`,
        );

        eda.sys_Log.add('[source-assemble] Stage: component seeds', ESYS_LogType.INFO);
        const seededKeys = await placeSeeds(groups, projectUuid);

        source = await eda.sys_FileManager.getDocumentSource();
        if (!source) throw new Error('Document source is empty after component seed placement');
        records = parseDocumentSource(source);
        const templates = collectComponentTemplates(records, groups, projectUuid, seededKeys);
        const componentResult = cloneComponentsIntoSource(source, records, groups, templates);

        if (componentResult.addedCount) {
            await setSourceAndRefresh(componentResult.source, 'bulk component');
            source = componentResult.source;
            records = parseDocumentSource(source);
        }

        eda.sys_Log.add('[source-assemble] Stage: load pins', ESYS_LogType.INFO);
        await loadPins(plans);
        const replacementOccupied = plans.some(plan => plan.replacement)
            ? await getOccupiedWireSegments([])
            : [];
        const replacementBridges = validateSourceReplacements(plans, replacementOccupied);
        if (plans.some(plan => plan.replacement)) {
            source = await eda.sys_FileManager.getDocumentSource();
            if (!source) throw new Error('Document source is empty before source replacements');
            const replacedSource = applySourceReplacements(source, plans);
            await setSourceAndRefresh(replacedSource, 'replace_components');
            for (const plan of plans) plan.pins = undefined;
            await loadPins(plans);
            eda.sys_Log.add(
                `[source-assemble] Replaced ${plans.filter(plan => plan.replacement).length} component units`,
                ESYS_LogType.INFO,
            );
        }
        const extraNets = [
            ...(workingCircuit.added_net ?? []),
            ...detachedNets,
            ...getUnusedPinNets(workingCircuit, plans),
        ];
        const circuitWireSpecs = [
            ...buildWireSpecs(workingCircuit, plans, offset),
            ...replacementBridges,
        ];
        eda.sys_Log.add('[source-assemble] Stage: bulk net ports', ESYS_LogType.INFO);
        const attachmentResult = await bulkAddNetAttachments(extraNets, plans, projectUuid, circuitWireSpecs);
        const wireSpecs = normalizeWireSpecs([...circuitWireSpecs, ...attachmentResult.wireSpecs]);
        eda.sys_Log.add('[source-assemble] Stage: bulk wires', ESYS_LogType.INFO);
        const wireCount = await bulkAddWires(wireSpecs);
        if (workingCircuit.assembly_options?.draw_blocks) {
            eda.sys_Log.add('[source-assemble] Stage: legacy block drawing', ESYS_LogType.INFO);
            await legacyBlockDrawer(workingCircuit.blocks_rect, offset);
        }
        eda.sys_Log.add('[source-assemble] Stage: short-symbol cleanup', ESYS_LogType.INFO);
        const removedShortSymbols = await removeUnusedShortSymbols();
        if (attachmentResult.unresolved) {
            eda.sys_Message.showToastMessage(
                `${attachmentResult.unresolved} net ports could not be placed; see source-assemble log.`,
                ESYS_ToastMessageType.WARNING,
            );
        }

        const saved = await eda.sch_Document.save();
        if (!saved) throw new Error('Failed to save source-assembled schematic');

        const duration = Date.now() - startedAt;
        eda.sys_Log.add(
            `[source-assemble] Complete in ${duration}ms: ${plans.length} components ` +
            `(${seededKeys.size + attachmentResult.apiSeeds} API seeds), ${wireCount} wires, ` +
            `${attachmentResult.portCount} bulk ports, ${removedShortSymbols} unused short symbols removed, ` +
            `${attachmentResult.unresolved} unresolved ports`,
            ESYS_LogType.INFO,
        );
        eda.sys_Message.showToastMessage('Assemble complete.', ESYS_ToastMessageType.SUCCESS);
    } catch (error) {
        eda.sys_Log.add(`[source-assemble] Failed: ${(error as Error).message}`, ESYS_LogType.ERROR);
        if (checkpointCreated) {
            const restored = await eda.checkpointer?.restore(undefined, true).catch(() => false);
            if (!restored) eda.sys_Log.add('[source-assemble] Checkpoint rollback failed', ESYS_LogType.ERROR);
        }
        throw error;
    }
}
