import masterLogger from "#logger.ts";
import { resolveEasyEdaFootprintByPartUuid, resolveEasyEdaFootprintByUuid } from "#devices/footprints/easyeda-footprint.ts";
import type { ExplainCircuit } from "#types/circuit.ts";
import type { ComponentRole, FootprintSpec } from "#types/pcb/layout-model.ts";
import type { BoardOverflowAllowance, FixedPlacement, Footprint } from "#types/pcb/layout-rules.ts";

const logger = masterLogger.child({ TAG: "pcb-layout-footprints" });
const EASYEDA_UUID_RE = /^[a-f0-9]{32}$/i;

export async function resolveComponentFootprint(
    component: ExplainCircuit["components"][number],
    cache = new Map<string, Promise<FootprintSpec | null>>(),
    footprints?: Readonly<Record<string, FootprintSpec>>,
) {
    const provided = providedComponentFootprint(component, footprints);
    if (provided) return provided;

    const footprintUuid = validEasyEdaUuid(component.footprint_uuid) ? component.footprint_uuid : null;
    const partUuid = validEasyEdaUuid(component.part_uuid) ? component.part_uuid : null;

    if (footprintUuid) {
        const cacheKey = `footprint:${footprintUuid}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const promise = resolveEasyEdaFootprintByUuid(footprintUuid)
            .catch((error) => {
                logger.warn({ error, designator: component.designator, footprint_uuid: footprintUuid }, "Failed to resolve EasyEDA footprint by footprint_uuid");
                return partUuid ? resolveFootprintByPartUuid(component, partUuid, cache) : null;
            });
        cache.set(cacheKey, promise);
        return promise;
    }

    return partUuid ? resolveFootprintByPartUuid(component, partUuid, cache) : null;
}

export async function requireResolvedComponentFootprint(
    component: ExplainCircuit["components"][number],
    cache = new Map<string, Promise<FootprintSpec | null>>(),
    footprints?: Readonly<Record<string, FootprintSpec>>,
) {
    const footprint = await resolveComponentFootprint(component, cache, footprints);
    if (footprint) return footprint;

    const hasFootprintUuid = validEasyEdaUuid(component.footprint_uuid);
    const hasPartUuid = validEasyEdaUuid(component.part_uuid);
    if (!hasFootprintUuid && !hasPartUuid) {
        throw new Error(`Missing real footprint for ${component.designator}: component has no valid footprint_uuid or part_uuid. PCB layout no longer uses inferred/offline generic footprints.`);
    }

    throw new Error(`Missing real footprint for ${component.designator}: failed to resolve provided or EasyEDA footprint for footprint_uuid ${component.footprint_uuid ?? "null"} or part_uuid ${component.part_uuid ?? "null"}. Check the provided footprints, internet/cache, or choose a component with a valid footprint.`);
}

function providedComponentFootprint(
    component: ExplainCircuit["components"][number],
    footprints?: Readonly<Record<string, FootprintSpec>>,
) {
    if (!footprints) return null;
    for (const key of [component.footprint_uuid, component.part_uuid]) {
        if (key && Object.hasOwn(footprints, key)) return footprints[key] ?? null;
    }
    return null;
}

function resolveFootprintByPartUuid(
    component: ExplainCircuit["components"][number],
    partUuid: string,
    cache: Map<string, Promise<FootprintSpec | null>>,
) {
    const cacheKey = `part:${partUuid}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const promise = resolveEasyEdaFootprintByPartUuid(partUuid)
        .catch((error) => {
            logger.warn({ error, designator: component.designator, part_uuid: partUuid }, "Failed to resolve EasyEDA footprint by part_uuid");
            return null;
        });
    cache.set(cacheKey, promise);
    return promise;
}

function validEasyEdaUuid(value: string | null | undefined): value is string {
    return Boolean(value && EASYEDA_UUID_RE.test(value) && !/^0+$/.test(value));
}

export function normalizeFootprintSpec(footprint: Footprint | null | undefined): FootprintSpec | null {
    if (!footprint) return null;
    return {
        name: footprint.name,
        width: footprint.width,
        height: footprint.height,
        pads: footprint.pads.map((pad) => ({
            pin_number: pad.pin_number,
            ...(pad.name === null ? {} : { name: pad.name }),
            x: pad.x,
            y: pad.y,
            width: pad.width,
            height: pad.height,
            ...(pad.shape == null ? {} : { shape: pad.shape }),
            ...(pad.mount == null ? {} : { mount: pad.mount }),
            ...(pad.drillDiameter == null ? {} : { drillDiameter: pad.drillDiameter }),
        })),
    };
}

export function normalizeFixedPlacement(fixed: FixedPlacement | null | undefined) {
    if (!fixed) return undefined;
    return {
        ...(fixed.x === null ? {} : { x: fixed.x }),
        ...(fixed.y === null ? {} : { y: fixed.y }),
        ...(fixed.anchor === null ? {} : { anchor: fixed.anchor }),
        ...(fixed.offset === null ? {} : {
            offset: {
                ...(fixed.offset.x === null ? {} : { x: fixed.offset.x }),
                ...(fixed.offset.y === null ? {} : { y: fixed.offset.y }),
            },
        }),
        ...(fixed.rotate === null ? {} : { rotate: fixed.rotate }),
        ...(fixed.layer === null ? {} : { layer: fixed.layer }),
    };
}

export function normalizeBoardOverflow(overflow: BoardOverflowAllowance | null | undefined) {
    if (!overflow) return undefined;
    return {
        ...(overflow.left === null ? {} : { left: overflow.left }),
        ...(overflow.right === null ? {} : { right: overflow.right }),
        ...(overflow.top === null ? {} : { top: overflow.top }),
        ...(overflow.bottom === null ? {} : { bottom: overflow.bottom }),
    };
}

export function inferComponentRole(designator: string, value: string): ComponentRole {
    if (/^J/i.test(designator)) return "connector";
    if (/^U/i.test(designator)) return "main_ic";
    if (/^C/i.test(designator)) return /100n|0\.1u|1u|10u/i.test(value) ? "decoupling_cap" : "passive";
    if (/^Y|XTAL|CRYSTAL/i.test(designator) || /crystal|xtal/i.test(value)) return "crystal";
    if (/^D|LED/i.test(designator) || /led/i.test(value)) return "indicator";
    return "passive";
}
