import { centeredBoard, defaultSolverOptions } from "#pcb-layout/pcb-auto-place/utils.ts";
import { boardAnchorPoint, outlineInsetPointFromCorner, pointsBox, rectBoardPolygon } from "#pcb-layout/pcb-auto-place/geometry.ts";
import { compileAntenna, compileSolderJumper, compileThermalPad } from "#pcb-layout/procedural-footprints.ts";
import {
    applyEdgeMountPlacement,
    applyEdgePlacePlacement,
    applyFaceToRotationConstraint,
    normalizeEdgeMountRule,
    normalizeEdgePlaceRule,
    normalizeFaceDirection,
} from "#pcb-layout/placement-rules.ts";
import type { ExplainCircuit } from "#types/circuit.ts";
import type {
    FootprintSpec,
    BoardHole,
    BoardPadLayer,
    CenteredRectBoard,
    PcbDesignatorTextOptions,
    PcbBlock,
    PcbComponent,
    PcbSyntheticBoardPad,
    PcbSyntheticBoardPadCell,
    PcbSyntheticBoardPadHole,
    PcbConstraintRegion,
    PcbModule,
    PlacementHint,
    PlacementInput,
    PlacementRefineGroup,
    PlacementSignalPath,
    RemoveNull,
    TargetRef,
} from "#types/pcb/layout-model.ts";
import type { Block, Board, BoardHoleRule, BoardPadRule, ComponentRule, ConstraintRegionRule, Module, PlacementRules, ProceduralFeatureRule, RefineGroupRule, SignalPathRule, SolverOptions } from "#types/pcb/layout-rules.ts";
import { clamp } from "#utils/math.ts";
import { roundForMessage, stripNulls } from "./common.ts";
import {
    inferComponentRole,
    normalizeBoardOverflow,
    normalizeFixedPlacement,
    normalizeFootprintSpec,
    requireResolvedComponentFootprint,
} from "./footprints.ts";

export const DEFAULT_COMPONENT_DENSITY = 0.4;
export const MAX_BLOCK_COMPONENTS = 12;
export type PlacementPreviewMetadata = {
    enabled: boolean;
    placedComponents: string[];
    ignoredComponents: string[];
    totalComponents: number;
    warnings: string[];
};

export function requireAttachedCircuit(circuit: ExplainCircuit | undefined) {
    if (!circuit?.components?.length) {
        throw new Error("No attached circuit found. Attach or create a circuit before using pcb_layout.");
    }
    return circuit;
}

export function validatePlacementTargetRefs(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = collectPlacementTargetRefErrors(circuit, rules);
    if (errors.length === 0) return;
    throw new Error([
        "Invalid PCB placement target refs:",
        ...errors,
    ].join("\n"));
}

function collectPlacementTargetRefErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const componentNames = new Set([...circuit.components, ...syntheticCircuitComponents(rules)].map((component) => component.designator));
    const blockNames = new Set(rules.blocks.map((block) => block.name));
    const invalidTargets: string[] = [];

    for (const target of collectPlacementTargets(rules.hints as PlacementHint[])) {
        if (target.type !== "component" || componentNames.has(target.designator)) continue;
        invalidTargets.push(blockNames.has(target.designator)
            ? `comp("${target.designator}") points to a block name. Use block("${target.designator}") instead.`
            : `comp("${target.designator}") does not match any component designator.`);
    }

    return [...new Set(invalidTargets)].map((item) => `- ${item}`);
}

