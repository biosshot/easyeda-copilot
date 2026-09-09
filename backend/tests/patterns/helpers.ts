import assert from 'assert';
import type { ElkNode } from 'elkjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { autoPlaceCircuitWithHierarchy } from '../../src/circuit-layout/index.ts';
import { shortSymbolsMap } from '../../src/circuit-layout/short-symbol.ts';
import type { CircuitLayoutPattern, MacroInstance } from '../../src/circuit-layout/patterns/index.ts';
import type { Circuit, CircuitAssembly, CircuitComponent } from '../../src/types/circuit.ts';
import type { SymbolWithMeta } from '../../src/types/symbol.ts';

const OPAMP_PART_UUID = 'bde388b03d05419ba1102540cf0c29dc';
const RESISTOR_PART_UUID = '0cc9cee0c09e4a1c8b41e9d1feefa5b2';
export const PATTERN_FIXTURE_BLOCK_NAME = '__v_root__';

export type PatternFixture = {
    circuit: Circuit;
    symbols: SymbolWithMeta[];
};

export type LayoutResult = Awaited<ReturnType<typeof autoPlaceCircuitWithHierarchy>>;

export function component(
    designator: string,
    pins: Array<[number, string, string]>,
    blockName = PATTERN_FIXTURE_BLOCK_NAME,
): CircuitComponent {
    const opamp = designator.startsWith('U');
    return {
        designator,
        value: opamp ? 'TLV9062IDR' : '100kΩ',
        block_name: blockName,
        search_query: opamp ? 'TLV9062IDR' : '100kΩ',
        part_uuid: opamp ? OPAMP_PART_UUID : RESISTOR_PART_UUID,
        pins: pins.map(([pin_number, name, signal_name]) => ({ pin_number, name, signal_name })),
    };
}

export function createPatternFixtureCircuit(
    projectName: string,
    description: string,
    components: CircuitComponent[],
): Circuit {
    return {
        metadata: { project_name: projectName, description: projectName },
        blocks: [{ name: PATTERN_FIXTURE_BLOCK_NAME, description, next_block_names: [] }],
        components,
        reused_blocks: [],
    };
}

export function resistorSymbol(item: CircuitComponent): SymbolWithMeta {
    return {
        designator: item.designator,
        block_name: item.block_name,
        symbol: {
            width: 60,
            height: 28,
            center: { x: 30, y: 14 },
            pins: item.pins.map(pin => ({
                num: pin.pin_number,
                name: pin.name,
                signal_name: pin.signal_name,
                x: Number(pin.pin_number) === 1 ? 0 : 60,
                y: 14,
                part: '',
            })),
        },
    };
}

export function opampSymbol(item: CircuitComponent): SymbolWithMeta {
    const positions = new Map<number, [number, number]>([
        [1, [100, 50]],
        [2, [0, 40]],
        [3, [0, 60]],
        [4, [50, 100]],
        [8, [50, 0]],
    ]);
    return {
        designator: item.designator,
        block_name: item.block_name,
        symbol: {
            width: 100,
            height: 100,
            center: { x: 40, y: 50 },
            pins: item.pins.map(pin => {
                const [x, y] = positions.get(Number(pin.pin_number))!;
                return {
                    num: pin.pin_number,
                    name: pin.name,
                    signal_name: pin.signal_name,
                    x,
                    y,
                    part: '',
                };
            }),
        },
    };
}

function fixture(projectName: string, components: CircuitComponent[]): PatternFixture {
    return {
        circuit: createPatternFixtureCircuit(projectName, 'Analog frontend', components),
        symbols: components.map(item => item.designator.startsWith('U')
            ? opampSymbol(item)
            : resistorSymbol(item)),
    };
}

function opampComponent() {
    return component('U1', [
        [8, 'VCC', 'VCC'],
        [4, 'VEE/GND', 'GND'],
        [2, 'INA-', '$1N425'],
        [3, 'INA+', '$1N431'],
        [1, 'OUTA', '$1N437'],
    ]);
}

export function opampFixture(): PatternFixture {
    return fixture('circuit-pattern-opamp', [
        opampComponent(),
        component('R2', [[2, '2', '$1N437'], [1, '1', '$1N425']]),
        component('R1', [[2, '2', '$1N425'], [1, '1', 'GND']]),
        component('R5', [[1, '1', '$1N437'], [2, '2', 'GND']]),
    ]);
}

export function voltageDividerFixture(): PatternFixture {
    return fixture('circuit-pattern-voltage-divider', [
        component('R3', [[1, '1', 'VCC_3V3'], [2, '2', '$1N431']]),
        component('R4', [[1, '1', '$1N431'], [2, '2', 'GND']]),
        opampComponent(),
    ]);
}

