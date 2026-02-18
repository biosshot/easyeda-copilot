import type { CircuitAssembly } from "./../types/circuit";

declare global {
    interface EDA {
        lastChangesRecorder?: Recorder,
    }
}

interface Offset {
    x: number | undefined;
    y: number | undefined
}

interface PlacedComponents {
    [k: string]: {
        primitive_id: string;
        pins: ISCH_PrimitiveComponentPin[];
        designator: string;
    };
}

interface ChangeRecord {
    primitiveId: string;
    time?: number;
}

interface Recorder {
    add: (r: ChangeRecord) => void;
    backwards: () => void;
    get: () => ChangeRecord[],
    isValid: () => boolean;
    stop: () => void;
    isEnded: () => boolean;
}

const to2 = (x: number) => { x = Math.round(x); return x - (x % 5); }

const applyOffset = (x: number, y: number, offset: Offset) => {

    if (offset.x) x = offset.x + x;
    if (offset.y) y = offset.y - y;

    return { x, y };
}

function createrRecordChanges(): Recorder {
    let records: ChangeRecord[] = [];
    let isValid = true;
    let isEnd = false;

    const add = (record: ChangeRecord) => {
        records.push({
            ...record,
            time: Date.now()
        });
    }

    const get = () => records

    const backwards = () => {
        if (!isEnd) return;

        const promises = records.map(async record => {
            const type = await eda.sch_Primitive.getPrimitiveTypeByPrimitiveId(record.primitiveId);
            if (!type) return;

            switch (type as string) {
                case ESCH_PrimitiveType.ARC:
                    return eda.sch_PrimitiveArc.delete(record.primitiveId);
                case ESCH_PrimitiveType.BUS:
                    return eda.sch_PrimitiveBus.delete(record.primitiveId);
                case ESCH_PrimitiveType.CIRCLE:
                    return eda.sch_PrimitiveCircle.delete(record.primitiveId);
                case ESCH_PrimitiveType.COMPONENT:
                    return eda.sch_PrimitiveComponent.delete(record.primitiveId);
                case ESCH_PrimitiveType.COMPONENT_PIN:
                    return eda.sch_PrimitivePin.delete(record.primitiveId);
                case ESCH_PrimitiveType.PIN:
                    return eda.sch_PrimitivePin.delete(record.primitiveId);
                case ESCH_PrimitiveType.POLYGON:
                    return eda.sch_PrimitivePolygon.delete(record.primitiveId);

                case 'Rect':
                case ESCH_PrimitiveType.RECTANGLE:
                    return eda.sch_PrimitiveRectangle.delete(record.primitiveId);

                case ESCH_PrimitiveType.TEXT:
                    return eda.sch_PrimitiveText.delete(record.primitiveId);

                case 'NetGroup':
                case ESCH_PrimitiveType.WIRE:
                    return eda.sch_PrimitiveWire.delete(record.primitiveId);

                case ESCH_PrimitiveType.OBJECT:
                case ESCH_PrimitiveType.BEZIER:
                case ESCH_PrimitiveType.ELLIPSE:

                default:
                    return Promise.reject("Unknown primitive type: " + type);
            }
        });

        if (eda.lastChangesRecorder === recorder) {
            eda.lastChangesRecorder = undefined;
        }

        isValid = false;
        records = [];

        return Promise.all(promises)
    }

    const recorder: Recorder = {
        add,
        backwards,
        get,
        isValid: () => isValid,
        isEnded: () => isEnd,
        stop: () => isEnd = true
    };

    eda.lastChangesRecorder = recorder;

    return recorder;
}

function chunkArray(arr: unknown[], size: number) {
    const chunkedArr = [];
    for (let i = 0; i < arr.length; i += size) {
        chunkedArr.push(arr.slice(i, i + size));
    }
    return chunkedArr;
}