export function validatePlacementRulesForCircuit(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = [
        ...sectionErrors("Invalid placement target refs:", collectPlacementTargetRefErrors(circuit, rules)),
        ...collectBlockOwnershipErrors(circuit, rules),
        ...collectBlockLayerOwnershipErrors(rules),
        ...collectMechanicalBlockOwnershipErrors(rules),
        ...collectPlacementHintSemanticErrors(circuit, rules),
        ...sectionErrors("Invalid signalPath rules:", collectSignalPathErrors(circuit, rules)),
        ...sectionErrors("Invalid refineGroup rules:", collectRefineGroupErrors(circuit, rules)),
        ...collectBlockNetConnectivityErrors(circuit, rules),
        ...collectFixedPlacementUsageErrors(circuit, rules),
    ];

    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

export function applyPlacementPreviewFilter(circuit: ExplainCircuit, rules: PlacementRules): {
    circuit: ExplainCircuit;
    rules: PlacementRules;
    preview: PlacementPreviewMetadata;
} {
    const allComponentNames = [
        ...circuit.components.map((component) => component.designator),
        ...(rules.boardPads ?? []).map((pad) => pad.name),
        ...(rules.proceduralFeatures ?? [])
            .filter((feature) => feature.kind !== "thermal_pad")
            .map((feature) => feature.name),
    ];
    const allComponentNameSet = new Set(allComponentNames);
    const solverOptions = rules.solverOptions ?? null;
    const placeOnly = uniqueStrings(solverOptions?.placeOnlyComponents ?? []);
    const ignore = uniqueStrings(solverOptions?.ignoreComponents ?? []);
    const filterEnabled = placeOnly.length > 0 || ignore.length > 0;
    const enabled = solverOptions?.preview === true || filterEnabled;

    if (placeOnly.length > 0 && ignore.length > 0) {
        throw new Error([
            "Invalid PCB placement preview filter:",
            "- solver({ placeOnlyComponents, ignoreComponents }) cannot use both filters at once. Use placeOnlyComponents for mechanical previews, or ignoreComponents for temporary exclusion.",
        ].join("\n"));
    }

    const unknown = [...placeOnly, ...ignore].filter((designator) => !allComponentNameSet.has(designator));
    if (unknown.length > 0) {
        throw new Error([
            "Invalid PCB placement preview filter:",
            `- Unknown component(s): ${unknown.join(", ")}.`,
        ].join("\n"));
    }

    if (!enabled) {
        return {
            circuit,
            rules,
            preview: {
                enabled: false,
                placedComponents: allComponentNames,
                ignoredComponents: [],
                totalComponents: allComponentNames.length,
                warnings: [],
            },
        };
    }

    const selected = new Set(placeOnly.length > 0
        ? placeOnly
        : allComponentNames.filter((designator) => !ignore.includes(designator)));
    const ignoredComponents = allComponentNames.filter((designator) => !selected.has(designator));
    const selectedBlocks = filterPreviewBlocks(rules.blocks, rules.component_rules, selected);
    const selectedBlockNames = new Set(selectedBlocks.map((block) => block.name));
    const selectedBoardPads = (rules.boardPads ?? []).filter((pad) => selected.has(pad.name));
    const selectedProceduralFeatures = (rules.proceduralFeatures ?? []).filter((feature) => feature.kind === "thermal_pad"
        ? selected.has(feature.at.designator)
        : selected.has(feature.name));
    const selectedComponentRules = rules.component_rules
        .filter((rule) => selected.has(rule.designator))
        .map((rule) => selectedBlockNames.has(rule.block_name ?? "") ? rule : { ...rule, block_name: null });
    const blocks = ensurePreviewBlockOwnership(selectedBlocks, selectedComponentRules, selected);
    const blockNames = new Set(blocks.map((block) => block.name));
    const hints = rules.hints.filter((hint) => previewHintIsUsable(hint as PlacementHint, selected, blockNames));
    const paths = (rules.paths ?? []).filter((path) => path.segments.every((segment) => (
        selected.has(segment.source.designator) && selected.has(segment.target.designator)
    )));
    const refineGroups = (rules.refineGroups ?? []).flatMap((group) => {
        const component_designators = group.component_designators.filter((designator) => selected.has(designator));
        const swap = group.swap && component_designators.length >= 2;
        return component_designators.length > 0 && (swap || group.rotateBy.length > 0)
            ? [{ ...group, component_designators, swap }]
            : [];
    });
    const modules = (rules.modules ?? [])
        .map((module) => ({
            ...module,
            block_names: module.block_names.filter((blockName) => blockNames.has(blockName)),
        }))
        .filter((module) => module.block_names.length > 0);

    return {
        circuit: {
            ...circuit,
            components: circuit.components.filter((component) => selected.has(component.designator)),
        },
        rules: {
            ...rules,
            boardPads: selectedBoardPads,
            proceduralFeatures: selectedProceduralFeatures,
            blocks,
            modules,
            component_rules: selectedComponentRules,
            hints,
            paths,
            refineGroups,
            solverOptions: {
                candidateRadii: null, candidateAngles: null, fallbackGridStep: null,
                placementGridStep: null, ignoredRatsnestSignals: null, localImproveIterations: null,
                localImproveMinDelta: null, hierarchicalBlocks: null, compactness: null,
                ...rules.solverOptions,
                preview: true,
                placeOnlyComponents: placeOnly.length > 0 ? placeOnly : null,
                ignoreComponents: ignore.length > 0 ? ignore : null,
            },
        },
        preview: {
            enabled: true,
            placedComponents: allComponentNames.filter((designator) => selected.has(designator)),
            ignoredComponents,
            totalComponents: allComponentNames.length,
            warnings: [
                "PREVIEW ONLY: this placement contains only selected components and must not be treated as a final PCB layout.",
                ...(hints.length < rules.hints.length ? [`Removed ${rules.hints.length - hints.length} rule(s) that referenced ignored preview components or blocks.`] : []),
                ...(paths.length < (rules.paths?.length ?? 0) ? [`Removed ${(rules.paths?.length ?? 0) - paths.length} signal path(s) that referenced ignored preview components.`] : []),
            ],
        },
    };
}

function validateFixedPlacementUsage(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = collectFixedPlacementUsageErrors(circuit, rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectFixedPlacementUsageErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const componentByDesignator = new Map([...circuit.components, ...syntheticCircuitComponents(rules)].map((component) => [component.designator, component]));
    const invalid = rules.component_rules.flatMap((rule) => {
        if (!rule.fixedPlacement) return [];
        const component = componentByDesignator.get(rule.designator);
        if (!component) return [];
        const role = rule.role ?? inferComponentRole(component.designator, component.value);
        return role === "connector"
            ? []
            : [`component("${rule.designator}") has fixed(...), but role is "${role}". fixed() is allowed only for role("connector"). Use block anchors, near/veryNear, sidePreference, or edgeMount for connectors instead.`];
    });

    return invalid.length === 0 ? [] : [
        "fixed() is reserved for mechanical connector placement only.",
        ...invalid.map((item) => `- ${item}`),
    ];
}

function validateBlockOwnership(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = collectBlockOwnershipErrors(circuit, rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectBlockOwnershipErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const allComponents = [...circuit.components, ...syntheticCircuitComponents(rules)];
    const componentNames = new Set(allComponents.map((component) => component.designator));
    const blockNames = new Set(rules.blocks.map((block) => block.name));
    const ownerByDesignator = new Map<string, Set<string>>();
    const invalidEntries: string[] = [];

    for (const block of rules.blocks) {
        for (const designator of block.component_designators) {
            if (!componentNames.has(designator)) {
                invalidEntries.push(`block("${block.name}") references unknown component "${designator}".`);
                continue;
            }
            addOwner(ownerByDesignator, designator, block.name);
        }
    }

    for (const rule of rules.component_rules) {
        if (!componentNames.has(rule.designator)) {
            invalidEntries.push(`component("${rule.designator}") does not match any component in the attached circuit.`);
            continue;
        }
        if (!rule.block_name) continue;
        if (!blockNames.has(rule.block_name)) {
            invalidEntries.push(`component("${rule.designator}").block("${rule.block_name}") references an undefined block.`);
            continue;
        }
        addOwner(ownerByDesignator, rule.designator, rule.block_name);
    }

    const missingOwners = allComponents
        .map((component) => component.designator)
        .filter((designator) => !ownerByDesignator.has(designator));
    const duplicateOwners = [...ownerByDesignator.entries()]
        .filter(([, owners]) => owners.size > 1)
        .map(([designator, owners]) => `${designator}: ${[...owners].join(", ")}`);
    const oversizedBlocks = canonicalBlockDesignators(rules.blocks, rules.component_rules)
        .filter((block) => block.designators.length > MAX_BLOCK_COMPONENTS)
        .map((block) => `${block.name}: ${block.designators.length} components (${block.designators.join(", ")})`);

    const errors: string[] = [];
    if (invalidEntries.length > 0) {
        errors.push("Invalid component/block references:", ...invalidEntries.map((item) => `- ${item}`));
    }
    if (missingOwners.length > 0) {
        errors.push(
            "Components without block ownership:",
            `- ${missingOwners.join(", ")}`,
            "Every component must belong to exactly one block. Add block(\"name\", [...]) or component(\"U1\").block(\"name\").",
        );
    }
    if (duplicateOwners.length > 0) {
        errors.push(
            "Components assigned to more than one block:",
            ...duplicateOwners.map((item) => `- ${item}`),
            "Each component must have exactly one block owner. Split by physical ownership, not by every net it touches.",
        );
    }
    if (oversizedBlocks.length > 0) {
        errors.push(
            `Blocks with more than ${MAX_BLOCK_COMPONENTS} components are too large for stable placement:`,
            ...oversizedBlocks.map((item) => `- ${item}`),
            "Split large blocks into smaller main/satellite blocks such as decoupling, clock, flash, input, output, feedback, buttons, and connectors.",
        );
    }

    return errors;
}

function validateBlockLayerOwnership(rules: PlacementRules) {
    const errors = collectBlockLayerOwnershipErrors(rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectBlockLayerOwnershipErrors(rules: PlacementRules) {
    const componentRules = new Map(rules.component_rules.map((rule) => [rule.designator, rule]));
    const defaultLayer = rules.board.defaultLayer ?? "top";
    const invalidBlocks = canonicalBlockDesignators(rules.blocks, rules.component_rules)
        .map((block) => {
            const layersByDesignator = block.designators.map((designator) => ({
                designator,
                layer: declaredComponentLayer(componentRules.get(designator), defaultLayer),
            }));
            const layers = [...new Set(layersByDesignator.map((item) => item.layer))];
            return { name: block.name, layers, layersByDesignator };
        })
        .filter((block) => block.layers.length > 1);

    if (invalidBlocks.length === 0) return [];

    return [
        "A block must not mix top and bottom components. Split mixed-layer groups into separate blocks, for example mcu_decoup_top and mcu_decoup_bottom.",
        ...invalidBlocks.map((block) => {
            const components = block.layersByDesignator
                .map((item) => `${item.designator}:${item.layer}`)
                .join(", ");
            return `- block("${block.name}") mixes layers (${components}).`;
        }),
    ];
}

function validateMechanicalBlockOwnership(rules: PlacementRules) {
    const errors = collectMechanicalBlockOwnershipErrors(rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectMechanicalBlockOwnershipErrors(rules: PlacementRules) {
    const componentRules = new Map(rules.component_rules.map((rule) => [rule.designator, rule]));
    const invalidBlocks = canonicalBlockDesignators(rules.blocks, rules.component_rules)
        .map((block) => {
            const ruleBlock = rules.blocks.find((item) => item.name === block.name);
            const mechanicalComponents = block.designators.filter((designator) => {
                const rule = componentRules.get(designator);
                return Boolean(rule?.fixedPlacement || rule?.edgeMount || rule?.edgePlace);
            });
            return {
                name: block.name,
                attachTo: ruleBlock?.attachTo,
                mechanicalComponents,
            };
        })
        .filter((block) => block.attachTo && block.mechanicalComponents.length > 0);

    if (invalidBlocks.length === 0) return [];

    return [
        "Mechanical blocks with fixed(), edgeMount(), or edgePlace() components cannot be satellites.",
        "Make them board-level blocks and connect them electrically with near(), veryNear(), or criticalPair() instead of attachTo.",
        ...invalidBlocks.map((block) => `- block("${block.name}") attaches to "${block.attachTo}" but contains mechanical components: ${block.mechanicalComponents.join(", ")}.`),
    ];
}

function validateBlockNetConnectivity(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = collectBlockNetConnectivityErrors(circuit, rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectBlockNetConnectivityErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const allComponents = [...circuit.components, ...syntheticCircuitComponents(rules)];
    const componentByDesignator = new Map(allComponents.map((component) => [component.designator, component]));
    const allowDisconnectedBlocks = new Set(rules.blocks
        .filter((block) => block.allowDisconnected === true)
        .map((block) => block.name));
    const invalidBlocks = canonicalBlockDesignators(rules.blocks, rules.component_rules)
        .filter((block) => !allowDisconnectedBlocks.has(block.name))
        .map((block) => {
            const designators = block.designators.filter((designator) => componentByDesignator.has(designator));
            return {
                name: block.name,
                groups: connectedComponentGroups(designators, componentByDesignator),
            };
        })
        .filter((block) => block.groups.length > 1);

    if (invalidBlocks.length === 0) return [];

    return [
        "Each block must be one net-connected physical island. Split unrelated components into separate main/satellite blocks.",
        ...invalidBlocks.map((block) => {
            const groups = block.groups
                .map((group, index) => `group ${index + 1}: ${group.join(", ")}`)
                .join("; ");
            return `- block("${block.name}") is disconnected (${groups}).`;
        }),
    ];
}

function connectedComponentGroups(
    designators: string[],
    componentByDesignator: Map<string, ExplainCircuit["components"][number]>,
) {
    if (designators.length <= 1) return [designators];

    const designatorSet = new Set(designators);
    const neighbors = new Map(designators.map((designator) => [designator, new Set<string>()]));
    const byNet = new Map<string, string[]>();

    for (const designator of designators) {
        const component = componentByDesignator.get(designator);
        if (!component) continue;
        for (const net of componentNetSet(component, { ignoreCommonGround: true })) {
            const list = byNet.get(net) ?? [];
            list.push(designator);
            byNet.set(net, list);
        }
    }

    for (const connectedDesignators of byNet.values()) {
        if (connectedDesignators.length < 2) continue;
        for (const source of connectedDesignators) {
            const sourceNeighbors = neighbors.get(source);
            if (!sourceNeighbors) continue;
            for (const target of connectedDesignators) {
                if (target !== source && designatorSet.has(target)) sourceNeighbors.add(target);
            }
        }
    }

    const groups: string[][] = [];
    const visited = new Set<string>();
    for (const start of designators) {
        if (visited.has(start)) continue;
        const group: string[] = [];
        const stack = [start];
        visited.add(start);
        while (stack.length > 0) {
            const current = stack.pop()!;
            group.push(current);
            for (const next of neighbors.get(current) ?? []) {
                if (visited.has(next)) continue;
                visited.add(next);
                stack.push(next);
            }
        }
        groups.push(group);
    }
    return groups;
}

function validatePlacementHintSemantics(circuit: ExplainCircuit, rules: PlacementRules) {
    const errors = collectPlacementHintSemanticErrors(circuit, rules);
    if (errors.length === 0) return;
    throw new Error(["Invalid PCB placement DSL:", ...errors].join("\n"));
}

function collectPlacementHintSemanticErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const allComponents = [...circuit.components, ...syntheticCircuitComponents(rules)];
    const componentByDesignator = new Map(allComponents.map((component) => [component.designator, component]));
    const errors: string[] = [];

    for (const hint of rules.hints) {
        if (hint.relation !== "cap_cluster") continue;
        const label = `capCluster([${hint.capacitors.map((designator) => `"${designator}"`).join(", ")}])`;
        if (!hint.powerNet) errors.push(`${label} requires a non-empty powerNet.`);
        if (!hint.returnNet) errors.push(`${label} requires a non-empty returnNet.`);
        if (!hint.target) {
            errors.push(`${label} requires target: pin("U1", "..."). Without a target it is ambiguous and should be modeled with bypass/near instead.`);
        }

        for (const designator of hint.capacitors) {
            const component = componentByDesignator.get(designator);
            if (!component) continue;
            const nets = componentNetSet(component);
            if (hint.powerNet && !nets.has(hint.powerNet)) {
                errors.push(`${label}: component "${designator}" has no pad on powerNet "${hint.powerNet}".`);
            }
            if (hint.returnNet && !nets.has(hint.returnNet)) {
                errors.push(`${label}: component "${designator}" has no pad on returnNet "${hint.returnNet}".`);
            }
        }

        if (!hint.target) continue;
        const targetComponent = componentByDesignator.get(hint.target.designator);
        if (!targetComponent) {
            errors.push(`${label}: target component "${hint.target.designator}" does not exist.`);
            continue;
        }
        const targetPin = targetComponent.pins.find((pin) => String(pin.pin_number) === String(hint.target!.pin_number));
        if (!targetPin) {
            errors.push(`${label}: target pin ${hint.target.designator}.${String(hint.target.pin_number)} does not exist.`);
            continue;
        }
        if (hint.powerNet && targetPin.signal_name !== hint.powerNet) {
            errors.push(`${label}: target pin ${hint.target.designator}.${String(hint.target.pin_number)} is net "${targetPin.signal_name}", expected powerNet "${hint.powerNet}".`);
        }
    }

    return errors.length === 0 ? [] : [
        "Invalid capCluster rules:",
        ...errors.map((item) => `- ${item}`),
    ];
}

function sectionErrors(title: string, errors: string[]) {
    return errors.length === 0 ? [] : [title, ...errors];
}

function componentNetSet(component: ExplainCircuit["components"][number], options: { ignoreCommonGround?: boolean } = {}) {
    return new Set(component.pins
        .map((pin) => pin.signal_name)
        .filter((net) => typeof net === "string" && net.length > 0)
        .filter((net) => !options.ignoreCommonGround || net.toUpperCase() !== "GND"));
}

function declaredComponentLayer(rule: ComponentRule | undefined, defaultLayer: "top" | "bottom") {
    const fixedLayer = rule?.fixedPlacement?.layer;
    if (fixedLayer) return fixedLayer;
    const edgeMountLayer = rule?.edgeMount?.layer;
    if (edgeMountLayer) return edgeMountLayer;
    const edgePlaceLayer = rule?.edgePlace?.layer;
    if (edgePlaceLayer) return edgePlaceLayer;
    if (rule?.allowedLayers?.length === 1) return rule.allowedLayers[0];
    return defaultLayer;
}

function addOwner(ownerByDesignator: Map<string, Set<string>>, designator: string, blockName: string) {
    const owners = ownerByDesignator.get(designator) ?? new Set<string>();
    owners.add(blockName);
    ownerByDesignator.set(designator, owners);
}

export function collectPlacementTargets(hints: PlacementHint[]) {
    const targets: TargetRef[] = [];
    for (const hint of hints) {
        switch (hint.relation) {
            case "very_near":
            case "near":
            case "away_from":
            case "same_side":
            case "cluster_with":
                targets.push(hint.source, hint.target);
                break;
            case "clearance":
                targets.push(hint.source);
                if (hint.target !== "all") targets.push(hint.target);
                break;
            case "edge":
            case "prefer_layer":
                targets.push(hint.source);
                break;
            case "bypass":
                targets.push(hint.target);
                break;
            case "cap_cluster":
                if (hint.target) targets.push(hint.target);
                break;
            case "critical_pair":
                targets.push(hint.source, hint.target);
                break;
            case "line":
                break;
        }
    }
    return targets;
}

function uniqueStrings(values: unknown[]) {
    return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function filterPreviewBlocks(blocks: Block[], componentRules: ComponentRule[], selected: Set<string>) {
    const rulesByBlock = new Map<string, string[]>();
    for (const rule of componentRules) {
        if (!rule.block_name || !selected.has(rule.designator)) continue;
        const designators = rulesByBlock.get(rule.block_name) ?? [];
        designators.push(rule.designator);
        rulesByBlock.set(rule.block_name, designators);
    }

    return blocks
        .map((block) => ({
            ...block,
            component_designators: uniqueStrings([
                ...block.component_designators.filter((designator) => selected.has(designator)),
                ...(rulesByBlock.get(block.name) ?? []),
            ]),
            allowDisconnected: true,
        }))
        .filter((block) => block.component_designators.length > 0);
}

function ensurePreviewBlockOwnership(blocks: Block[], componentRules: ComponentRule[], selected: Set<string>) {
    const owned = new Set<string>();
    for (const block of blocks) {
        for (const designator of block.component_designators) owned.add(designator);
    }
    for (const rule of componentRules) {
        if (rule.block_name) owned.add(rule.designator);
    }

    const missing = [...selected].filter((designator) => !owned.has(designator));
    if (missing.length === 0) return blocks;

    const existingPreviewBlock = blocks.find((block) => block.name === "preview_auto");
    if (existingPreviewBlock) {
        return blocks.map((block) => block.name === "preview_auto"
            ? { ...block, component_designators: uniqueStrings([...block.component_designators, ...missing]) }
            : block);
    }

    return [
        ...blocks,
        {
            name: "preview_auto",
            description: "Preview auto block",
            component_designators: missing,
            role: "generic" as const,
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
        },
    ];
}

function previewHintIsUsable(hint: PlacementHint, selectedComponents: Set<string>, selectedBlocks: Set<string>) {
    switch (hint.relation) {
        case "very_near":
        case "near":
        case "away_from":
        case "same_side":
        case "cluster_with":
            return previewTargetIsUsable(hint.source, selectedComponents, selectedBlocks)
                && previewTargetIsUsable(hint.target, selectedComponents, selectedBlocks);
        case "clearance":
            return previewTargetIsUsable(hint.source, selectedComponents, selectedBlocks)
                && (hint.target === "all" || previewTargetIsUsable(hint.target, selectedComponents, selectedBlocks));
        case "edge":
        case "prefer_layer":
            return previewTargetIsUsable(hint.source, selectedComponents, selectedBlocks);
        case "line":
            return hint.components.every((designator) => selectedComponents.has(designator));
        case "bypass":
            return previewPinIsUsable(hint.target, selectedComponents)
                && hint.capacitors.every((designator) => selectedComponents.has(designator));
        case "cap_cluster":
            return (!hint.target || previewPinIsUsable(hint.target, selectedComponents))
                && hint.capacitors.every((designator) => selectedComponents.has(designator));
        case "critical_pair":
            return previewPinIsUsable(hint.source, selectedComponents)
                && previewPinIsUsable(hint.target, selectedComponents);
    }
}

function previewTargetIsUsable(target: TargetRef, selectedComponents: Set<string>, selectedBlocks: Set<string>) {
    if (target.type === "board_anchor") return true;
    if (target.type === "block") return selectedBlocks.has(target.block_name);
    return selectedComponents.has(target.designator);
}

function previewPinIsUsable(target: Extract<TargetRef, { type: "pin" }>, selectedComponents: Set<string>) {
    return selectedComponents.has(target.designator);
}

export async function buildPlacementInput(
    circuit: ExplainCircuit,
    rules: PlacementRules,
    footprints?: Readonly<Record<string, FootprintSpec>>,
): Promise<PlacementInput> {
    const componentRules = new Map(rules.component_rules.map((rule) => [rule.designator, rule]));
    const footprintCache = new Map<string, Promise<FootprintSpec | null>>();
    const circuitWithBoardPads = {
        ...circuit,
        components: [...circuit.components, ...syntheticCircuitComponents(rules)],
    };
    const boardPadByName = new Map((rules.boardPads ?? []).map((rule) => [rule.name, rule]));
    const proceduralByName = new Map((rules.proceduralFeatures ?? [])
        .filter((feature) => feature.kind === "solder_jumper" || feature.kind === "antenna")
        .map((feature) => [feature.name, feature]));
    const blocks = normalizeBlocks(circuitWithBoardPads, rules.blocks, rules.component_rules);
    const modules = normalizeModules(rules.modules ?? [], blocks);
    const blockByDesignator = new Map<string, string>();
    for (const block of blocks) {
        for (const designator of block.component_designators) {
            blockByDesignator.set(designator, block.name);
        }
    }
    const boardLayers = boardAllowedLayers(rules.board);

    const components: PcbComponent[] = await Promise.all(circuitWithBoardPads.components.map(async (component) => {
        const rule = componentRules.get(component.designator);
        const procedural = proceduralByName.get(component.designator);
        const compiledProcedural = procedural?.kind === "solder_jumper"
            ? compileSolderJumper(procedural)
            : procedural?.kind === "antenna"
                ? compileAntenna(procedural)
                : null;
        const footprint = compiledProcedural?.footprint
            ?? normalizeFootprintSpec(rule?.footprint)
            ?? await requireResolvedComponentFootprint(component, footprintCache, footprints);
        const baseAllowedRotations = rule?.allowedRotations ?? [0, 90, 180, 270];
        const edgeMount = normalizeEdgeMountRule(rule?.edgeMount);
        const edgePlace = normalizeEdgePlaceRule(rule?.edgePlace);
        const faceConstraint = applyFaceToRotationConstraint({
            designator: component.designator,
            footprint,
            allowedRotations: baseAllowedRotations,
            faceAt0: normalizeFaceDirection(rule?.mechanicalFaceAt0),
            faceTo: normalizeFaceDirection(rule?.faceTo),
            fixedRotate: rule?.fixedPlacement?.rotate ?? undefined,
        });
        return {
            designator: component.designator,
            value: component.value,
            pins: component.pins,
            block_name: rule?.block_name ?? blockByDesignator.get(component.designator) ?? "Main",
            search_query: `${component.value} ${footprint.name}`,
            part_uuid: component.part_uuid ?? null,
            footprint_uuid: component.footprint_uuid ?? null,
            footprint,
            pcb: {
                role: rule?.role ?? inferComponentRole(component.designator, component.value),
                allowedLayers: rule?.allowedLayers ?? (edgePlace?.layer ? [edgePlace.layer] : boardLayers.allowedLayers),
                allowedRotations: faceConstraint.allowedRotations,
                fixedPlacement: normalizeFixedPlacement(rule?.fixedPlacement),
                boardOverflow: normalizeBoardOverflow(rule?.boardOverflow),
                edgeMount,
                edgePlace,
                mechanicalFaceAt0: faceConstraint.faceAt0,
                mechanicalFaceAt0Source: faceConstraint.source,
                faceTo: faceConstraint.faceTo,
                faceWarning: faceConstraint.warning,
                designatorText: normalizeDesignatorTextOptions(rule?.designatorText),
                syntheticBoardPad: normalizeSyntheticBoardPad(boardPadByName.get(component.designator)),
                syntheticFootprint: compiledProcedural?.geometry,
            },
        };
    }));
    const augmentedComponents = applyThermalPadAugmentations(components, rules.proceduralFeatures ?? []);
    const paths = normalizeSignalPaths(rules.paths ?? [], augmentedComponents);
    const refineGroups = normalizeRefineGroups(rules.refineGroups ?? []);
    const hints = stripNulls([
        ...rules.hints,
        ...signalPathHints(paths),
    ]) as PlacementHint[];
    const board = createBoard(rules.board, augmentedComponents);
    const boardHoles = resolveBoardHoles(rules.boardHoles ?? [], board);
    const constraintRegions = resolveConstraintRegions(rules.constraintRegions ?? [], board);
    const mountedComponents = augmentedComponents.map((component) => {
        const rule = componentRules.get(component.designator);
        return applyEdgePlacePlacement(applyEdgeMountPlacement(component, rule, board), rule, board);
    });

    return {
        board,
        boardHoles,
        constraintRegions,
        silkscreen: {
            designators: normalizeDesignatorTextOptions(rules.silkscreen?.designators) ?? {},
        },
        blocks,
        modules,
        components: mountedComponents,
        hints,
        paths,
        refineGroups,
        solverOptions: mergeSolverOptions(rules.solverOptions ?? undefined),
    };
}

function collectRefineGroupErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const componentNames = new Set([...circuit.components, ...syntheticCircuitComponents(rules)].map((component) => component.designator));
    const ownerByDesignator = new Map<string, string>();
    const errors: string[] = [];
    for (const group of rules.refineGroups ?? []) {
        const label = `refineGroup("${group.name}")`;
        for (const designator of group.component_designators) {
            if (!componentNames.has(designator)) errors.push(`${label} references unknown component "${designator}".`);
            const previous = ownerByDesignator.get(designator);
            if (previous) errors.push(`${label} overlaps refineGroup("${previous}") at component "${designator}".`);
            else ownerByDesignator.set(designator, group.name);
        }
    }
    return errors.map((error) => `- ${error}`);
}

function normalizeRefineGroups(groups: RefineGroupRule[]): PlacementRefineGroup[] {
    return groups.map((group) => ({
        name: group.name,
        componentDesignators: [...group.component_designators],
        swap: group.swap,
        rotateBy: [...group.rotateBy],
    }));
}

function collectSignalPathErrors(circuit: ExplainCircuit, rules: PlacementRules) {
    const components = [...circuit.components, ...syntheticCircuitComponents(rules)];
    const componentByDesignator = new Map(components.map((component) => [component.designator, component]));
    const seenIds = new Set<string>();
    const errors: string[] = [];

    for (const path of rules.paths ?? []) {
        const label = `signalPath("${path.id}")`;
        if (!path.id) errors.push(`${label} requires a non-empty name.`);
        if (seenIds.has(path.id)) errors.push(`${label} is defined more than once.`);
        seenIds.add(path.id);
        if (path.segments.length === 0) errors.push(`${label} requires at least one segment.`);

        for (let index = 0; index < path.segments.length; index += 1) {
            const segment = path.segments[index];
            const source = resolveCircuitPin(componentByDesignator, segment.source);
            const target = resolveCircuitPin(componentByDesignator, segment.target);
            if (!source) errors.push(`${label} segment ${index}: source pin ${formatPinTarget(segment.source)} does not exist.`);
            if (!target) errors.push(`${label} segment ${index}: target pin ${formatPinTarget(segment.target)} does not exist.`);
            if (source && target && source.signal_name !== target.signal_name) {
                errors.push(`${label} segment ${index}: ${formatPinTarget(segment.source)} is net "${source.signal_name}", but ${formatPinTarget(segment.target)} is net "${target.signal_name}".`);
            }
            if (index === 0) continue;
            const previous = path.segments[index - 1];
            if (previous.target.designator !== segment.source.designator) {
                errors.push(`${label} is discontinuous between segments ${index - 1} and ${index}: expected a stage on ${previous.target.designator}, got ${segment.source.designator}.`);
            } else if (String(previous.target.pin_number) === String(segment.source.pin_number)) {
                errors.push(`${label} stage ${segment.source.designator} must use different entry and exit pins.`);
            }
        }
    }
    return errors.map((error) => `- ${error}`);
}

function resolveCircuitPin(
    componentByDesignator: Map<string, ExplainCircuit["components"][number]>,
    target: Extract<TargetRef, { type: "pin" }>,
) {
    return componentByDesignator.get(target.designator)?.pins.find((pin) => String(pin.pin_number) === String(target.pin_number));
}

function formatPinTarget(target: Extract<TargetRef, { type: "pin" }>) {
    return `${target.designator}.${String(target.pin_number)}`;
}

function normalizeSignalPaths(paths: SignalPathRule[], components: PcbComponent[]): PlacementSignalPath[] {
    const componentByDesignator = new Map(components.map((component) => [component.designator, component]));
    return paths.map((path) => {
        const segments = path.segments.map((segment, index) => ({
            index,
            source: { ...segment.source },
            target: { ...segment.target },
            priority: segment.priority,
            ...(typeof segment.maxDistance === "number" ? { maxDistance: segment.maxDistance } : {}),
            ...(typeof segment.minDistance === "number" ? { minDistance: segment.minDistance } : {}),
            ...(typeof segment.weightMultiplier === "number" ? { weightMultiplier: segment.weightMultiplier } : {}),
            ...(typeof segment.hard === "boolean" ? { hard: segment.hard } : {}),
            ...(typeof segment.crossingPenalty === "number" ? { crossingPenalty: segment.crossingPenalty } : {}),
            ...(typeof segment.preferFacingPads === "boolean" ? { preferFacingPads: segment.preferFacingPads } : {}),
        }));
        const stages = segments.slice(1).map((segment, index) => ({
            index,
            designator: segment.source.designator,
            entryPin: segments[index].target.pin_number,
            exitPin: segment.source.pin_number,
            blockName: componentByDesignator.get(segment.source.designator)?.block_name ?? "Main",
        }));
        return {
            id: path.id,
            priority: path.priority,
            shape: path.shape,
            preferFacingPads: path.preferFacingPads,
            segments,
            stages,
            terminals: {
                first: { ...segments[0].source },
                last: { ...segments[segments.length - 1].target },
            },
        };
    });
}

function signalPathHints(paths: PlacementSignalPath[]): PlacementHint[] {
    return paths.flatMap((path) => path.segments.map((segment) => ({
        relation: "critical_pair" as const,
        source: { ...segment.source },
        target: { ...segment.target },
        priority: segment.priority,
        maxDistance: segment.maxDistance,
        minDistance: segment.minDistance,
        weightMultiplier: segment.weightMultiplier,
        hard: segment.hard,
        crossingPenalty: segment.crossingPenalty,
        preferFacingPads: segment.preferFacingPads ?? path.preferFacingPads,
        core: false,
        path: {
            id: path.id,
            segmentIndex: segment.index,
            segmentCount: path.segments.length,
            shape: path.shape,
        },
    })));
}

function applyThermalPadAugmentations(components: PcbComponent[], features: ProceduralFeatureRule[]) {
    const result = components.map((component) => ({
        ...component,
        footprint: { ...component.footprint, pads: component.footprint.pads.map((pad) => ({ ...pad })) },
        pcb: { ...component.pcb, generatedGeometry: [...(component.pcb.generatedGeometry ?? [])] },
    }));
    const byDesignator = new Map(result.map((component) => [component.designator, component]));
    for (const feature of features) {
        if (feature.kind !== "thermal_pad") continue;
        const component = byDesignator.get(feature.at.designator);
        if (!component) throw new Error(`primitive.thermalPad("${feature.name}") references unknown component ${feature.at.designator}.`);
        const compiled = compileThermalPad(feature, component);
        component.footprint = compiled.footprint;
        component.pins = [...component.pins, ...compiled.pins];
        component.pcb.generatedGeometry = [...(component.pcb.generatedGeometry ?? []), compiled.geometry];
    }
    return result;
}

function boardPadCircuitComponents(rules: BoardPadRule[]): ExplainCircuit["components"] {
    return rules.map((rule) => ({
        designator: rule.name,
        value: "board_pad",
        pins: boardPadCells(rule).map((pad) => ({
            pin_number: pad.pin_number,
            name: pad.name,
            signal_name: pad.net,
        })),
        part_uuid: null,
        footprint_name: `BOARD_PAD_${rule.name}`,
        footprint_uuid: null,
    }));
}

function proceduralCircuitComponents(rules: ProceduralFeatureRule[]): ExplainCircuit["components"] {
    return rules.flatMap((rule) => {
        if (rule.kind === "thermal_pad") return [];
        const compiled = rule.kind === "solder_jumper" ? compileSolderJumper(rule) : compileAntenna(rule);
        return [{
            designator: rule.name,
            value: rule.kind,
            pins: compiled.pins,
            part_uuid: null,
            footprint_name: compiled.footprint.name,
            footprint_uuid: null,
        }];
    });
}

function syntheticCircuitComponents(rules: PlacementRules): ExplainCircuit["components"] {
    return [
        ...boardPadCircuitComponents(rules.boardPads ?? []),
        ...proceduralCircuitComponents(rules.proceduralFeatures ?? []),
    ];
}

function normalizeSyntheticBoardPad(rule: BoardPadRule | undefined): PcbSyntheticBoardPad | undefined {
    if (!rule) return undefined;
    return {
        name: rule.name,
        layer: rule.layer as BoardPadLayer,
        pads: boardPadCells(rule),
    };
}

function boardPadCells(rule: BoardPadRule): PcbSyntheticBoardPad["pads"] {
    const rows = rule.pads.length;
    const columns = Math.max(...rule.pads.map((row) => row.length));
    const raw: PcbSyntheticBoardPadCell[] = rule.pads.flatMap((row, rowIndex) => row.map((pad, columnIndex) => {
        const pin_number = String(rule.pads.slice(0, rowIndex).reduce((sum, current) => sum + current.length, 0) + columnIndex + 1);
        const base = {
            pin_number,
            name: pad.name,
            net: pad.net,
            x: columnIndex * rule.pitch,
            y: rowIndex * rule.rowPitch,
            shape: pad.shape,
        };
        const hole = normalizeSyntheticBoardPadHole(pad.hole);
        return pad.shape === "round"
            ? { ...base, shape: "round", diameter: pad.diameter, ...(hole ? { hole } : {}) }
            : { ...base, shape: pad.shape, width: pad.width, height: pad.height, ...(hole ? { hole } : {}) };
    }));
    const boxes = raw.map((pad) => ({
        left: pad.x - boardPadCellWidth(pad) / 2,
        right: pad.x + boardPadCellWidth(pad) / 2,
        top: pad.y - boardPadCellHeight(pad) / 2,
        bottom: pad.y + boardPadCellHeight(pad) / 2,
    }));
    const left = Math.min(...boxes.map((box) => box.left), 0);
    const right = Math.max(...boxes.map((box) => box.right), (columns - 1) * rule.pitch);
    const top = Math.min(...boxes.map((box) => box.top), 0);
    const bottom = Math.max(...boxes.map((box) => box.bottom), (rows - 1) * rule.rowPitch);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    return raw.map((pad) => ({
        ...pad,
        x: roundForMessage(pad.x - centerX),
        y: roundForMessage(pad.y - centerY),
    }));
}

function normalizeSyntheticBoardPadHole(
    hole: BoardPadRule["pads"][number][number]["hole"] | undefined,
): PcbSyntheticBoardPadHole | undefined {
    if (!hole) return undefined;
    const x = hole.offset?.x;
    const y = hole.offset?.y;
    return {
        diameter: hole.diameter,
        ...(typeof x === "number" || typeof y === "number"
            ? { offset: { x: x ?? 0, y: y ?? 0 } }
            : {}),
    };
}

function boardPadCellWidth(pad: PcbSyntheticBoardPadCell) {
    return pad.shape === "round" ? pad.diameter ?? 0 : pad.width ?? 0;
}

function boardPadCellHeight(pad: PcbSyntheticBoardPadCell) {
    return pad.shape === "round" ? pad.diameter ?? 0 : pad.height ?? 0;
}

export function resolveConstraintRegions(rules: ConstraintRegionRule[], board: PlacementInput["board"]): PcbConstraintRegion[] {
    return rules.map((rule) => ({
        name: rule.name,
        box: resolveConstraintRegionRect(rule.shape, board),
        layers: rule.layers?.length ? [...new Set(rule.layers)] : [...board.allowedLayers],
        allowBlocks: [...new Set(rule.allow.blocks.filter((block) => typeof block === "string" && block.length > 0))],
    }));
}

function resolveConstraintRegionRect(shape: ConstraintRegionRule["shape"], board: PlacementInput["board"]) {
    const width = Math.max(0, shape.width);
    const height = Math.max(0, shape.height);
    const anchorPoint = boardAnchorPoint(board, shape.anchor.anchor);
    const offset = shape.offset ?? { x: 0, y: 0 };
    const dx = offset.x ?? 0;
    const dy = offset.y ?? 0;
    const anchor = shape.anchor.anchor;

    const left = anchorHasLeft(anchor)
        ? anchorPoint.x
        : anchorHasRight(anchor)
            ? anchorPoint.x - width
            : anchorPoint.x - width / 2;
    const top = anchorHasTop(anchor)
        ? anchorPoint.y
        : anchorHasBottom(anchor)
            ? anchorPoint.y - height
            : anchorPoint.y - height / 2;

    return {
        left: roundForMessage(left + dx),
        right: roundForMessage(left + width + dx),
        top: roundForMessage(top + dy),
        bottom: roundForMessage(top + height + dy),
    };
}

function anchorHasLeft(anchor: string) {
    return anchor === "board.left" || anchor.endsWith("_left");
}

function anchorHasRight(anchor: string) {
    return anchor === "board.right" || anchor.endsWith("_right");
}

function anchorHasTop(anchor: string) {
    return anchor === "board.top" || anchor.includes("top_");
}

function anchorHasBottom(anchor: string) {
    return anchor === "board.bottom" || anchor.includes("bottom_");
}

export function resolveBoardHoles(rules: BoardHoleRule[], board: PlacementInput["board"]): BoardHole[] {
    return rules.map((rule) => {
        const anchorPoint = rule.outlineCorner
            ? outlineInsetPointFromCorner(board, boardCornerAnchor(rule.outlineCorner), rule.inset ?? 0)
            : boardAnchorPoint(board, rule.at.anchor);
        const offset = rule.offset ?? { x: 0, y: 0 };
        const drill = rule.drill;
        const diameter = rule.diameter ?? drill;
        const keepout = rule.keepout ?? Math.max(diameter, drill) / 2;
        return {
            name: rule.name,
            x: roundForMessage(anchorPoint.x + (offset.x ?? 0)),
            y: roundForMessage(anchorPoint.y + (offset.y ?? 0)),
            drill,
            diameter,
            keepout,
        };
    });
}

export function createBoard(boardRule: Board, components: PcbComponent[]) {
    const board = boardFromRule(boardRule, components);

    board.clearances.component = boardRule.componentClearance ?? board.clearances.component;
    board.clearances.edge = boardRule.edgeClearance ?? board.clearances.edge;
    board.allowedLayers = boardRule.allowedLayers ?? board.allowedLayers;
    board.defaultLayer = boardRule.defaultLayer ?? board.defaultLayer;
    return board;
}

function boardFromRule(boardRule: Board, components: PcbComponent[]): CenteredRectBoard {
    if (boardRule.type === "auto") {
        return centeredBoard(...autoBoardSize(boardRule, components));
    }
    if (boardRule.type === "rect") {
        return centeredBoard(boardRule.width, boardRule.height);
    }

    const points = boardPolygonFromRule(boardRule);
    const box = pointsBox(points);
    const width = roundForMessage(box.right - box.left);
    const height = roundForMessage(box.bottom - box.top);
    const centeredPoints = points.map((point) => ({
        x: roundForMessage(point.x - (box.left + box.right) / 2),
        y: roundForMessage(point.y - (box.top + box.bottom) / 2),
    }));
    const board = centeredBoard(width, height);
    board.outline = {
        type: "polygon",
        width,
        height,
        points: centeredPoints,
    };
    return board;
}

function boardPolygonFromRule(boardRule: Exclude<Board, { type: "auto" | "rect" }>) {
    if (boardRule.type === "polygon") return boardRule.points;
    if (boardRule.type === "roundedRect") {
        return roundedRectPolygon(boardRule.width, boardRule.height, boardRule.radius ?? Math.min(boardRule.width, boardRule.height) * 0.08, boardRule.segments ?? 6);
    }
    if (boardRule.type === "chamferedRect") {
        return chamferedRectPolygon(boardRule.width, boardRule.height, boardRule.chamfer ?? Math.min(boardRule.width, boardRule.height) * 0.08);
    }
    if (boardRule.type === "notchedRect") {
        return notchedRectPolygon(boardRule.width, boardRule.height, boardRule.side ?? "top", boardRule.notchWidth, boardRule.notchDepth, boardRule.offset ?? 0);
    }
    if (boardRule.type === "circle") {
        return ovalPolygon(boardRule.diameter, boardRule.diameter, boardRule.segments ?? 48);
    }
    if (boardRule.type === "oval") {
        return ovalPolygon(boardRule.width, boardRule.height, boardRule.segments ?? 48);
    }
    if (boardRule.type === "L") {
        return lShapePolygon(boardRule.width, boardRule.height, boardRule.cutoutWidth, boardRule.cutoutHeight, boardRule.corner ?? "top_right");
    }
    return inverseLPolygon(boardRule.width, boardRule.height, boardRule.legWidth, boardRule.legHeight, boardRule.corner ?? "bottom_left");
}

function roundedRectPolygon(width: number, height: number, radius: number, segments: number) {
    const clampedRadius = clamp(radius, 0, Math.min(width, height) / 2);
    if (clampedRadius <= 0) return rectBoardPolygon(width, height);
    const cornerSegments = Math.max(2, Math.min(16, Math.floor(segments)));
    const corners = [
        { cx: width / 2 - clampedRadius, cy: -height / 2 + clampedRadius, start: -90, end: 0 },
        { cx: width / 2 - clampedRadius, cy: height / 2 - clampedRadius, start: 0, end: 90 },
        { cx: -width / 2 + clampedRadius, cy: height / 2 - clampedRadius, start: 90, end: 180 },
        { cx: -width / 2 + clampedRadius, cy: -height / 2 + clampedRadius, start: 180, end: 270 },
    ];
    return corners.flatMap((corner) => Array.from({ length: cornerSegments + 1 }, (_, index) => {
        const angle = (corner.start + (corner.end - corner.start) * index / cornerSegments) * Math.PI / 180;
        return {
            x: corner.cx + Math.cos(angle) * clampedRadius,
            y: corner.cy + Math.sin(angle) * clampedRadius,
        };
    }));
}

function chamferedRectPolygon(width: number, height: number, chamfer: number) {
    const value = clamp(chamfer, 0, Math.min(width, height) / 2);
    if (value <= 0) return rectBoardPolygon(width, height);
    const left = -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;
    return [
        { x: left + value, y: top },
        { x: right - value, y: top },
        { x: right, y: top + value },
        { x: right, y: bottom - value },
        { x: right - value, y: bottom },
        { x: left + value, y: bottom },
        { x: left, y: bottom - value },
        { x: left, y: top + value },
    ];
}

function notchedRectPolygon(width: number, height: number, side: "left" | "right" | "top" | "bottom", notchWidth: number, notchDepth: number, offset: number) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const notchHalf = Math.max(0, notchWidth) / 2;
    const depth = Math.max(0, notchDepth);
    if (side === "top") {
        const cx = clamp(offset, -halfWidth + notchHalf, halfWidth - notchHalf);
        return [
            { x: -halfWidth, y: -halfHeight },
            { x: cx - notchHalf, y: -halfHeight },
            { x: cx - notchHalf, y: -halfHeight + depth },
            { x: cx + notchHalf, y: -halfHeight + depth },
            { x: cx + notchHalf, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: -halfWidth, y: halfHeight },
        ];
    }
    if (side === "bottom") {
        const cx = clamp(offset, -halfWidth + notchHalf, halfWidth - notchHalf);
        return [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: cx + notchHalf, y: halfHeight },
            { x: cx + notchHalf, y: halfHeight - depth },
            { x: cx - notchHalf, y: halfHeight - depth },
            { x: cx - notchHalf, y: halfHeight },
            { x: -halfWidth, y: halfHeight },
        ];
    }
    const cy = clamp(offset, -halfHeight + notchHalf, halfHeight - notchHalf);
    if (side === "left") {
        return [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: -halfWidth, y: halfHeight },
            { x: -halfWidth, y: cy + notchHalf },
            { x: -halfWidth + depth, y: cy + notchHalf },
            { x: -halfWidth + depth, y: cy - notchHalf },
            { x: -halfWidth, y: cy - notchHalf },
        ];
    }
    return [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: cy - notchHalf },
        { x: halfWidth - depth, y: cy - notchHalf },
        { x: halfWidth - depth, y: cy + notchHalf },
        { x: halfWidth, y: cy + notchHalf },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight },
    ];
}

function ovalPolygon(width: number, height: number, segments: number) {
    const count = Math.max(12, Math.min(96, Math.floor(segments)));
    return Array.from({ length: count }, (_, index) => {
        const angle = index * 2 * Math.PI / count;
        return {
            x: Math.cos(angle) * width / 2,
            y: Math.sin(angle) * height / 2,
        };
    });
}

function lShapePolygon(width: number, height: number, cutoutWidth: number, cutoutHeight: number, corner: "top_left" | "top_right" | "bottom_right" | "bottom_left") {
    const left = -width / 2;
    const right = width / 2;
    const top = -height / 2;
    const bottom = height / 2;
    const cw = clamp(cutoutWidth, 0, width);
    const ch = clamp(cutoutHeight, 0, height);
    if (corner === "top_left") return [{ x: left + cw, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }, { x: left, y: top + ch }, { x: left + cw, y: top + ch }];
    if (corner === "top_right") return [{ x: left, y: top }, { x: right - cw, y: top }, { x: right - cw, y: top + ch }, { x: right, y: top + ch }, { x: right, y: bottom }, { x: left, y: bottom }];
    if (corner === "bottom_right") return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom - ch }, { x: right - cw, y: bottom - ch }, { x: right - cw, y: bottom }, { x: left, y: bottom }];
    return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left + cw, y: bottom }, { x: left + cw, y: bottom - ch }, { x: left, y: bottom - ch }];
}