export function combinedFixture(): PatternFixture {
    return fixture('circuit-patterns-integration', [
        opampComponent(),
        component('R2', [[2, '2', '$1N437'], [1, '1', '$1N425']]),
        component('R1', [[2, '2', '$1N425'], [1, '1', 'GND']]),
        component('R3', [[1, '1', 'VCC_3V3'], [2, '2', '$1N431']]),
        component('R4', [[1, '1', '$1N431'], [2, '2', 'GND']]),
        component('R5', [[1, '1', '$1N437'], [2, '2', 'GND']]),
    ]);
}

export function assertOrthogonal(points: { x: number; y: number }[]) {
    const epsilon = 1e-6;
    for (let index = 1; index < points.length; index++) {
        assert.ok(
            Math.abs(points[index - 1].x - points[index].x) <= epsilon
            || Math.abs(points[index - 1].y - points[index].y) <= epsilon,
            `Non-orthogonal segment ${JSON.stringify([points[index - 1], points[index]])}`,
        );
    }
}

export function assertMacroRoutes(macro: MacroInstance) {
    const pinPositions = new Map(macro.placements.flatMap(placement => placement.pins.map(pin => [
        pin.id,
        { x: placement.x + pin.x, y: placement.y + pin.y },
    ] as const)));
    for (const route of macro.routedPaths) {
        assertOrthogonal(route.points);
        if (route.kind !== 'internal') continue;
        const source = pinPositions.get(route.sourcePinId)!;
        const target = pinPositions.get(route.targetPinId)!;
        assert.ok(Math.abs(route.points[0].x - source.x) < 1e-6
            && Math.abs(route.points[0].y - source.y) < 1e-6,
        `${route.id} does not start at ${route.sourcePinId}`);
        assert.ok(Math.abs(route.points.at(-1)!.x - target.x) < 1e-6
            && Math.abs(route.points.at(-1)!.y - target.y) < 1e-6,
        `${route.id} does not end at ${route.targetPinId}`);
    }
}

export function assertPlacementRotations(macro: MacroInstance, expected: Record<string, number>) {
    assert.deepStrictEqual(Object.fromEntries(Object.keys(expected).map(designator => [
        designator,
        macro.placements.find(item => item.designator === designator)?.rotate,
    ])), expected);
}

export function assertCircuitConnectivity(
    circuit: Circuit,
    edges: LayoutResult['edges'],
    addedSymbols: LayoutResult['addedSymbol'],
) {
    const parent = new Map<string, string>();
    const find = (id: string): string => {
        const current = parent.get(id);
        if (!current) {
            parent.set(id, id);
            return id;
        }
        if (current === id) return id;
        const root = find(current);
        parent.set(id, root);
        return root;
    };
    const union = (left: string, right: string) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };
    for (const edge of edges) {
        const refs = [...edge.sources, ...edge.targets];
        for (const ref of refs) find(ref);
        for (const ref of refs.slice(1)) union(refs[0], ref);
    }

    const shortPartUuids = new Set(Object.values(shortSymbolsMap).map(item => item.partUuid));
    const shortPinsBySignal = new Map<string, string[]>();
    for (const item of addedSymbols.filter(item => shortPartUuids.has(item.part_uuid ?? ''))) {
        for (const pin of item.pins) {
            const refs = shortPinsBySignal.get(pin.signal_name) ?? [];
            refs.push(`${item.designator}_pin_${pin.pin_number}`);
            shortPinsBySignal.set(pin.signal_name, refs);
        }
    }
    for (const refs of shortPinsBySignal.values()) {
        for (const ref of refs.slice(1)) union(refs[0], ref);
    }

    const bySignal = new Map<string, string[]>();
    for (const item of circuit.components) {
        for (const pin of item.pins) {
            const refs = bySignal.get(pin.signal_name) ?? [];
            refs.push(`${item.designator}_pin_${pin.pin_number}`);
            bySignal.set(pin.signal_name, refs);
        }
    }
    for (const [signalName, refs] of bySignal) {
        if (refs.length < 2) continue;
        const root = find(refs[0]);
        assert.ok(refs.every(ref => find(ref) === root),
            `Signal ${signalName} was disconnected after macro expansion: ${refs.join(', ')}`);
    }
}

export function assertExpandedLayout(fixture: PatternFixture, result: LayoutResult) {
    const componentIds = fixture.circuit.components.map(item => item.designator).sort();
    assert.deepStrictEqual(
        result.positioned.filter(node => componentIds.includes(node.designator)).map(node => node.designator).sort(),
        componentIds,
    );
    assert.ok(result.positioned.every(node => !node.designator.startsWith('__macro__')));
    assert.ok(!JSON.stringify(result.edges).includes('__macro__'));
    for (const edge of result.edges) {
        for (const section of edge.sections ?? []) {
            assertOrthogonal([section.startPoint, ...(section.bendPoints ?? []), section.endPoint]);
        }
    }
    assertCircuitConnectivity(fixture.circuit, result.edges, result.addedSymbol);

}

