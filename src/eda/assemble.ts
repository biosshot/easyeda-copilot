import type { CircuitAssembly, ExplainCircuit } from "./../types/circuit";
import { getShortSymPos, removeComponent } from "./rm-compoment-with-connections";
import { getSchematic } from "./schematic";
import { getPrimitiveComponentPins, hasDirectWire, searchComponentInSCH } from "./search";

const isOffline = eda.sys_Environment.isHalfOfflineMode() || eda.sys_Environment.isOfflineMode();

const VCC_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '4e5977e7f049493cbf5b5f91190144d3',
};

const NET_PORT_COMPONENT = {
    libraryUuid: 'f5af0881d090439f925343ec8aedf154',
    uuid: '7523d33c197549a39030c4ac7fddee68',
};


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

interface AddedNet {
    designator: string,
    pin_number: number | string,
    net: string,
    pin_name?: string
}

const to2 = (x: number) => { x = Math.round(x); return x - (x % 5); }

const applyOffset = (x: number, y: number, offset: Offset) => {

    if (offset.x) x = offset.x + x;
    if (offset.y) y = offset.y - y;

    return { x, y };
}

function chunkArray(arr: unknown[], size: number) {
    const chunkedArr = [];
    for (let i = 0; i < arr.length; i += size) {
        chunkedArr.push(arr.slice(i, i + size));
    }
    return chunkedArr;
}

function withTimeout<T>(
    promise: T,
    timeout_ms: number,
    errorMessage = 'Operation timeout'
): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
        // @ts-ignore
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeout_ms);
    });

    // @ts-ignore
    const safePromise = promise.then((result) => {
        if (timeoutId) clearTimeout(timeoutId);
        return result;

        // @ts-ignore
    }).catch((err) => {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
    });

    return Promise.race([safePromise, timeoutPromise]);
}

const placeComponent = async (data: { libraryUuid: string, uuid: string }, { x, y, rotate, mirror, addIntoBom, addIntoPcb }:
    { x: number, y: number, rotate?: number, mirror?: boolean, addIntoBom?: boolean, addIntoPcb?: boolean }) => {
    let maybeLibUuid;

    if (isOffline) {
        maybeLibUuid = [...new Set(['0819f05c4eef4c71ace90d822a990e87', 'f5af0881d090439f925343ec8aedf154', data.libraryUuid])];
    }
    else {
        maybeLibUuid = [data.libraryUuid];
    }

    let comp;

    for (const lib of maybeLibUuid) {
        try {
            const compPromise = eda.sch_PrimitiveComponent.create({
                uuid: data.uuid,
                libraryUuid: lib,
            }, to2(x), to2(y), undefined, rotate, mirror, addIntoBom, addIntoPcb);

            if (isOffline)
                comp = await withTimeout(compPromise, 25000);
            else
                comp = await compPromise;

        } catch (error) {
            comp = undefined;
        }

        if (comp) break;
    }

    if (!comp) throw new Error("Component not found");

    return comp as ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2;
};

async function createComponet(component: CircuitAssembly['components'][0], offset: Offset = { x: 0, y: 0 }) {
    let comp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;
    const { part_uuid: partUuid, designator, pos } = component;
    if (!partUuid) throw new Error("createComponet partUuid not found");

    const { x, y } = applyOffset(pos.x + (pos.center?.x ?? (pos.width / 2)), (pos.y + (pos.center?.y ?? (pos.height / 2))), offset)

    if (partUuid === 'GND') {
        comp = await placeComponent({
            libraryUuid: 'f5af0881d090439f925343ec8aedf154',
            uuid: '181f479f152643bbaa46a4b8cd92ed2e',
        }, { x, y, rotate: pos.rotate });

        const s = (component.value || "GND").toUpperCase()
        comp.setState_Name(s);
        comp.setState_OtherProperty({
            "Global Net Name": s
        });
    }
    else if (partUuid === 'VCC') {
        comp = await placeComponent(VCC_PORT_COMPONENT, { x, y, rotate: pos.rotate });

        const s = (component.value || "VCC").toUpperCase()
        comp.setState_Name(s);
        comp.setState_OtherProperty({
            "Global Net Name": s
        });
    }
    else {
        comp = await placeComponent({
            libraryUuid: 'lcsc',
            uuid: partUuid
        }, { x, y, rotate: pos.rotate });

        comp.setState_Designator(designator);
    }

    return comp;
}