function inverseLPolygon(width: number, height: number, legWidth: number, legHeight: number, corner: "top_left" | "top_right" | "bottom_right" | "bottom_left") {
    return lShapePolygon(width, height, Math.max(0, width - legWidth), Math.max(0, height - legHeight), corner);
}

function boardCornerAnchor(corner: "top_left" | "top_right" | "bottom_right" | "bottom_left") {
    return `board.${corner}` as Exclude<Extract<TargetRef, { type: "board_anchor" }>["anchor"], "board.center" | "board.left" | "board.right" | "board.top" | "board.bottom">;
}

export function autoBoardSize(
    boardRule: Extract<Board, { type: "auto" }>,
    components: PcbComponent[],
): [number, number] {
    const componentClearance = boardRule.componentClearance ?? 0.35;
    const edgeClearance = boardRule.edgeClearance ?? 0.8;
    const aspectRatio = clamp(boardRule.aspectRatio ?? 1.45, 0.5, 2.5);
    const componentDensity = clamp(boardRule.componentDensity ?? DEFAULT_COMPONENT_DENSITY, 0.1, 0.85);
    const totalFootprintArea = components.reduce((sum, component) => sum + component.footprint.width * component.footprint.height, 0);
    const largestWidth = Math.max(...components.map((component) => component.footprint.width), 1);
    const largestHeight = Math.max(...components.map((component) => component.footprint.height), 1);
    const requiredWidth = largestWidth + componentClearance * 2 + edgeClearance * 2;
    const requiredHeight = largestHeight + componentClearance * 2 + edgeClearance * 2;
    const targetArea = Math.max(totalFootprintArea / componentDensity, requiredWidth * requiredHeight, 25);

    let width = Math.sqrt(targetArea * aspectRatio);
    let height = Math.sqrt(targetArea / aspectRatio);
    width = Math.max(width, requiredWidth, boardRule.minWidth ?? 0);
    height = Math.max(height, requiredHeight, boardRule.minHeight ?? 0);

    if (boardRule.maxWidth !== null && boardRule.maxWidth < requiredWidth) {
        throw new Error(`board.auto.maxWidth ${boardRule.maxWidth}mm is smaller than the largest footprint requirement ${roundForMessage(requiredWidth)}mm`);
    }
    if (boardRule.maxHeight !== null && boardRule.maxHeight < requiredHeight) {
        throw new Error(`board.auto.maxHeight ${boardRule.maxHeight}mm is smaller than the largest footprint requirement ${roundForMessage(requiredHeight)}mm`);
    }

    width = boardRule.maxWidth === null ? width : Math.min(width, boardRule.maxWidth);
    height = boardRule.maxHeight === null ? height : Math.min(height, boardRule.maxHeight);
    return [roundForMessage(width), roundForMessage(height)];
}