export function assertPatternRoutesAvoidBodies(result: LayoutResult, patternId: string) {
    const epsilon = 1e-6;
    const crossesInterior = (
        start: { x: number; y: number },
        end: { x: number; y: number },
        placement: LayoutResult['positioned'][number],
    ) => {
        const left = placement.x;
        const right = placement.x + placement.width;
        const top = placement.y;
        const bottom = placement.y + placement.height;
        if (Math.abs(start.x - end.x) <= epsilon) {
            return start.x > left + epsilon && start.x < right - epsilon
                && Math.max(Math.min(start.y, end.y), top + epsilon)
                < Math.min(Math.max(start.y, end.y), bottom - epsilon);
        }
        return start.y > top + epsilon && start.y < bottom - epsilon
            && Math.max(Math.min(start.x, end.x), left + epsilon)
            < Math.min(Math.max(start.x, end.x), right - epsilon);
    };

    const patternEdges = result.edges.filter(edge => edge.id.startsWith(`pattern_${patternId}_`));
    assert.ok(patternEdges.length > 0, `No expanded ${patternId} edges were generated`);
    for (const edge of patternEdges) {
        for (const section of edge.sections ?? []) {
            const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
            for (let index = 1; index < points.length; index++) {
                for (const placement of result.positioned) {
                    assert.ok(!crossesInterior(points[index - 1], points[index], placement),
                        `${edge.id} crosses ${placement.designator}: ${JSON.stringify(points)}`);
                }
            }
        }
    }
}

export function assertMacroBoundaryShortsOnDeclaredSide(result: LayoutResult, macro: MacroInstance) {
    const anchor = macro.placements.find(placement => !placement.generatedComponent);
    const positionedAnchor = anchor
        && result.positioned.find(position => position.designator === anchor.designator);
    assert.ok(anchor && positionedAnchor, `Cannot locate ${macro.patternId} macro origin`);
    const origin = {
        x: positionedAnchor.x - anchor.x,
        y: positionedAnchor.y - anchor.y,
    };
    const blockName = `block_${macro.blockName}`;
    const epsilon = 1e-6;

    for (const port of macro.ports) {
        const short = result.addedSymbol.find(symbol =>
            symbol.block_name === blockName
            && symbol.part_uuid === shortSymbolsMap.NETPORT.partUuid
            && symbol.value === port.signalName);
        assert.ok(short, `Cannot locate ${port.signalName} boundary NETPORT`);
        const position = result.positioned.find(item => item.designator === short.designator);
        assert.ok(position, `Cannot locate ${port.signalName} NETPORT`);

        if (port.side === 'WEST') {
            assert.ok(position.x + position.width <= origin.x + epsilon,
                `${port.signalName} NETPORT is not west of ${macro.patternId}`);
        } else if (port.side === 'EAST') {
            assert.ok(position.x >= origin.x + macro.node.symbol.width - epsilon,
                `${port.signalName} NETPORT is not east of ${macro.patternId}`);
        } else if (port.side === 'NORTH') {
            assert.ok(position.y + position.height <= origin.y + epsilon,
                `${port.signalName} NETPORT is not north of ${macro.patternId}`);
        } else {
            assert.ok(position.y >= origin.y + macro.node.symbol.height - epsilon,
                `${port.signalName} NETPORT is not south of ${macro.patternId}`);
        }
    }
}

function findAbsoluteLayoutNode(
    node: ElkNode | undefined,
    id: string,
    parent = { x: 0, y: 0 },
): { x: number; y: number; width: number; height: number } | null {
    if (!node) return null;
    const absolute = {
        x: parent.x + (node.x ?? 0),
        y: parent.y + (node.y ?? 0),
    };
    if (node.id === id && typeof node.width === 'number' && typeof node.height === 'number') {
        return { ...absolute, width: node.width, height: node.height };
    }
    for (const child of node.children ?? []) {
        const found = findAbsoluteLayoutNode(child, id, absolute);
        if (found) return found;
    }
    return null;
}