const rotatePoint = (p: { x: number, y: number }, rotate: number) => {
    const radians = -rotate * (Math.PI / 180);
    const rotateMatrix = [
        [Math.cos(radians), -Math.sin(radians)],
        [Math.sin(radians), Math.cos(radians)]]

    return {
        x: Math.round(rotateMatrix[0][0] * p.x + rotateMatrix[0][1] * p.y),
        y: Math.round(rotateMatrix[1][0] * p.x + rotateMatrix[1][1] * p.y)
    }
}

export async function ComponentReplacer(primrive: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2, new_part_uuid: string) {
    const fakeX = - (10000 + Math.round(Math.random() * 10000))

    const savedProps = {
        x: primrive.getState_X(),
        y: primrive.getState_Y(),
        rotation: primrive.getState_Rotation(),
        mirror: primrive.getState_Mirror(),
        designator: primrive.getState_Designator(),
        addIntoBom: primrive.getState_AddIntoBom(),
        addIntoPcb: primrive.getState_AddIntoPcb(),
        uniqueId: primrive.getState_UniqueId(),
    };

    let isAllow = true;
    let newComp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;
    let rotate = 0
    let cause: string | undefined;
    const pinMissSizes: {
        oldX: number,
        oldY: number,
        missDX: number,
        missDY: number,
    }[] = [];

    try {
        newComp = await placeComponent({
            libraryUuid: 'lcsc',
            uuid: new_part_uuid
        }, {
            x: fakeX,
            y: 0,
            addIntoBom: savedProps.addIntoBom,
            addIntoPcb: savedProps.addIntoPcb,
            mirror: savedProps.mirror
        });

        if (!newComp) {
            throw new Error("Failed create new component in replace: " + new_part_uuid);
        }

        const newCompId = newComp.getState_PrimitiveId();
        const newPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(newCompId);
        const oldpins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primrive.getState_PrimitiveId());

        if (!newPins || !oldpins) {
            throw new Error('Pins not found in replace');
        }

        if (oldpins?.length !== newPins?.length) {
            throw new Error('Not safe replace pins lens')
        }

        for (const npin of newPins) {
            const npinNumber = npin.getState_PinNumber();
            const opin = oldpins?.find(op => op.getState_PinNumber() == npinNumber)
            if (!opin) {
                throw new Error('Not safe replace not eq pin: ' + npinNumber)
            }

            let npincoords = {
                x: Math.round(npin.getState_X() - newComp.getState_X()),
                y: Math.round(-npin.getState_Y() - newComp.getState_Y())
            }

            if (npin.getState_Rotation() !== opin.getState_Rotation()) {
                rotate = -(npin.getState_Rotation() - opin.getState_Rotation())
                npincoords = rotatePoint(npincoords, -rotate)
            }

            const ox = Math.round(opin.getState_X() - savedProps.x);
            const oy = Math.round(-opin.getState_Y() - savedProps.y);

            if (npincoords.x !== ox || npincoords.y !== oy) {
                if (npincoords.x !== ox && npincoords.y !== oy)
                    throw new Error('Not safe replace pins coord not eq');
                else {
                    pinMissSizes.push({
                        oldX: opin.getState_X(),
                        oldY: -opin.getState_Y(),
                        missDX: npincoords.x - ox,
                        missDY: npincoords.y - oy,
                    })
                }
            }
        }
    } catch (error) {
        isAllow = false;
        cause = (error as Error).message;
        if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId());
    }

    return {
        isAllow() {
            return { isAllow, cause };
        },

        async cancel() {
            if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId());
        },

        async replace() {
            if (!newComp || !isAllow) throw new Error('Replace not allow');

            await eda.sch_PrimitiveComponent.delete(primrive.getState_PrimitiveId());

            // Error if you try it at once
            newComp.setState_Rotation(rotate);
            await newComp?.done();

            newComp.setState_X(savedProps.x);
            newComp.setState_Y(savedProps.y);

            newComp.setState_Designator(savedProps.designator);
            newComp.setState_UniqueId(savedProps.uniqueId);

            await newComp?.done();

            for (const pinMiss of pinMissSizes) {
                await eda.sch_PrimitiveWire.create([
                    pinMiss.oldX, -pinMiss.oldY,
                    pinMiss.oldX - pinMiss.missDX, -(pinMiss.oldY + pinMiss.missDY)]).catch(e => undefined);
            }
        }
    }
}