export function boardAllowedLayers(boardRule: Board) {
    return {
        allowedLayers: boardRule.allowedLayers ?? ["top" as const],
        defaultLayer: boardRule.defaultLayer ?? "top" as const,
    };
}

export function normalizeBlocks(circuit: ExplainCircuit, blocks: Block[], componentRules: ComponentRule[] = []): PcbBlock[] {
    if (blocks.length > 0) {
        const canonicalDesignators = new Map(canonicalBlockDesignators(blocks, componentRules).map((block) => [block.name, block.designators]));
        return blocks.map((block) => ({
            name: block.name,
            description: block.description ?? block.name,
            component_designators: canonicalDesignators.get(block.name) ?? block.component_designators,
            role: block.role ?? "generic",
            placement: block.placement ?? undefined,
            attachTo: block.attachTo ?? undefined,
            anchor: block.anchor ?? undefined,
            anchorOffset: normalizePointOffset(block.anchorOffset),
            sidePreference: block.sidePreference ?? undefined,
            maxBboxScale: block.maxBboxScale ?? undefined,
            maxBboxWidth: block.maxBboxWidth ?? undefined,
            maxBboxHeight: block.maxBboxHeight ?? undefined,
            hardBbox: block.hardBbox ?? undefined,
            maxAnchorGap: block.maxAnchorGap ?? undefined,
            hardAnchor: block.hardAnchor ?? undefined,
            familyMaxBboxScale: block.familyMaxBboxScale ?? undefined,
            familyMaxWidth: block.familyMaxWidth ?? undefined,
            familyMaxHeight: block.familyMaxHeight ?? undefined,
            familyHard: block.familyHard ?? undefined,
            placementClearance: block.placementClearance ?? undefined,
            allowDisconnected: block.allowDisconnected ?? undefined,
        }));
    }

    return [{
        name: "Main",
        description: "Main circuit",
        component_designators: circuit.components.map((component) => component.designator),
        role: "generic" as const,
    }];
}