export async function writePatternArtifacts(
    folderName: string,
    fixture: PatternFixture,
    options?: { patternCatalog?: CircuitLayoutPattern[] },
) {
    const outputDirectory = fileURLToPath(new URL(
        `../../.test-output/circuit-patterns/${folderName}/`,
        import.meta.url,
    ));
    await mkdir(outputDirectory, { recursive: true });

    const withoutPattern = await autoPlaceCircuitWithHierarchy(fixture.circuit, fixture.symbols, {}, {
        layoutMode: 'quality',
        layoutPatterns: false,
    });
    const withPattern = await autoPlaceCircuitWithHierarchy(fixture.circuit, fixture.symbols, {}, {
        layoutMode: 'quality',
        layoutPatterns: true,
        layoutPatternCatalog: options?.patternCatalog,
    });
    // Server PNG rendering is outside the backend; retain assembly and geometry assertions below.

    const blockRects = fixture.circuit.blocks.map(block => {
        const rect = findAbsoluteLayoutNode(withPattern.layoutedGraph, `block_${block.name}`);
        assert.ok(rect, `Layout has no ${block.name} block rectangle`);
        return {
            name: block.name,
            description: block.description,
            ...rect,
        };
    });
    const positionByDesignator = new Map(withPattern.positioned.map(position => [position.designator, position]));
    const assembly: CircuitAssembly = {
        ...fixture.circuit,
        reused_blocks: undefined,
        components: [...fixture.circuit.components, ...withPattern.addedSymbol].map(item => ({
            ...item,
            pos: positionByDesignator.get(item.designator),
        })),
        edges: withPattern.edges,
        blocks_rect: blockRects,
    };
    const assemblyPath = `${outputDirectory}/asm.json`;
    await writeFile(assemblyPath, JSON.stringify(assembly, null, 2), 'utf8');
    const savedAssembly = JSON.parse(await readFile(assemblyPath, 'utf8')) as CircuitAssembly;
    assert.strictEqual(savedAssembly.components.length,
        fixture.circuit.components.length + withPattern.addedSymbol.length);
    assert.strictEqual(savedAssembly.edges.length, withPattern.edges.length);
    assert.deepStrictEqual(
        savedAssembly.blocks.map(block => block.name).sort(),
        fixture.circuit.blocks.map(block => block.name).sort(),
    );
    assert.deepStrictEqual(
        savedAssembly.blocks_rect.map(block => block.name).sort(),
        fixture.circuit.blocks.map(block => block.name).sort(),
    );
    assert.ok(savedAssembly.blocks_rect.every(block => block.width > 10 && block.height > 10));
    const expectedBlocks = new Map(fixture.circuit.components.map(item => [item.designator, item.block_name]));
    assert.ok(savedAssembly.components
        .filter(item => expectedBlocks.has(item.designator))
        .every(item => item.block_name === expectedBlocks.get(item.designator)));

    return { withoutPattern, withPattern, assembly: savedAssembly, outputDirectory };
}

export function edgeConnects(result: LayoutResult, leftPin: string, rightPin: string) {
    return result.edges.some(edge => {
        const refs = [...edge.sources, ...edge.targets];
        return refs.includes(leftPin) && refs.includes(rightPin);
    });
}

export function pinsConnected(result: LayoutResult, leftPin: string, rightPin: string) {
    const parent = new Map<string, string>();
    const find = (id: string): string => {
        const current = parent.get(id);
        if (!current) {
            parent.set(id, id);
            return id;
        }
        if (current === id) return id;
        const root = find(current);
        parent.set(id, root);
        return root;
    };
    const union = (left: string, right: string) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };
    for (const edge of result.edges) {
        const refs = [...edge.sources, ...edge.targets];
        for (const ref of refs.slice(1)) union(refs[0], ref);
    }
    const shortPartUuids = new Set(Object.values(shortSymbolsMap).map(item => item.partUuid));
    const shortPinsBySignal = new Map<string, string[]>();
    for (const item of result.addedSymbol.filter(item => shortPartUuids.has(item.part_uuid ?? ''))) {
        for (const pin of item.pins) {
            const refs = shortPinsBySignal.get(pin.signal_name) ?? [];
            refs.push(`${item.designator}_pin_${pin.pin_number}`);
            shortPinsBySignal.set(pin.signal_name, refs);
        }
    }
    for (const refs of shortPinsBySignal.values()) {
        for (const ref of refs.slice(1)) union(refs[0], ref);
    }
    return find(leftPin) === find(rightPin);
}

export function assertPinHasLocalShort(result: LayoutResult, pinRef: string) {
    const shortPartUuids = new Set(Object.values(shortSymbolsMap).map(item => item.partUuid));
    const shortIds = new Set(result.addedSymbol
        .filter(item => shortPartUuids.has(item.part_uuid ?? ''))
        .map(item => item.designator));
    assert.ok(result.edges.some(edge => {
        const refs = [...edge.sources, ...edge.targets];
        return refs.includes(pinRef)
            && refs.some(ref => [...shortIds].some(id => ref.startsWith(`${id}_pin_`)));
    }), `${pinRef} is not terminated by a local short symbol`);
}
