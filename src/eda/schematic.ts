import type { CircuitAssembly, ExplainCircuit } from '@copilot/shared/types/circuit';
import { searchComponentInSCH } from './search';
import { getBBox, getPrimitiveById, withTimeout } from './utils';

let lastToastTime = 0;
const TOAST_THROTTLE_MS = 8000;

// Вспомогательная функция: парсинг Allegro-нетлиста
function parseAllegroNetlist(netlistText: string) {
    netlistText = netlistText.replaceAll('\r', '').replaceAll('\n\n', '\n').replaceAll(" ,\n", " ");

    const lines = netlistText.split('\n');
    const signalToPins = new Map<string, string[]>(); // 'VCC' => ['R1.1', 'C2.2', ...]
    let inNetsSection = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '$NETS') {
            inNetsSection = true;
            continue;
        }
        if (trimmed.startsWith('$') && trimmed !== '$NETS') {
            inNetsSection = false;
            continue;
        }
        if (!inNetsSection || !trimmed || trimmed.startsWith(';')) continue;

        // Пример строки: 'VCC_12V' ; H7.1 R7.1 R9.1
        const match = trimmed.match(/^['"]?(.*?)['"]?\s*;\s*(.*)$/);
        if (!match) continue;

        const signalName = match[1].trim();
        const pinRefs = match[2]
            .split(/\s+/)
            .map(p => p.trim())
            .filter(Boolean);

        signalToPins.set(signalName, pinRefs);
    }

    // Обратный маппинг: "R1.1" => "VCC"
    const pinToSignal = new Map<string, string>();
    for (const [signal, pinList] of signalToPins) {
        for (const pinRef of pinList) {
            pinToSignal.set(pinRef, signal);
        }
    }

    return pinToSignal;
}

export async function getSchematic(primitiveIds?: string[], options?: { disableExtractPartUuid: boolean }) {
    const now = Date.now();
    // @ts-ignore
    if (now - lastToastTime > TOAST_THROTTLE_MS) {
        eda.sys_Message.showToastMessage(`Please make sure there are no duplicate designators or go to Design -> Annotate Designator`, ESYS_ToastMessageType.INFO);
        lastToastTime = now;
    }

    // 1. Получаем нетлист как строку
    const netlistText: string = await eda.sch_Netlist.getNetlist(ESYS_NetlistType.ALLEGRO);
    const pinToSignal = parseAllegroNetlist(netlistText);


    if (!primitiveIds) {
        primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
    }

    const componentsMap: Map<string, ExplainCircuit['components'][0] & { code?: string }> = new Map();

    for (const id of primitiveIds) {
        const primitiveComponent: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1 | undefined = await getPrimitiveById(id).then(r => Array.isArray(r) ? r[0] : r).catch(err => null);

        if (!primitiveComponent || primitiveComponent.getState_PrimitiveType() !== ESCH_PrimitiveType.COMPONENT) {
            // eda.sys_Log.add(`[getSchematic] Error Processing component ${JSON.stringify(primitiveComponent)}`);
            continue;
        }

        const designator = primitiveComponent?.getState_Designator?.() ?? '';

        if (!designator.trim()) {
            // eda.sys_Log.add(`[getSchematic] Error Processing component`);
            continue;
        }

        if (designator.includes('|') && designator.length > 4) {
            continue;
        }

        const component = componentsMap.get(designator);

        if (component && !primitiveComponent.getState_SubPartName()) {
            eda.sys_Message.showToastMessage(`Duplicate designator: ${designator}\nPlease rename the designations. (Design -> Annotate Designator)`, ESYS_ToastMessageType.ERROR);
            console.warn(`[getSchematic] Duplicate designator: ${designator}; ${primitiveComponent.getState_SubPartName()}`);
            continue;
        }

        let value: string | null = null;

        const name = primitiveComponent.getState_Name() ?? '';

        if (name.includes("Manufacturer Part")) {
            value = primitiveComponent.getState_ManufacturerId() ?? '';
        }
        else if (name.includes("Value")) {
            value = primitiveComponent.getState_OtherProperty()?.Value?.toString() ?? null;
        }
        else if (name[0] !== '=') {
            value = name;
        }

        if (!value) {
            value = primitiveComponent.getState_ManufacturerId() ?? '';
        }

        const pins: ExplainCircuit['components'][0]['pins'] = [];

        // eda.sys_Log.add(`[getSchematic] Processing component: ${designator}, Value: ${value}`);
        const rawPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveComponent.getState_PrimitiveId()).catch(e => undefined)

        if (Array.isArray(rawPins)) {
            for (const p of rawPins) {
                const rawNum = p.getState_PinNumber();
                const pinNumber = rawNum;
                const pinName = p.getState_PinName();

                // Сопоставление: "R7.1" → сигнал
                const pinRef = `${designator}.${pinNumber}`;
                const signalName = pinToSignal.get(pinRef) || '';
                // eda.sys_Log.add(`[getSchematic]   Pin: ${pinRef}, Name: ${pinName}, Signal: ${signalName}`);

                pins.push({
                    pin_number: pinNumber,
                    name: pinName,
                    signal_name: signalName,
                });
            }
        }

        componentsMap.set(designator, {
            designator,
            part_uuid: null,
            pins: [...(component?.pins ?? []), ...pins],
            value,
            pos: {
                x: primitiveComponent.getState_X(),
                y: primitiveComponent.getState_Y(),
                rotate: primitiveComponent.getState_Rotation(),
                mirror: primitiveComponent.getState_Mirror()
            },
            code: primitiveComponent.getState_SupplierId()?.toString() || undefined
        })
    }

    // eslint-disable-next-line no-async-promise-executor
    const componentsPromises = componentsMap.values().map((component): Promise<ExplainCircuit['components'][0]> => new Promise(async (resolve) => {
        let device: ILIB_DeviceSearchItem | null = null;

        if (!options?.disableExtractPartUuid) {
            const query = component.code || component.value;

            if (!query) {
                eda.sys_Message.showToastMessage(`Fail get component ${component.designator}`, ESYS_ToastMessageType.ERROR);
                device = null;
            }
            else {
                device = await eda.lib_Device.search(query).then(devices => {
                    return devices.find(d => d.supplierId === query || d.manufacturerId === query || d.name === query) ?? null
                }).catch(() => null);
            }
        }

        resolve({
            designator: component.designator,
            pins: component.pins,
            value: component.value,
            pos: component.pos,
            part_uuid: device?.uuid ?? null,
            footprint_name: device?.footprint?.name
        });
    }));

    const components = await Promise.all(componentsPromises)

    const explainCircuit: ExplainCircuit = { components };

    return explainCircuit;
}

