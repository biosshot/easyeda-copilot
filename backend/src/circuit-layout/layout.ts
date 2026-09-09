import ELK from 'elkjs';
import type { ElkNode, ElkExtendedEdge } from 'elkjs';
import type { ShortSymbol } from "#types/symbol.ts";
import type { BlockNode, Hooks } from "#types/auto-place.ts";
import type { DeepReadonly } from '#types/utils.ts';
import { BASELINE_LAYOUT_PROFILE, type SchematicLayoutProfile } from './profiles.ts';
import { terminalAwareEdges, canonicalGraph } from './graph-order.ts';

export function applyProfileToLocalBlocks(graph: ElkNode, profile: SchematicLayoutProfile, includeDirectRoot = false) {
    if (profile.name === BASELINE_LAYOUT_PROFILE.name) return;

    const virtualRoot = graph.children?.find(node => node.id === 'block___v_root__');
    const blocks = includeDirectRoot && virtualRoot?.children?.some(node => !node.children?.length && 'center' in node)
        ? [virtualRoot] : virtualRoot?.children ?? [];
    for (const block of blocks) {
        if (!block.children?.length) continue;
        block.layoutOptions = {
            ...profile.options,
            ...block.layoutOptions,
        };
    }
}


export async function layout(
    elkNodes: DeepReadonly<BlockNode[]>,
    signalMap: DeepReadonly<Record<string, { nodeId: string; portId: string, blockName: string }[]>>,
    hooks?: Hooks,
    profile: SchematicLayoutProfile = BASELINE_LAYOUT_PROFILE,
    includeDirectRoot = false,
) {

    const elk = new ELK();

    const collectShortSymbols = (block: DeepReadonly<BlockNode>): ShortSymbol[] => {
        const a = Object.values(block.shortSymbols ?? {}).flat() as ShortSymbol[];
        const b = block.children?.flatMap?.(b => collectShortSymbols(b)) ?? [];
        return [...a, ...b]
    };

    const addedSymbol = elkNodes.flatMap(block => collectShortSymbols(block)).map(s => s.component);

    // Create edges from signal connections
    const elkEdges: ElkExtendedEdge[] = [];
    let edgeId = 0;

    for (const [signalName, endpoints] of Object.entries(signalMap)) {
        if (!signalName || signalName.toUpperCase() == 'NC') {
            continue;
        }
        if (endpoints.length < 2) continue;

        const connect = (endpoints: DeepReadonly<{
            nodeId: string;
            portId: string;
            blockName: string;
        }[]>) => {
            if (endpoints.length < 2) return;
            const points = [...new Set(endpoints.map(e => e.portId))]

            const pPoint = points[0];

            for (const p of points.slice(1)) {
                elkEdges.push({
                    id: `edge_${signalName}_${edgeId++}`,
                    sources: [p],
                    targets: [pPoint],
                });
            }
        }

        if (signalName.startsWith('ext_')) {
            connect(endpoints)
        }
        else for (const blockName of [...new Set(endpoints.map(e => e.blockName))]) {
            connect(endpoints.filter(e => e.blockName === blockName))
        }
    }

    // Build root graph
    const graph: ElkNode = structuredClone({
        id: 'root',
        children: elkNodes,
        edges: elkEdges
    }) as ElkNode;
    if (includeDirectRoot) {
        graph.edges = terminalAwareEdges(graph, signalMap);
        canonicalGraph(graph);
        graph.layoutOptions = { 'org.eclipse.elk.randomSeed': '1' };
    }

    // Experimental profiles are local to the circuit block. The virtual/root
    // hierarchy keeps the legacy options, so inter-block placement is unchanged.
    applyProfileToLocalBlocks(graph, profile, includeDirectRoot);

    // await writeFile(".test-output/elk.json", JSON.stringify(graph, null, 2));
    // const graph = await readFile(".test-output/elk.json", 'utf-8').then(JSON.parse)

    const layoutedGraph = await elk.layout(graph, { layoutOptions: BASELINE_LAYOUT_PROFILE.options });

    // await writeFile(".test-output/elk_output.json", JSON.stringify(layoutedGraph, null, 2));

    // Compute absolute positions for components


    return { layoutedGraph, addedSymbol, profile: profile.name };
}