function canonicalBlockDesignators(blocks: Block[], componentRules: ComponentRule[]) {
    const designatorsByBlock = new Map<string, Set<string>>();
    for (const block of blocks) {
        designatorsByBlock.set(block.name, new Set(block.component_designators));
    }
    for (const rule of componentRules) {
        if (!rule.block_name || !designatorsByBlock.has(rule.block_name)) continue;
        designatorsByBlock.get(rule.block_name)!.add(rule.designator);
    }
    return blocks.map((block) => ({
        name: block.name,
        designators: [...(designatorsByBlock.get(block.name) ?? new Set<string>())],
    }));
}

function normalizePointOffset(offset?: { x?: number | null; y?: number | null } | null) {
    if (!offset) return undefined;
    const x = offset.x ?? 0;
    const y = offset.y ?? 0;
    if (x === 0 && y === 0) return undefined;
    return { x, y };
}

export function normalizeModules(modules: Module[], blocks: PcbBlock[]): PcbModule[] {
    const blockNames = new Set(blocks.map((block) => block.name));
    return modules.flatMap((moduleRule) => {
        const block_names = moduleRule.block_names.filter((name) => blockNames.has(name));
        if (block_names.length === 0) return [];
        return [{
            name: moduleRule.name,
            block_names,
            anchor: moduleRule.anchor ?? undefined,
            sidePreference: moduleRule.sidePreference ?? undefined,
            maxBboxScale: moduleRule.maxBboxScale ?? undefined,
            maxWidth: moduleRule.maxWidth ?? undefined,
            maxHeight: moduleRule.maxHeight ?? undefined,
            hardBbox: moduleRule.hardBbox ?? undefined,
            lockInternalAfterPlace: moduleRule.lockInternalAfterPlace ?? true,
            allowInternalRefine: moduleRule.allowInternalRefine ?? false,
            placementPriority: moduleRule.placementPriority ?? undefined,
        }];
    });
}

