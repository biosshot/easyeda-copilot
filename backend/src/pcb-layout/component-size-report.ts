import type { ExplainCircuit } from "#types/circuit.ts";
import type { FootprintSpec } from "#types/pcb/layout-model.ts";
import { roundForMessage } from "./common.ts";
import { requireResolvedComponentFootprint, resolveComponentFootprint } from "./footprints.ts";

export type ComponentSizeQuery = {
    designators?: string[] | null;
    includeAll?: boolean | null;
};

const DEFAULT_COMPONENT_DENSITY = 0.4;

export async function getComponentSizeReport(
    circuit: ExplainCircuit,
    query: ComponentSizeQuery,
    footprints?: Readonly<Record<string, FootprintSpec>>,
) {
    const selected = selectCircuitComponents(circuit, query);
    const footprintCache = new Map<string, ReturnType<typeof resolveComponentFootprint>>();
    const componentsRaw = await Promise.all(selected.map(async (component) => {
        const footprint = await requireResolvedComponentFootprint(component, footprintCache, footprints).catch(e => undefined);
        if (!footprint) return null;
        const area = footprint.width * footprint.height;
        return {
            designator: component.designator,
            value: component.value,
            footprint: footprint.name,
            width: roundForMessage(footprint.width),
            height: roundForMessage(footprint.height),
            area: roundForMessage(area),
            pins: component.pins.length,
        };
    }));
    const components = componentsRaw.flatMap(c => c ? [c] : []);
    const totalArea = components.reduce((sum, component) => sum + component.area, 0);
    const largestWidth = Math.max(0, ...components.map((component) => component.width));
    const largestHeight = Math.max(0, ...components.map((component) => component.height));
    const compactBoard = estimateCompactBoardSize(totalArea, largestWidth, largestHeight);

    return {
        selected: components.length,
        components,
        summary: {
            totalFootprintArea: roundForMessage(totalArea),
            largestWidth,
            largestHeight,
            compactBoard,
        },
    };
}

export function formatComponentSizeReport(report: Awaited<ReturnType<typeof getComponentSizeReport>>) {
    const groups = groupComponentSizes(report.components);
    return [
        `component_sizes`,
        `selected: ${report.selected}`,
        `total_footprint_area: ${report.summary.totalFootprintArea}mm^2`,
        `largest: ${report.summary.largestWidth}mm x ${report.summary.largestHeight}mm`,
        `compact_board_estimate: ${report.summary.compactBoard.width}mm x ${report.summary.compactBoard.height}mm`,
        `routing_factor: ${report.summary.compactBoard.routingFactor}`,
        `components:`,
        ...groups.map((group) =>
            `- ${group.designators.join(", ")}: ${group.width}mm x ${group.height}mm, area ${group.area}mm^2 each, ${group.footprint}, pins ${group.pins}, count ${group.designators.length}`,
        ),
    ].join("\n");
}

function selectCircuitComponents(circuit: ExplainCircuit, query: ComponentSizeQuery) {
    if (query.includeAll || (!query.designators?.length)) {
        return circuit.components;
    }

    const requested = new Set((query.designators ?? []).map((item) => item.toUpperCase()));
    return circuit.components.filter((component) => {
        if (requested.has(component.designator.toUpperCase())) return true;
        return false;
    });
}


function estimateCompactBoardSize(totalArea: number, largestWidth: number, largestHeight: number) {
    const routingFactor = roundForMessage(1 / DEFAULT_COMPONENT_DENSITY);
    const targetArea = Math.max(totalArea / DEFAULT_COMPONENT_DENSITY, (largestWidth + 4) * (largestHeight + 4), 25);
    const aspectRatio = 1.5;
    return {
        width: roundForMessage(Math.max(Math.sqrt(targetArea * aspectRatio), largestWidth + 4)),
        height: roundForMessage(Math.max(Math.sqrt(targetArea / aspectRatio), largestHeight + 4)),
        routingFactor,
    };
}

function groupComponentSizes(components: Awaited<ReturnType<typeof getComponentSizeReport>>["components"]) {
    const groups = new Map<string, {
        designators: string[];
        footprint: string;
        width: number;
        height: number;
        area: number;
        pins: number;
    }>();

    for (const component of components) {
        const key = [component.footprint, component.width, component.height, component.area, component.pins].join("|");
        const group = groups.get(key);
        if (group) {
            group.designators.push(component.designator);
            continue;
        }
        groups.set(key, {
            designators: [component.designator],
            footprint: component.footprint,
            width: component.width,
            height: component.height,
            area: component.area,
            pins: component.pins,
        });
    }

    return [...groups.values()]
        .map((group) => ({ ...group, designators: sortDesignators(group.designators) }))
        .sort((a, b) => b.designators.length - a.designators.length || naturalCompare(a.designators[0] ?? "", b.designators[0] ?? ""));
}

function sortDesignators(designators: string[]) {
    return designators.slice().sort(naturalCompare);
}

function naturalCompare(a: string, b: string) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