async function createComponet(component: CircuitAssembly['components'][0], offset: Offset = { x: 0, y: 0 }) {
    let comp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;
    const { part_uuid: partUuid, designator, pos } = component;
    if (!partUuid) throw new Error("createComponet partUuid not found");

    const { x, y } = applyOffset(pos.x + (pos.center?.x ?? (pos.width / 2)), (pos.y + (pos.center?.y ?? (pos.height / 2))), offset)

    const create = async (data: { libraryUuid: string, uuid: string }) => {
        const comp = await eda.sch_PrimitiveComponent.create(data,
            to2(x),
            to2(y),
            undefined, pos.rotate
        );

        if (!comp) throw new Error("Component not found");
        eda.sys_Message.showToastMessage(`Component ${component.designator} place at ${x} ${y}`, ESYS_ToastMessageType.SUCCESS);

        return comp as ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2;
    };

    if (partUuid === 'GND') {
        comp = await create({
            libraryUuid: 'f5af0881d090439f925343ec8aedf154',
            uuid: '181f479f152643bbaa46a4b8cd92ed2e',
        });

        comp.setState_Name(component.value || "GND");
        comp.setState_OtherProperty({
            "Global Net Name": component.value || "GND"
        });
    }
    else if (partUuid === 'VCC') {
        comp = await create({
            libraryUuid: 'f5af0881d090439f925343ec8aedf154',
            uuid: '4e5977e7f049493cbf5b5f91190144d3',
        });

        comp.setState_Name(component.value || "VCC");
        comp.setState_OtherProperty({
            "Global Net Name": component.value || "VCC"
        });
    }
    else {
        comp = await create({
            libraryUuid: 'lcsc',
            uuid: partUuid
        });

        comp.setState_Designator(designator);
    }

    return comp;
}

async function getPrimitiveComponentPins(id: string) {
    const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(id);
    if (!pins) throw new Error("Pins not found");

    return pins.sort((a, b) => {
        const aNum = Number(a.getState_PinNumber());
        const bNum = Number(b.getState_PinNumber());
        return aNum - bNum;
    });
}

async function placeComponents(components: CircuitAssembly['components'], offset: Offset = { x: 0, y: 0 }, recorder?: Recorder): Promise<PlacedComponents> {
    const placedComponentsP = components.map(async (component) => {
        const { part_uuid: partUuid, designator } = component;
        if (!partUuid) return undefined;

        try {
            const placedComponent: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 = await createComponet(component, offset);
            const primitiveId = placedComponent.getState_PrimitiveId();

            recorder?.add({ primitiveId: primitiveId });

            const pins = await getPrimitiveComponentPins(primitiveId);
            await placedComponent.done();

            return { primitive_id: primitiveId, pins, designator };
        } catch (err) {
            const eMes = (err instanceof Error) ? err.message : '';

            eda.sys_Message.showToastMessage(`Component error ${designator}: ${eMes}`, ESYS_ToastMessageType.ERROR);
            return undefined;
        }
    });

    const placedComponents = await Promise.all(placedComponentsP);

    return Object.fromEntries(placedComponents.filter(Boolean).map((component) => [component?.designator, component]));
}