export async function getAsmCircuit(primitiveIds: string[]) {
    const circuit = await getSchematic(primitiveIds, { disableExtractPartUuid: false });
    const allPrimitive = await getPrimitiveById(primitiveIds).catch(e => []);
    const bbox = await getBBox(allPrimitive);

    if (!bbox) {
        eda.sys_Message.showToastMessage(`Error with get circuit BBOX`, ESYS_ToastMessageType.ERROR);
        return;
    }

    const ssMap = new Map<string, {
        component: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1,
        primitiveId: string
    }>();

    for (let index = 0; index < allPrimitive.length; index++) {
        const shortSymbol = allPrimitive[index];

        if (shortSymbol.getState_ComponentType() !== ESCH_PrimitiveComponentType.NET_FLAG &&
            shortSymbol.getState_ComponentType() !== ESCH_PrimitiveComponentType.NET_PORT) {
            continue;
        }

        const net = shortSymbol.getState_Net() || shortSymbol.getState_OtherProperty()?.['Global Net Name'];

        if (typeof net !== 'string') continue;

        const designator = `${net}|${crypto.randomUUID().slice(0, 4)}`;

        ssMap.set(designator, {
            component: shortSymbol,
            primitiveId: primitiveIds[index]
        });

        circuit.components.push({
            designator,
            part_uuid: shortSymbol.getState_Component()?.uuid ?? null,
            pins: [{
                name: '',
                pin_number: 1,
                signal_name: net
            }],
            pos: {
                x: shortSymbol.getState_X(),
                y: shortSymbol.getState_Y(),
                rotate: shortSymbol.getState_Rotation(),
                mirror: shortSymbol.getState_Mirror()
            },
            value: 'SS'
        })
    }

    const searchComponent = async (designator: string) => {
        if (ssMap.has(designator)) {
            return [ssMap.get(designator)!];
        }
        return await searchComponentInSCH(designator).catch(() => []);
    }

    // Формирование edges из проводов на схеме: извлекаем реальные провода с их маршрутами
    const allWires = await eda.sch_PrimitiveWire.getAll().catch(e => []);

    // Строим мапу координат пинов: "x,y" → { designator, pin_number }
    const pinCoordMap = new Map<string, { designator: string; pin_number: string | number }>();
    for (const component of circuit.components) {
        const primitives = await searchComponent(component.designator);
        for (const prim of primitives ?? []) {
            const compPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(prim.primitiveId).catch(() => []);
            for (const p of compPins ?? []) {
                const px = p.getState_X();
                const py = p.getState_Y();
                pinCoordMap.set(`${px},${py}`, {
                    designator: component.designator,
                    pin_number: p.getState_PinNumber(),
                });
            }
        }
    }

    // Группируем пины по signal_name (для sources/targets)
    const signalToPins = new Map<string, Array<{ designator: string; pin_number: string | number }>>();
    for (const component of circuit.components) {
        for (const pin of component.pins) {
            const signalName = pin.signal_name?.trim();
            if (!signalName || signalName.toLowerCase() === 'nc') continue;
            if (!signalToPins.has(signalName)) {
                signalToPins.set(signalName, []);
            }
            signalToPins.get(signalName)!.push({
                designator: component.designator,
                pin_number: pin.pin_number,
            });
        }
    }

    // Строим граф проводов ПО ЦЕПЯМ: для каждого net — свой граф смежности
    const ptKey = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    const netToWireGraph = new Map<string, Map<string, Set<string>>>();

    for (const wire of allWires) {
        const lineRaw = wire.getState_Line();
        if (!lineRaw || !Array.isArray(lineRaw)) continue;

        const wireData = (Array.isArray(lineRaw[0]) ? lineRaw : [lineRaw]) as number[][];

        // Собираем все точки этого провода
        const wirePoints = new Set<string>();
        for (const seg of wireData) {
            if (seg.length < 4) continue;
            wirePoints.add(ptKey({ x: seg[0], y: seg[1] }));
            wirePoints.add(ptKey({ x: seg[2], y: seg[3] }));
        }

        // Определяем net этого провода по пинам на его точках
        let wireNet = '';
        for (const pt of wirePoints) {
            const pinInfo = pinCoordMap.get(pt);
            if (pinInfo) {
                const comp = circuit.components.find(c => c.designator === pinInfo.designator);
                const pin = comp?.pins.find(p => p.pin_number == pinInfo.pin_number);
                if (pin?.signal_name) {
                    wireNet = pin.signal_name;
                    break;
                }
            }
        }

        if (!wireNet) continue;

        // Добавляем сегменты в граф этой цепи
        if (!netToWireGraph.has(wireNet)) {
            netToWireGraph.set(wireNet, new Map());
        }
        const graph = netToWireGraph.get(wireNet)!;

        for (const seg of wireData) {
            if (seg.length < 4) continue;
            const startKey = ptKey({ x: seg[0], y: seg[1] });
            const endKey = ptKey({ x: seg[2], y: seg[3] });

            if (!graph.has(startKey)) graph.set(startKey, new Set());
            if (!graph.has(endKey)) graph.set(endKey, new Set());
            graph.get(startKey)!.add(endKey);
            graph.get(endKey)!.add(startKey);
        }
    }

    // Мапа: pinId → координата пина "x,y"
    const pinIdToCoord = new Map<string, string>();
    for (const [coord, info] of pinCoordMap) {
        const pinId = `${info.designator}_pin_${info.pin_number}`;
        pinIdToCoord.set(pinId, coord);
    }

    // BFS поиск пути по графу проводов конкретной цепи
    function findWirePath(graph: Map<string, Set<string>>, startCoord: string, endCoord: string): string[] | null {
        if (startCoord === endCoord) return [startCoord];
        if (!graph.has(startCoord) || !graph.has(endCoord)) return null;

        const visited = new Set<string>();
        const queue: Array<{ coord: string; path: string[] }> = [{ coord: startCoord, path: [startCoord] }];
        visited.add(startCoord);

        while (queue.length > 0) {
            const { coord, path } = queue.shift()!;

            for (const neighbor of graph.get(coord) ?? []) {
                if (neighbor === endCoord) {
                    return [...path, neighbor];
                }
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ coord: neighbor, path: [...path, neighbor] });
                }
            }
        }

        return null;
    }

    // Поиск связных компонентов в графе
    function findConnectedComponents(graph: Map<string, Set<string>>): Array<Set<string>> {
        const visited = new Set<string>();
        const components: Array<Set<string>> = [];

        for (const [node] of graph) {
            if (visited.has(node)) continue;

            const component = new Set<string>();
            const queue = [node];
            visited.add(node);

            while (queue.length > 0) {
                const current = queue.shift()!;
                component.add(current);

                for (const neighbor of graph.get(current) ?? []) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }

            components.push(component);
        }

        return components;
    }

    const edges: CircuitAssembly['edges'] = [];
    let edgeCounter = 0;

    for (const [signalName, pins] of signalToPins) {
        if (pins.length < 2) continue;

        const pinIds = pins.map(p => `${p.designator}_pin_${p.pin_number}`);

        // Граф проводов только для этой цепи
        const netGraph = netToWireGraph.get(signalName);

        if (!netGraph || netGraph.size === 0) {
            // Нет проводов — не создаём edges (пины не соединены физически)
            continue;
        }

        // Находим связные компоненты в графе проводов этой цепи
        const components = findConnectedComponents(netGraph);

        // Группируем пины по связному компоненту
        const pinToComponent = new Map<string, number>(); // pinId → component index
        for (const pinId of pinIds) {
            const coord = pinIdToCoord.get(pinId);
            if (!coord) continue;
            for (let ci = 0; ci < components.length; ci++) {
                if (components[ci].has(coord)) {
                    pinToComponent.set(pinId, ci);
                    break;
                }
            }
        }

        // Группируем pinIds по компоненту
        const componentToPins = new Map<number, string[]>();
        for (const pinId of pinIds) {
            const ci = pinToComponent.get(pinId);
            if (ci === undefined) continue; // Пин не в графе проводов — пропускаем
            if (!componentToPins.has(ci)) componentToPins.set(ci, []);
            componentToPins.get(ci)!.push(pinId);
        }

        // Создаём edges только внутри каждого связного компонента
        for (const [, componentPins] of componentToPins) {
            if (componentPins.length < 2) continue;

            const referencePin = componentPins[0];
            const referenceCoord = pinIdToCoord.get(referencePin);
            const targetPins = componentPins.slice(1);

            for (const targetPin of targetPins) {
                const targetCoord = pinIdToCoord.get(targetPin);

                if (referenceCoord && targetCoord) {
                    const pathCoords = findWirePath(netGraph, referenceCoord, targetCoord);

                    if (pathCoords && pathCoords.length >= 2) {
                        const pathPoints = pathCoords.map(key => {
                            const [x, y] = key.split(',').map(Number);
                            return { x, y: bbox.height + y };
                        });

                        const bendPoints = pathPoints.slice(1, -1);

                        edges.push({
                            sources: [referencePin],
                            targets: [targetPin],
                            container: '__v_root__',
                            sections: [{
                                id: `${signalName}_${edgeCounter++}`,
                                startPoint: pathPoints[0],
                                endPoint: pathPoints[pathPoints.length - 1],
                                bendPoints: bendPoints.length ? bendPoints : undefined,
                                incomingShape: referencePin,
                                outgoingShape: targetPin,
                            }],
                        });
                        continue;
                    }
                }

                // Путь не найден — edge с пустым маршрутом
                edges.push({
                    sources: [referencePin],
                    targets: [targetPin],
                    container: '__v_root__',
                    sections: [{
                        id: `${signalName}_${edgeCounter++}`,
                        startPoint: { x: 0, y: 0 },
                        bendPoints: [],
                        endPoint: { x: 0, y: 0 },
                        incomingShape: referencePin,
                        outgoingShape: targetPin,
                    }],
                });
            }
        }
    }

    // throw netToWireSections;

    const amsCircuit: CircuitAssembly = {
        metadata: { description: '', project_name: '' },
        components: circuit.components.map((component): CircuitAssembly['components'][0] => ({
            block_name: '__v_root__',
            designator: component.designator,
            part_uuid: component.part_uuid,
            pins: component.pins,
            search_query: component.value,
            value: component.value,
            sub_part_name: undefined,
            pos: {
                center: {
                    x: 0,
                    y: 0
                },
                height: 0,
                width: 0,
                x: component.pos!.x,
                y: bbox.height - component.pos!.y,
                rotate: component.pos!.rotate,
                mirror: component.pos!.mirror
            }
        })),
        blocks_rect: [{
            description: '',
            height: bbox.height,
            width: bbox.width,
            name: 'block___v_root__',
            x: 5,
            y: 5
        }],
        blocks: [],
        edges,
    }

    const offsetX = -bbox.minX;
    const offsetY = -bbox.maxY;

    const applyPoint = <T extends { x: number, y: number }>(p: T) => {
        return {
            ...p,
            x: p.x + offsetX,
            y: p.y + offsetY
        }
    }

    for (const component of amsCircuit.components) {
        component.pos = applyPoint(component.pos);
    }

    for (const edge of amsCircuit.edges) {
        edge.sections = edge.sections?.map(section => ({
            ...section,
            endPoint: applyPoint(section.endPoint),
            startPoint: applyPoint(section.startPoint),
            bendPoints: section.bendPoints?.map(applyPoint)
        }))
    }

    return amsCircuit;
}
