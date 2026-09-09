import { getLocalPointOffset, pointInPolygon } from '#pcb-layout/pcb-auto-place/geometry.ts';
import type { ExplainCircuit } from '#types/circuit.ts';
import type { ExistingPlacement, Layer, PlacementInput } from '#types/pcb/layout-model.ts';
import type { Block, PlacementRules } from '#types/pcb/layout-rules.ts';
import { MAX_BLOCK_COMPONENTS } from './placement-input.ts';

export function applyExistingBoard(
    rules: PlacementRules,
    existingPlacement?: ExistingPlacement,
): PlacementRules {
    const preserve = rules.preserve;
    if (!preserve?.board && preserve?.components === undefined) return rules;
    if (!existingPlacement) throw new Error('preserve(...) requires existingPlacement.');
    if (!preserve.board) return rules;
    if (!existingPlacement.board) {
        throw new Error('preserve({ board: true }) requires existingPlacement.board.');
    }

    return {
        ...rules,
        board: {
            type: 'polygon',
            points: existingPlacement.board.polygon.map((point) => ({ ...point })),
            componentClearance: rules.board.componentClearance,
            edgeClearance: rules.board.edgeClearance,
            allowedLayers: rules.board.allowedLayers,
            defaultLayer: rules.board.defaultLayer,
        },
    };
}

export function applyExistingComponentPlacements(
    input: PlacementInput,
    preserve: PlacementRules['preserve'],
    existingPlacement?: ExistingPlacement,
): PlacementInput {
    if (preserve?.components === undefined) return input;
    if (!existingPlacement) throw new Error('preserve(...) requires existingPlacement.');

    const selectedDesignators = resolvePreservedComponentDesignators(preserve, existingPlacement);
    const existingByDesignator = new Map(existingPlacement.components.map((component) => [component.designator, component]));
    const preservedLayers = new Set<Layer>();

    const components = input.components.map((component) => {
        if (!selectedDesignators.has(component.designator)) return component;
        const existing = existingByDesignator.get(component.designator);
        if (!existing) return component;
        preservedLayers.add(existing.layer);
        const sourceOriginOffset = component.footprint.sourceOriginOffset
            ? getLocalPointOffset(component.footprint.sourceOriginOffset, existing.rotate, existing.layer)
            : { x: 0, y: 0 };
        return {
            ...component,
            pcb: {
                ...component.pcb,
                allowedLayers: [existing.layer],
                allowedRotations: [existing.rotate],
                fixedPlacement: {
                    x: existing.x - sourceOriginOffset.x,
                    y: existing.y - sourceOriginOffset.y,
                    rotate: existing.rotate,
                    layer: existing.layer,
                },
                edgeMount: undefined,
                edgePlace: undefined,
            },
        };
    });

    return {
        ...input,
        board: {
            ...input.board,
            allowedLayers: [...new Set([...input.board.allowedLayers, ...preservedLayers])],
        },
        components,
    };
}

export function ensurePreservedComponentBlocks(
    circuit: ExplainCircuit,
    rules: PlacementRules,
    existingPlacement?: ExistingPlacement,
): PlacementRules {
    if (rules.preserve?.components === undefined) return rules;
    if (!existingPlacement) throw new Error('preserve(...) requires existingPlacement.');

    const selectedDesignators = resolvePreservedComponentDesignators(rules.preserve, existingPlacement);
    const existingByDesignator = new Map(existingPlacement.components.map((component) => [component.designator, component]));
    const ownedDesignators = new Set([
        ...rules.blocks.flatMap((block) => block.component_designators),
        ...rules.component_rules.flatMap((rule) => rule.block_name ? [rule.designator] : []),
    ]);
    const missingByLayer = new Map<Layer, string[]>([['top', []], ['bottom', []]]);

    for (const component of circuit.components) {
        const existing = existingByDesignator.get(component.designator);
        if (!existing || !selectedDesignators.has(component.designator) || ownedDesignators.has(component.designator)) continue;
        missingByLayer.get(existing.layer)!.push(component.designator);
    }

    const usedNames = new Set(rules.blocks.map((block) => block.name));
    const systemBlocks: Block[] = [];
    for (const [layer, designators] of missingByLayer) {
        for (let offset = 0; offset < designators.length; offset += MAX_BLOCK_COMPONENTS) {
            systemBlocks.push(systemBlock(
                uniqueSystemBlockName(usedNames, layer, systemBlocks.length + 1),
                designators.slice(offset, offset + MAX_BLOCK_COMPONENTS),
            ));
        }
    }

    return systemBlocks.length > 0 ? { ...rules, blocks: [...rules.blocks, ...systemBlocks] } : rules;
}

export function resolvePreservedComponentDesignators(
    preserve: PlacementRules['preserve'],
    existingPlacement?: ExistingPlacement,
) {
    if (preserve?.components === undefined) return new Set<string>();
    if (!existingPlacement) throw new Error('preserve(...) requires existingPlacement.');
    if (preserve.components === 'all') return existingDesignatorsInsideBoard(existingPlacement);

    const existingDesignators = new Set(existingPlacement.components.map((component) => component.designator));
    return new Set(preserve.components.filter((designator) => existingDesignators.has(designator)));
}

function existingDesignatorsInsideBoard(existingPlacement: ExistingPlacement) {
    const polygon = existingPlacement.board?.polygon;
    if (!polygon) {
        throw new Error('preserve({ components: "all" }) requires existingPlacement.board.');
    }
    return new Set(existingPlacement.components
        .filter((component) => pointInPolygon(component, polygon))
        .map((component) => component.designator));
}

function uniqueSystemBlockName(usedNames: Set<string>, layer: Layer, index: number) {
    const base = `__preserved_${layer}_${index}`;
    let name = base;
    while (usedNames.has(name)) name += '_';
    usedNames.add(name);
    return name;
}

function systemBlock(name: string, componentDesignators: string[]): Block {
    return {
        name,
        description: 'Preserved components (system)',
        component_designators: componentDesignators,
        role: 'generic',
        placement: null,
        attachTo: null,
        anchor: null,
        anchorOffset: null,
        sidePreference: null,
        maxBboxScale: null,
        maxBboxWidth: null,
        maxBboxHeight: null,
        hardBbox: null,
        maxAnchorGap: null,
        hardAnchor: null,
        familyMaxBboxScale: null,
        familyMaxWidth: null,
        familyMaxHeight: null,
        familyHard: null,
        placementClearance: null,
        allowDisconnected: true,
    };
}
