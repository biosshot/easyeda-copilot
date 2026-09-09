import type { BlockHierarchyNode } from '#types/auto-place.ts';
import type { Circuit } from '#types/circuit.ts';
import type { SymbolWithMeta } from '#types/symbol.ts';
import { createPatternContext } from './helpers.ts';
import { circuitLayoutPatterns } from './registry.ts';
import type { CircuitLayoutPattern, MacroInstance, PatternCollapseResult, PatternMatch } from './types.ts';

function compareMatches(left: PatternMatch, right: PatternMatch) {
    return right.priority - left.priority
        || right.designators.length - left.designators.length
        || left.patternId.localeCompare(right.patternId)
        || left.designators.join('\u0000').localeCompare(right.designators.join('\u0000'));
}

export function detectPatternMacros(
    circuit: Circuit,
    symbols: SymbolWithMeta[],
    patterns: CircuitLayoutPattern[] = circuitLayoutPatterns,
): PatternCollapseResult {
    const fullContext = createPatternContext(circuit, symbols);
    const patternById = new Map(patterns.map(pattern => [pattern.id, pattern]));
    const used = new Set<string>();
    const macros: MacroInstance[] = [];

    // Re-run every matcher after accepting a macro. Some matchers return one maximal
    // group, so filtering a stale match cannot recover a valid group left behind.
    while (used.size < circuit.components.length) {
        const availableComponents = circuit.components.filter(component => !used.has(component.designator));
        const availableDesignators = new Set(availableComponents.map(component => component.designator));
        const availableContext = createPatternContext(
            { ...circuit, components: availableComponents },
            symbols.filter(symbol => availableDesignators.has(symbol.designator)),
        );
        const matches = patterns.flatMap(pattern => pattern.findMatches(availableContext)).sort(compareMatches);
        let accepted = false;

        for (const match of matches) {
            const pattern = patternById.get(match.patternId);
            // Instantiate against the full circuit so public-port detection still sees
            // components already represented by an earlier macro on the same signal.
            const macro = pattern?.instantiate(match, fullContext);
            if (!macro?.absorbedDesignators.length
                || macro.absorbedDesignators.some(designator => !availableDesignators.has(designator))) continue;
            macros.push(macro);
            for (const designator of macro.absorbedDesignators) used.add(designator);
            accepted = true;
            break;
        }

        if (!accepted) break;
    }

    return { macros, absorbedDesignators: used };
}

export function applyPatternMacrosToHierarchy(
    root: BlockHierarchyNode,
    macros: MacroInstance[],
) {
    const byBlock = new Map<string, MacroInstance[]>();
    for (const macro of macros) {
        const blockMacros = byBlock.get(macro.blockName) ?? [];
        blockMacros.push(macro);
        byBlock.set(macro.blockName, blockMacros);
    }

    const visit = (block: BlockHierarchyNode) => {
        const blockMacros = byBlock.get(block.name) ?? [];
        if (blockMacros.length) {
            const preferredDirections = new Set(blockMacros
                .map(macro => macro.preferredBlockDirection)
                .filter(direction => direction !== undefined));
            if (preferredDirections.size === 1) {
                block.layoutOptions['org.eclipse.elk.direction'] = [...preferredDirections][0]!;
                block.allowedImprovements = ['rotate'];
            }
            const absorbed = new Set(blockMacros.flatMap(macro => macro.absorbedDesignators));
            const removeAbsorbed = (node: BlockHierarchyNode) => {
                node.components = node.components.filter(component => !absorbed.has(component.designator));
                for (const child of node.children) removeAbsorbed(child);
            };
            removeAbsorbed(block);
            for (const macro of blockMacros) {
                if (!macro.layoutChildBlock) {
                    block.components.push(macro.node);
                    continue;
                }
                block.children.push({
                    name: macro.layoutChildBlock.name,
                    description: macro.layoutChildBlock.description,
                    children: [],
                    components: [macro.node],
                    links: { input: [], output: [] },
                    layoutOptions: { ...macro.layoutChildBlock.layoutOptions },
                });
            }
        }
        for (const child of block.children) visit(child);
    };
    visit(root);
}