function normalizeDesignatorTextOptions(options?: {
    enabled?: boolean | null;
    height?: number | null;
    rotations?: number[] | null;
    margin?: number | null;
} | null): PcbDesignatorTextOptions | undefined {
    if (!options) return undefined;
    return {
        ...(options.enabled !== null && options.enabled !== undefined ? { enabled: options.enabled } : {}),
        ...(options.height !== null && options.height !== undefined ? { height: options.height } : {}),
        ...(options.rotations?.length ? { rotations: options.rotations } : {}),
        ...(options.margin !== null && options.margin !== undefined ? { margin: options.margin } : {}),
    };
}

export function mergeSolverOptions(options?: SolverOptions): RemoveNull<SolverOptions> {
    return {
        candidateRadii: options?.candidateRadii ?? defaultSolverOptions.candidateRadii,
        candidateAngles: options?.candidateAngles ?? defaultSolverOptions.candidateAngles,
        fallbackGridStep: options?.fallbackGridStep ?? defaultSolverOptions.fallbackGridStep,
        placementGridStep: options?.placementGridStep ?? defaultSolverOptions.placementGridStep,
        ignoredRatsnestSignals: options?.ignoredRatsnestSignals ?? defaultSolverOptions.ignoredRatsnestSignals,
        localImproveIterations: options?.localImproveIterations ?? defaultSolverOptions.localImproveIterations,
        localImproveMinDelta: options?.localImproveMinDelta ?? defaultSolverOptions.localImproveMinDelta,
        hierarchicalBlocks: options?.hierarchicalBlocks ?? defaultSolverOptions.hierarchicalBlocks,
        compactness: options?.compactness ?? defaultSolverOptions.compactness,
        preview: options?.preview ?? defaultSolverOptions.preview,
        placeOnlyComponents: options?.placeOnlyComponents ?? defaultSolverOptions.placeOnlyComponents,
        ignoreComponents: options?.ignoreComponents ?? defaultSolverOptions.ignoreComponents,
    };
}