function filterUniqueCoordinatePairs(arr: number[]) {
    const seen = new Set();
    const result = [];

    for (let i = 0; i < arr.length; i += 2) {
        const x = arr[i];
        const y = arr[i + 1];

        // Проверяем, что пара существует (защита от нечётной длины)
        if (y === undefined) break;

        const key = `${x},${y}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(x, y);
        }
    }

    return result;
}

const findPin = async (designator: string, pin_: unknown, placeComponents: PlacedComponents, useSchComps = true) => {
    const searchComponentInSCH = async (designator: string) => {
        const components = await eda.sch_PrimitiveComponent.getAll();
        return components.find(c => c.getState_Designator()?.includes(designator));
    }

    const pinNumber = Number(pin_);

    let pins: ISCH_PrimitiveComponentPin[] = [];
    let isExternal = false;
    let component: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;

    if (placeComponents[designator]?.pins) {
        component = await eda.sch_PrimitiveComponent.get(placeComponents[designator].primitive_id);
        pins = placeComponents[designator].pins;
    }
    else if (useSchComps) {
        isExternal = true;
        component = await searchComponentInSCH(designator);
        pins = component ? await getPrimitiveComponentPins(component?.getState_PrimitiveId()) : []
    }

    let pin: ISCH_PrimitiveComponentPin | undefined;

    if (pinNumber === 1 && pins.length === 1) pin = pins[0];
    else pin = pins.find(p => Number(p.getState_PinNumber()) === pinNumber)

    if (!pin) return null;

    return { pin: pin, isExternal, component };
};

async function drawEdges(edges: CircuitAssembly['edges'], components: CircuitAssembly['components'],
    placeComponents: PlacedComponents, offset: Offset = { x: 0, y: 0 }, recorder?: Recorder) {
    const pointToArr = (p: { x: number, y: number }) => {
        const { x, y } = applyOffset(p.x, p.y, offset);
        return [x, -y];
    }

    const searchSignalName = (designator: string, pin: unknown) => {
        return components
            .find(comp => comp.designator === designator)?.pins?.find(p => Number(pin) === Number(p.pin_number))?.signal_name;
    }

    const getPinPos = (srcpin: Awaited<ReturnType<typeof findPin>>, defaultP: { x: number, y: number }) => {
        const srcPinPos = {
            x: srcpin?.pin?.getState_X() ?? 0,
            y: srcpin?.pin?.getState_Y() ?? 0,
        }

        if (!srcpin) {
            const [x, y] = pointToArr(defaultP);

            srcPinPos.x = x;
            srcPinPos.y = y;
        }

        return srcPinPos;
    }

    for (const edge of edges) {
        for (const section of edge.sections) {
            const [sdesignator, spin] = section?.incomingShape?.split?.("_pin_") ?? ['', ''];
            const [tdesignator, tpin] = section?.outgoingShape?.split?.("_pin_") ?? ['', ''];;

            let signalName = searchSignalName(sdesignator, spin);
            if (!signalName) signalName = searchSignalName(tdesignator, tpin);

            const netName = signalName ?? 'unknown net';

            const srcpin = await findPin(sdesignator, spin, placeComponents);
            const trgpin = await findPin(tdesignator, tpin, placeComponents);

            if (!srcpin) eda.sys_Message.showToastMessage(`Wire error not found pin: ${spin} ${sdesignator}`, ESYS_ToastMessageType.ERROR);
            if (!trgpin) eda.sys_Message.showToastMessage(`Wire error not found pin: ${tpin} ${tdesignator}`, ESYS_ToastMessageType.ERROR);

            const srcPinPos = getPinPos(srcpin, section.startPoint);
            const trgPinPos = getPinPos(trgpin, section.endPoint);

            const srcpx = srcPinPos.x;
            const srcpy = srcPinPos.y;
            const trgpx = trgPinPos.x;
            const trgpy = trgPinPos.y;

            let values: number[] = [srcpx, srcpy];

            if ("bendPoints" in section) {
                for (const bend of section.bendPoints ?? []) {
                    const [x, y] = pointToArr(bend);
                    // values.push(x, y);

                    const merge = (a: number, b: number) => Math.abs(a - b) <= 5 ? b : a;
                    values.push(merge(merge(x, srcpx), trgpx), merge(merge(y, srcpy), trgpy));
                }
            }

            values.push(trgpx, trgpy);
            values = values.map(x => to2(x));

            for (let i = 0; i < values.length; i += 2) {
                if (values.length <= i + 3) continue;
                if (values[i] !== values[i + 2] && values[i + 1] !== values[i + 3]) {
                    const d1 = Math.abs(values[i] - values[i + 2]);
                    const d2 = Math.abs(values[i + 1] - values[i + 3]);
                    if (d1 < d2) {
                        values = [...values.slice(0, i + 2), values[i + 2], values[i + 1], ...values.slice(i + 2)];
                    } else {
                        values = [...values.slice(0, i + 2), values[i], values[i + 3], ...values.slice(i + 2)];
                    }
                }
            }

            values = filterUniqueCoordinatePairs(values);

            try {
                const wire = await eda.sch_PrimitiveWire.create(values, netName);
                if (wire) recorder?.add({ primitiveId: wire.getState_PrimitiveId() })
            } catch (err) {
                eda.sys_Message.showToastMessage(`Wire error: ${(err as any).message} ${JSON.stringify(values)} ${netName} ${section.incomingShape} -> ${section.outgoingShape}`, ESYS_ToastMessageType.ERROR);
            }
        }
    }

}

const getPageSize = async () => {
    try {
        const page = await eda.dmt_Schematic.getCurrentSchematicPageInfo();
        if (!page) return { width: 1200, height: 800 };
        const width = Object.entries(page.titleBlockData).find(([key]) => key.toLowerCase() === 'width');
        const height = Object.entries(page.titleBlockData).find(([key]) => key.toLowerCase() === 'height');
        return { width: Number(width?.[1]?.value ?? 1200), height: Number(height?.[1]?.value ?? 800) };
    } catch (error) {
        return { width: 1200, height: 800 };
    }
}

async function placeNet(nets: CircuitAssembly['added_net'], placeComponents: PlacedComponents, recorder?: Recorder) {
    if (!nets) return;

    // Конфигурация попыток: длины и базовые направления (dx, dy)
    // Направления: 0 - Вправо, 1 - Вниз (экранная Y), 2 - Влево, 3 - Вверх
    const trialLengths = [20, 30, 40, 50];
    const directions = [
        { dx: 1, dy: 0 },   // 0 deg
        { dx: 0, dy: -1 },  // 90 deg
        { dx: -1, dy: 0 },  // 180 deg
        { dx: 0, dy: 1 }    // 270 deg
    ];

    for (const net of nets) {
        const pin = await findPin(net.designator, net.pin_number, placeComponents);
        if (!pin) {
            eda.sys_Message.showToastMessage(`Not found pin in placenet: ${net.designator} ${net.pin_number}`, ESYS_ToastMessageType.ERROR);
            continue;
        }

        const comp = placeComponents[net.designator];
        if (!comp) {
            eda.sys_Message.showToastMessage(`Component not found: ${net.designator}`, ESYS_ToastMessageType.ERROR);
            continue;
        }

        const pinX = pin.pin.getState_X();
        const pinY = pin.pin.getState_Y();
        const rot = pin.pin.getState_Rotation();

        // Определение индекса основного направления на основе вращения
        let primaryDirIndex = 0;
        if (rot >= 270) primaryDirIndex = 3;
        else if (rot >= 180) primaryDirIndex = 2;
        else if (rot >= 90) primaryDirIndex = 1;
        else primaryDirIndex = 0;

        // Формирование списка направлений для проверки
        let directionsToTry: number[] = [];

        if (comp.pins.length >= 3) {
            // Для компонентов с 3 и более выводами используется только основное направление
            directionsToTry = [primaryDirIndex];
        } else {
            // Для компонентов с менее чем 3 выводами допускается перебор направлений
            // Исключается направление, противоположное основному (внутрь компонента)
            const forbiddenDirIndex = (primaryDirIndex + 2) % 4;
            for (let i = 0; i < 4; i++) {
                if (i !== forbiddenDirIndex) {
                    directionsToTry.push(i);
                }
            }
            // Приоритет отдается основному направлению
            directionsToTry.sort((a, b) => {
                if (a === primaryDirIndex) return -1;
                if (b === primaryDirIndex) return 1;
                return 0;
            });
        }

        let wireCreated = false;

        // Внешний цикл по длинам
        for (const dirIndex of directionsToTry) {
            if (wireCreated) break;

            // Внутренний цикл по направлениям
            for (const wireLength of trialLengths) {
                const dir = directions[dirIndex];
                const endX = pinX + dir.dx * wireLength;
                const endY = pinY + dir.dy * wireLength;

                try {
                    const wire = await eda.sch_PrimitiveWire.create([pinX, pinY, endX, endY], net.net);
                    if (wire) {
                        recorder?.add({ primitiveId: wire.getState_PrimitiveId() });
                        wireCreated = true;
                        break; // Прерывание цикла направлений при успехе
                    }
                } catch (err) {
                    // Продолжение попытки со следующим направлением или длиной
                    continue;
                }
            }
        }

        if (!wireCreated) {
            eda.sys_Message.showToastMessage(
                `Wire creation failed after all attempts: "${net.net}" at ${net.designator} ${net.pin_number}`,
                ESYS_ToastMessageType.ERROR
            );
        }
    }
}

async function drawRect(blocksRect: CircuitAssembly['blocks_rect'], offset: Offset = { x: 0, y: 0 }, recorder?: Recorder) {

    for (const block of blocksRect ?? []) {
        if (block.name === 'block___v_root__') continue;
        const padding = 5;

        const { x, y } = applyOffset(block.x - padding, block.y - padding, offset)

        const rect = await eda.sch_PrimitiveRectangle.create(x, y, block.width + (padding * 2), block.height + (padding * 2), 2);

        const descArr = chunkArray(block.description.split(' '), 8).map(arr => arr.join(' '))
        const desc = descArr.join('\n');

        const text = await eda.sch_PrimitiveText.create(x, y + 3 + (5 * descArr.length), desc, undefined, undefined, undefined, 5)
        const text_2 = await eda.sch_PrimitiveText.create(x, y + 18 + (5 * descArr.length), block.name, undefined, undefined, undefined, 14);

        if (rect) recorder?.add({ primitiveId: rect.getState_PrimitiveId() });
        if (text) recorder?.add({ primitiveId: text.getState_PrimitiveId() });
        if (text_2) recorder?.add({ primitiveId: text_2.getState_PrimitiveId() });
    }
}

export async function assembleCircuit(circuit: CircuitAssembly) {
    eda.sys_Message.showToastMessage(`Assemble circuit...`, ESYS_ToastMessageType.INFO);

    const recorder = createrRecordChanges();

    const pageSize = await getPageSize();
    const root = (circuit.blocks_rect ?? []).find(block => block.name === 'block___v_root__');

    const offset: Offset = { x: 0, y: 0 };

    const otions = {
        centered: circuit.assembly_options?.centered ?? true
    };

    if (root)
        if (otions.centered) {
            offset.x = (pageSize.width - root.width) / 2;
            offset.y = ((pageSize.height - root.height) / 2) + root.height;
        }
        else {
            offset.y = root.height;
            offset.x = undefined;
        }


    const placedComp = await placeComponents(circuit.components, offset, recorder);

    // eda.sys_MessageBox.showInformationMessage(JSON.stringify(placedComp, null, 2))

    await drawEdges(circuit.edges, circuit.components, placedComp, offset, recorder);
    await placeNet(circuit.added_net ?? [], placedComp, recorder);
    await drawRect(circuit.blocks_rect, offset, recorder);

    const isUsedPin = (d: string, p: number) => {
        const l = `${d}_pin_${p}`;
        if (circuit.edges.some(e => e.sections.some(s => s.incomingShape === l || s.outgoingShape === l))) {
            return true
        }
    }

    const netForUnusedPins: CircuitAssembly['added_net'] = [];
    for (const component of circuit.components) {
        for (const pin of component.pins) {
            if (!isUsedPin(component.designator, pin.pin_number) && pin.signal_name.length) {
                netForUnusedPins.push({
                    designator: component.designator,
                    net: pin.signal_name,
                    pin_number: pin.pin_number
                });
            }
        }
    }

    // eda.sys_Dialog.showInformationMessage(JSON.stringify(netForUnusedPins))
    await placeNet(netForUnusedPins, placedComp, recorder);

    recorder.stop();

    eda.sys_Message.showToastMessage(`Assemble complete.`, ESYS_ToastMessageType.SUCCESS);
}