async function placeComponents(components: CircuitAssembly['components'], offset: Offset = { x: 0, y: 0 }): Promise<PlacedComponents> {
    const placedComponentsP = components.map(async (component) => {
        const { part_uuid: partUuid, designator } = component;
        if (!partUuid) return undefined;

        try {
            const placedComponent: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 = await createComponet(component, offset);
            const primitiveId = placedComponent.getState_PrimitiveId();

            const pins = await getPrimitiveComponentPins(primitiveId);
            await placedComponent.done();

            return { primitive_id: primitiveId, pins, designator };
        } catch (err) {
            const eMes = (err instanceof Error) ? err.message : '';

            eda.sys_Log.add(`Component error ${designator}: ${eMes}`);
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

const findPin = async (designator: string, pin_: { num: number | string, name?: string }, placeComponents: PlacedComponents, useSchComps = true) => {
    const pinNumber = pin_.num;

    let pins: ISCH_PrimitiveComponentPin[] = [];
    let isExternal = false;
    let component: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;

    if (placeComponents[designator]?.pins) {
        component = await eda.sch_PrimitiveComponent.get(placeComponents[designator].primitive_id);
        pins = placeComponents[designator].pins;
    }
    else if (useSchComps) {
        isExternal = true;
        component = await searchComponentInSCH(designator).then(c => c?.component);
        pins = component ? await getPrimitiveComponentPins(component?.getState_PrimitiveId()) : []
    }

    let pin: ISCH_PrimitiveComponentPin | undefined;

    if (pinNumber == 1 && pins.length === 1) pin = pins[0];
    else pin = pins.find(p => p.getState_PinNumber() == pinNumber)
    if (!pin && pin_.name) pin = pins.find(p => p.getState_PinName() == pin_.name)

    if (!pin) return null;

    return { pin: pin, isExternal, component, pins };
};

async function drawEdges(edges: CircuitAssembly['edges'], components: CircuitAssembly['components'],
    placeComponents: PlacedComponents, offset: Offset = { x: 0, y: 0 }) {
    const pointToArr = (p: { x: number, y: number }) => {
        const { x, y } = applyOffset(p.x, p.y, offset);
        return [x, -y];
    }

    const searchSignalName = (designator: string, pin: string | number) => {
        return components
            .find(comp => comp.designator === designator)?.pins?.find(p => pin == p.pin_number)?.signal_name;
    }

    const searchPinName = (designator: string, pin: string | number) => {
        return components
            .find(comp => comp.designator === designator)?.pins?.find(p => pin == p.pin_number)?.name;
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
        for (const section of edge.sections ?? []) {
            const [sdesignator, spin] = section?.incomingShape?.split?.("_pin_") ?? ['', ''];
            const [tdesignator, tpin] = section?.outgoingShape?.split?.("_pin_") ?? ['', ''];;

            let signalName = searchSignalName(sdesignator, spin);
            if (!signalName) signalName = searchSignalName(tdesignator, tpin);

            const netName = signalName ?? 'unknown net';

            const srcpin = await findPin(sdesignator, { num: spin, name: searchPinName(sdesignator, spin) }, placeComponents);
            const trgpin = await findPin(tdesignator, { num: tpin, name: searchPinName(tdesignator, tpin) }, placeComponents);

            if (!srcpin) {
                const msg = `Wire error not found pin: ${spin} ${sdesignator}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
            }
            if (!trgpin) {
                const msg = `Wire error not found pin: ${tpin} ${tdesignator}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
            }

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
            } catch (err) {
                const msg = `Wire error: ${(err as Error).message} ${JSON.stringify(values)} ${netName} ${section.incomingShape} -> ${section.outgoingShape}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
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

async function placeNet(nets: AddedNet[], placeComponents: PlacedComponents, makePort: boolean, components?: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[]) {
    if (!nets) return;

    // Конфигурация попыток: длины и базовые направления (dx, dy)
    // Направления: 0 - Вправо, 1 - Вниз (экранная Y), 2 - Влево, 3 - Вверх
    const trialLengths = [20, 30, 40, 50];
    const trialPortOffsetLengths = [15, 20, 25, 30];

    const directions = [
        { dx: 1, dy: 0, port_offset_y: -1 },   // rigth
        { dx: 0, dy: -1, port_offset_y: 0 },  // top
        { dx: -1, dy: 0, port_offset_y: -1 },  // left
        { dx: 0, dy: 1, port_offset_y: 0 },    // bottom
    ];

    for (const net of nets) {
        let makePortForThis = makePort;

        const pin = await findPin(net.designator, { num: net.pin_number, name: net.pin_name }, placeComponents);
        if (!pin) {
            const msg = `Not found pin in placenet: ${net.designator} ${net.pin_number}`;
            eda.sys_Log.add(msg);
            eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
            continue;
        }

        if (makePortForThis) {
            const simComps = components?.filter(c => c.getState_Net() === net.net || c.getState_OtherProperty()?.['Global Net Name'] === net.net
                && (c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_FLAG || c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_PORT));

            if (simComps) {
                const shortSymsPos = await Promise.all(simComps.map(simComp => getShortSymPos(simComp))).catch(e => undefined);

                if (shortSymsPos) {
                    for (const pos of shortSymsPos) {
                        if (!pos) continue;

                        const hasDirect = await hasDirectWire(net.net, { x: pin.pin.getState_X(), y: pin.pin.getState_Y() }, { x: pos.pinX, y: pos.pinY }).catch(r => null);
                        if (hasDirect === true) {
                            makePortForThis = false;
                            break;
                        }
                    }
                }
            }
        }

        const pinCount = pin.pins.length ?? 10;

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

        if (pinCount >= 3) {
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
        let endX;
        let endY;
        let endYPort;
        let dir;

        // Внешний цикл по длинам
        for (const dirIndex of directionsToTry) {
            if (wireCreated) break;
            dir = directions[dirIndex];

            // Внутренний цикл по направлениям
            for (const wireLength of trialLengths) {
                if (wireCreated) break;

                let portOffsets = makePortForThis ? trialPortOffsetLengths : [0];
                if (dir.port_offset_y === 0) {
                    portOffsets = [0];
                }

                for (const portOffsetLen of portOffsets) {
                    if (wireCreated) break;

                    endX = pinX + dir.dx * wireLength;
                    endY = pinY + dir.dy * wireLength;
                    endYPort = endY + dir.port_offset_y * portOffsetLen;

                    try {
                        const wire = await eda.sch_PrimitiveWire.create([pinX, pinY, endX, endY, endX, endYPort], net.net);
                        if (wire) {
                            wireCreated = true;
                            break;
                        }
                    } catch (err) {
                        continue;
                    }
                }
            }
        }

        if (wireCreated && makePortForThis && endX && endYPort && dir) {
            const rotation = dir.dy === 1 ? 180 : 0;
            const comp = await placeComponent(NET_PORT_COMPONENT, { x: endX, y: -endYPort, rotate: rotation }).catch(e => undefined);

            if (comp) {
                comp.setState_Name(net.net);
                comp.setState_OtherProperty({
                    "Global Net Name": net.net
                });

                await comp.done();
            }
        }

        if (!wireCreated) {
            const msg = `Wire creation failed after all attempts: "${net.net}" at ${net.designator} ${net.pin_number}`;
            eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
            eda.sys_Log.add(msg);
        }
    }
}

async function drawRect(blocksRect: CircuitAssembly['blocks_rect'], offset: Offset = { x: 0, y: 0 }) {

    for (const block of blocksRect ?? []) {
        if (block.name === 'block___v_root__') continue;
        const padding = 5;

        const { x, y } = applyOffset(block.x - padding, block.y - padding, offset)

        const rect = await eda.sch_PrimitiveRectangle.create(x, y, block.width + (padding * 2), block.height + (padding * 2), 2);

        const descArr = chunkArray(block.description.split(' '), 8).map(arr => arr.join(' '))
        const desc = descArr.join('\n');

        const text = await eda.sch_PrimitiveText.create(x, y + 3 + (5 * descArr.length), desc, undefined, undefined, undefined, 5)
        const text_2 = await eda.sch_PrimitiveText.create(x, y + 18 + (5 * descArr.length), block.name, undefined, undefined, undefined, 14);
    }
}

const confirmationMessage = (...args: Parameters<typeof eda.sys_Dialog.showConfirmationMessage>) => {
    return new Promise<boolean>((resolve, reject) => {
        eda.sys_Dialog.showConfirmationMessage(args[0], args[1], args[2], args[3], resolve);
    })
}

async function getBBox(components: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[]): Promise<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
} | null> {
    if (!components || components.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const comp of components) {
        try {
            const primitiveId = comp.getState_PrimitiveId();
            const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId);

            if (pins && pins.length > 0) {
                for (const pin of pins) {
                    const x = pin.getState_X();
                    const y = pin.getState_Y();
                    if (typeof x === 'number' && typeof y === 'number') {
                        minX = Math.min(minX, x);
                        maxX = Math.max(maxX, x);
                        minY = Math.min(minY, y);
                        maxY = Math.max(maxY, y);
                    }
                }
            } else {
                // Фоллбэк: если нет пинов, используем центр компонента
                const x = comp.getState_X();
                const y = comp.getState_Y();
                const padding = 50;
                minX = Math.min(minX, x - padding);
                maxX = Math.max(maxX, x + padding);
                minY = Math.min(minY, y - padding);
                maxY = Math.max(maxY, y + padding);
            }
        } catch (error) {
            // skip
        }
    }

    if (minX === Infinity) return null;

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

async function searchFreePlace(root: { width: number, height: number }, componentsOnSch: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[]) {
    const offset: Offset = { x: 0, y: 0 };
    const busyPlace = await getBBox(componentsOnSch);
    eda.sys_Log.add("Detect busy place: " + JSON.stringify(busyPlace))

    const pageSize = await getPageSize();

    const pageCenter = {
        x: (pageSize.width - root.width) / 2,
        y: ((pageSize.height - root.height) / 2) + root.height
    };

    if (busyPlace) {
        const PADDING = 220;

        const positions = [
            // RIGHT
            {
                x: busyPlace.maxX + PADDING,
                y: ((pageSize.height - root.height) / 2) + root.height,
                name: 'RIGHT' as const
            },
            // BOTTOM
            {
                x: (pageSize.width - root.width) / 2,
                y: (-busyPlace.maxY) - PADDING,
                name: 'BOTTOM' as const
            },
            // TOP
            {
                x: (pageSize.width - root.width) / 2,
                y: (-(busyPlace.minY - root.height)) + PADDING,
                name: 'TOP' as const
            },
            // LEFT
            {
                x: busyPlace.minX - PADDING - root.width,
                y: ((pageSize.height - root.height) / 2) + root.height,
                name: 'LEFT' as const
            },
        ];

        const bestPosition = positions.reduce((best, current) => {

            const currentDist = Math.hypot(
                current.x - pageCenter.x,
                current.y - pageCenter.y
            );

            if (!best) return { pos: current, dist: currentDist };

            return currentDist < best.dist ? { pos: current, dist: currentDist } : best;
        }, null as { pos: typeof positions[0], dist: number } | null);

        offset.x = bestPosition!.pos.x;
        offset.y = bestPosition!.pos.y;
    }
    else {
        offset.x = pageCenter.x;
        offset.y = pageCenter.y;
    }

    return offset;
}

export async function assembleCircuit(circuit: CircuitAssembly) {
    eda.sys_Message.showToastMessage(`Assemble circuit...`, ESYS_ToastMessageType.INFO);
    eda.sys_Log.add(`Assemble circuit...`);

    const root = (circuit.blocks_rect ?? []).find(block => block.name === 'block___v_root__');

    if (!root) {
        eda.sys_Log.add(`Root not found in asm circuit`);
        throw new Error('Root not found in asm circuit')
    }

    if (eda.checkpointer) await eda.checkpointer.save(true);
    else {
        eda.sys_Log.add(`Checkpointer is null`);
        eda.sys_Message.showToastMessage(`Checkpointer is null`, ESYS_ToastMessageType.INFO);
    }

    const componentsOnSch = (await withTimeout(eda.sch_PrimitiveComponent.getAll(), 1500).catch(e => []))
        .filter(c => c.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT ||
            c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_PORT || c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_FLAG);

    const offset = await searchFreePlace(root, componentsOnSch);

    let { components, rm_components, edges, added_net } = circuit;

    let componentsAllowReplace: {
        component: CircuitAssembly['components'][0],
        replacer: Awaited<ReturnType<typeof ComponentReplacer>>
    }[] = [];

    let schematic: ExplainCircuit | undefined;

    if (rm_components) {
        // const primitivesId = await Promise.all(rm_components.map(async designator => {
        //     const component = await searchComponentInSCH(designator).catch(e => undefined);
        //     return component?.primitiveId;
        // }))

        // @ts-ignore
        schematic = await getSchematic(await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.COMPONENT), { disableExtractPartUuid: true });
        let componentsNotAllowReplace = circuit.components;

        const tasks = circuit.components.map(async component => {
            if (!rm_components!.includes(component.designator)) return;
            if (!component.part_uuid) return;

            const schComponent = schematic!.components.find(sc => sc.designator === component.designator);
            if (!schComponent) return;

            const schematicMap = new Map(
                schComponent.pins.map(p => [String(p.pin_number), p.signal_name])
            );

            const mismatches = component.pins.filter(cPin => {
                const sSignal = schematicMap.get(String(cPin.pin_number));
                return sSignal !== undefined && sSignal !== cPin.signal_name;
            });

            if (mismatches.length > 0) return;

            const primitive = await searchComponentInSCH(component.designator);
            if (!primitive) return;

            const replacer = await ComponentReplacer(primitive.component, component.part_uuid);

            const { cause, isAllow } = replacer.isAllow();

            if (!isAllow) {
                const msg = `Not allow replace componet "${component.designator}": ` + cause;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                return;
            }

            componentsAllowReplace.push({ component, replacer });
            componentsNotAllowReplace = componentsNotAllowReplace.filter(c => c.designator !== component.designator);
        });

        await Promise.all(tasks);

        if (componentsNotAllowReplace.length)
            componentsAllowReplace = componentsAllowReplace.filter(componentToRep => {
                let signals = componentToRep.component.pins.map(p => p.signal_name).filter(Boolean);
                signals = [...new Set(signals)];

                let signalsWithNotRep = componentsNotAllowReplace.flatMap(componentNotRep =>
                    componentNotRep.pins.filter(p => signals.includes(p.signal_name)).map(p => p.signal_name)
                );
                signalsWithNotRep = [...new Set(signalsWithNotRep)];

                if (!signalsWithNotRep.length) return true;

                const notAllowDesignators = [
                    ...componentsAllowReplace.map(c => c.component.designator),
                    ...componentsNotAllowReplace.map(c => c.designator)
                ]

                let signalsInAllComponents = schematic!.components
                    .filter(component => !notAllowDesignators.includes(component.designator))
                    .flatMap(component => component.pins.filter(p => signalsWithNotRep.includes(p.signal_name)).map(p => p.signal_name))
                    .filter(Boolean);;

                signalsInAllComponents = [...new Set(signalsInAllComponents)];

                if (signalsInAllComponents.length === signalsWithNotRep.length) {
                    return true;
                }

                componentToRep.replacer.cancel();

                return false;
            });
    }

    if (componentsAllowReplace.length) {
        const tasks = componentsAllowReplace.map(async ({ component, replacer }) => {
            if (!component.part_uuid) return;
            const primitive = await searchComponentInSCH(component.designator);
            if (!primitive) return;

            try {
                await replacer.replace();
                components = components.filter(c => c.designator !== component.designator);
                rm_components = rm_components!.filter(designator => designator !== component.designator);
                const pattern = component.designator + '_';
                edges = edges.filter(e => !e.sections.some(s => s.incomingShape?.includes(pattern) || s.outgoingShape?.includes(pattern)))
            } catch (error) {
                const msg = `Failed replace componet "${component.designator}": ` + (error as Error).message;
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                eda.sys_Log.add(msg);
            }
        });

        await Promise.all(tasks);

        components = components.filter(comp => {
            if (!(comp.designator.includes('|') && comp.designator.length > 4)) return true;
            const pattern = comp.designator + '_';
            return edges.some(e => e.sections.some(s => s.incomingShape?.includes(pattern) || s.outgoingShape?.includes(pattern)))
        });

        added_net = added_net?.filter(an => components.some(c => c.pins.some(p => p.signal_name === an.net)));
    }

    if (rm_components?.length && await confirmationMessage('The following components will be removed:\n' + rm_components.join(', '), 'Confirm deletion'))
        for (const designator of rm_components) {
            await removeComponent(designator, schematic).catch(e => {
                const msg = `Error with rm component ${designator}: ${(e as Error).message}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
            });
        }
    // Easyeda - slowly removes the components
    await new Promise<void>((resolve, reject) => setTimeout(resolve, Math.min((rm_components?.length ?? 10) * 50, 2000)));

    const placedComp = await placeComponents(components, offset);

    await drawEdges(edges, components, placedComp, offset);
    await drawRect(circuit.blocks_rect, offset);

    const isUsedPin = (d: string, p: number | string) => {
        const l = `${d}_pin_${p}`;
        if (edges.some(e => e.sections.some(s => s.incomingShape === l || s.outgoingShape === l))) {
            return true
        }
    }

    const netForUnusedPins: AddedNet[] = [];
    for (const component of components) {
        for (const pin of component.pins) {
            if (!isUsedPin(component.designator, pin.pin_number) && pin.signal_name.length) {
                netForUnusedPins.push({
                    designator: component.designator,
                    net: pin.signal_name,
                    pin_number: pin.pin_number,
                    pin_name: pin.name
                });
            }
        }
    }

    await placeNet(added_net ?? [], placedComp, true, componentsOnSch);
    await placeNet(netForUnusedPins, placedComp, false, componentsOnSch);

    eda.sys_Message.showToastMessage(`Assemble complete.`, ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`Assemble complete.`);
}
