import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PcbLayout, Placement, PlacementInput, PlacementStage } from "#types/pcb/layout-model.ts";
import { renderPlacementSubsetSvg, renderPlacementSvg } from "#pcb-layout/pcb-auto-place/auto-place.ts";
import { canonicalModuleDesignators } from "#pcb-layout/pcb-auto-place/report-helpers.ts";

export type PlacementDebugArtifactType = "block" | "satellite" | "family" | "module";

export type PlacementDebugArtifact = {
    type: PlacementDebugArtifactType;
    name: string;
    components: string[];
    svg: string;
    fileName?: string;
    path?: string;
};

export type PlacementDebugArtifacts = {
    items: PlacementDebugArtifact[];
};

export function configuredOutputDir(config: unknown) {
    const configurable = (config as { configurable?: Record<string, unknown> } | undefined)?.configurable;
    const value = configurable?.pcbLayoutOutputDir
        ?? configurable?.pcb_layout_output_dir
        ?? configurable?.outputDir;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function writePlacementArtifacts(
    outputDir: string,
    placementInput: PlacementInput,
    placements: Placement[],
    report: unknown,
    layout: PcbLayout,
    stages: PlacementStage[] = [],
    placementSvg?: string,
    placementDebugArtifacts = createPlacementDebugArtifacts(placementInput, placements),
) {
    const dir = ensureOutputDir(outputDir);
    const placementSvgPath = resolve(dir, "placement.svg");
    const placementJsonPath = resolve(dir, "placement.json");
    const layoutJsonPath = resolve(dir, "layout.json");
    const stagesDir = resolve(dir, "stages");
    const blockDebugDir = resolve(dir, "blocks");

    writeFileSync(placementSvgPath, placementSvg ?? renderPlacementSvg(placementInput, placements), "utf-8");
    writeFileSync(placementJsonPath, JSON.stringify({ placements, report }, null, 2), "utf-8");
    writeFileSync(layoutJsonPath, JSON.stringify(layout, null, 2), "utf-8");
    writePlacementDebugArtifacts(blockDebugDir, placementDebugArtifacts);
    if (stages.length > 0) {
        mkdirSync(stagesDir, { recursive: true });
        for (const stage of stages) {
            writeFileSync(resolve(stagesDir, `${stage.name}.svg`), renderPlacementSvg(placementInput, stage.placements), "utf-8");
            writeFileSync(resolve(stagesDir, `${stage.name}.json`), JSON.stringify(stage, null, 2), "utf-8");
        }
    }

    return {
        placementSvgPath,
        placementJsonPath,
        layoutJsonPath,
        placementStagesDir: stages.length > 0 ? stagesDir : null,
        placementBlocksDir: blockDebugDir,
    };
}

export function ensureOutputDir(outputDir: string) {
    const dir = resolve(outputDir);
    mkdirSync(dir, { recursive: true });
    return dir;
}

export function normalizeArtifactRecord(artifacts: Record<string, string | null | undefined> | null | undefined): Record<string, string | null> {
    if (!artifacts) return {};
    return Object.fromEntries(Object.entries(artifacts).map(([key, value]) => [key, value ?? null]));
}

export function svgToDataUrl(svg: string) {
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

export function createPlacementDebugArtifacts(placementInput: PlacementInput, placements: Placement[]): PlacementDebugArtifacts {
    const placementByDesignator = new Map(placements.map((placement) => [placement.designator, placement]));
    const blockByName = new Map(placementInput.blocks.map((block) => [block.name, block]));
    const satellitesByParent = new Map<string, string[]>();

    for (const block of placementInput.blocks) {
        if (!block.attachTo) continue;
        const siblings = satellitesByParent.get(block.attachTo) ?? [];
        siblings.push(block.name);
        satellitesByParent.set(block.attachTo, siblings);
    }

    const items: PlacementDebugArtifact[] = [];
    for (const block of placementInput.blocks) {
        const blockPlacements = placementsForDesignators(block.component_designators, placementByDesignator);
        if (blockPlacements.length === 0) continue;

        items.push({
            type: "block",
            name: block.name,
            fileName: block.name,
            components: blockPlacements.map((item) => item.designator),
            svg: renderPlacementSubsetSvg(placementInput, blockPlacements, {
                title: `block ${block.name} (${block.role}${block.attachTo ? ` satellite of ${block.attachTo}` : " main"})`,
            }),
        });

        if (block.attachTo) {
            items.push({
                type: "satellite",
                name: block.name,
                fileName: `${block.name}__to__${block.attachTo}`,
                components: blockPlacements.map((item) => item.designator),
                svg: renderPlacementSubsetSvg(placementInput, blockPlacements, {
                    title: `satellite ${block.name} -> ${block.attachTo}`,
                }),
            });
        }
    }

    for (const [parentName, satelliteNames] of satellitesByParent) {
        const parent = blockByName.get(parentName);
        if (!parent) continue;
        const designators = new Set(parent.component_designators);
        for (const satelliteName of satelliteNames) {
            const satellite = blockByName.get(satelliteName);
            if (!satellite) continue;
            for (const designator of satellite.component_designators) designators.add(designator);
        }
        const familyPlacements = placementsForDesignators([...designators], placementByDesignator);
        if (familyPlacements.length === 0) continue;

        items.push({
            type: "family",
            name: parentName,
            fileName: `${parentName}__family`,
            components: familyPlacements.map((item) => item.designator),
            svg: renderPlacementSubsetSvg(placementInput, familyPlacements, {
                title: `family ${parentName} + satellites (${satelliteNames.join(", ")})`,
            }),
        });
    }

    for (const module of placementInput.modules ?? []) {
        const designators = [...canonicalModuleDesignators(placementInput, module)];
        const modulePlacements = placementsForDesignators(designators, placementByDesignator);
        if (modulePlacements.length === 0) continue;

        items.push({
            type: "module",
            name: module.name,
            fileName: module.name,
            components: modulePlacements.map((item) => item.designator),
            svg: renderPlacementSubsetSvg(placementInput, modulePlacements, {
                title: `module ${module.name} (${module.block_names.join(", ")})`,
            }),
        });
    }

    return { items };
}

export function writePlacementDebugArtifacts(outputDir: string, artifacts: PlacementDebugArtifacts) {
    const dirs: Record<PlacementDebugArtifactType, string> = {
        block: resolve(outputDir, "blocks"),
        satellite: resolve(outputDir, "satellites"),
        family: resolve(outputDir, "families"),
        module: resolve(outputDir, "modules"),
    };
    for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });

    const writtenItems = artifacts.items.map((item) => {
        const path = resolve(dirs[item.type], `${safeFileSegment(item.fileName ?? item.name)}.svg`);
        writeFileSync(path, item.svg, "utf-8");
        return {
            type: item.type,
            name: item.name,
            components: item.components,
            path,
        };
    });

    writeFileSync(resolve(outputDir, "index.json"), JSON.stringify(writtenItems, null, 2), "utf-8");
    return { items: writtenItems };
}

function placementsForDesignators(designators: string[], placementByDesignator: Map<string, Placement>) {
    return designators
        .map((designator) => placementByDesignator.get(designator))
        .filter((placement): placement is Placement => Boolean(placement));
}

function safeFileSegment(value: string) {
    return value.replace(/[^a-z0-9_.-]+/gi, "_").replace(/^_+|_+$/g, "") || "unnamed";
}
