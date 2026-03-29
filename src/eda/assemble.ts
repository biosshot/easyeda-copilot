import type { CircuitAssembly, ExplainCircuit } from "./../types/circuit";
import { searchFreePlaceV2 } from "./free-place-searcher";
import { placeComponent } from "./place-component";
import { ComponentReplacer } from "./replacer";
import { getShortSymPos, removeComponent } from "./rm-compoment-with-connections";
import { getSchematic } from "./schematic";
import { findPin, getPrimitiveComponentPins, hasDirectWire, searchComponentInSCH } from "./search";
import { AddedNet, ComponentToReplace, NET_PORT_COMPONENT, Offset, PlacedComponents, VCC_PORT_COMPONENT } from "./types";
import { chunkArray, getPageSize, rmPartFromDesignator, to2, withTimeout } from "./utils";

const applyOffset = (x: number, y: number, offset: Offset) => {

    if (offset.x) x = offset.x + x;
    if (offset.y) y = offset.y - y;

    return { x, y };
}

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
        }, { x, y, rotate: pos.rotate, subPartName: component.subPartName });

        comp.setState_Designator(designator);
    }

    return comp;
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

async function calculateTargetPlace(root: { width: number, height: number }, componentsAllowReplace: ComponentToReplace[],
    rm_components?: string[], added_net?: AddedNet[]) {
    const placeTarget = await getPageSize().then(pageSize => ({
        x: (pageSize.width - root.width) / 2,
        y: ((pageSize.height - root.height) / 2) + root.height,
    }))

    const getPrimitives = async () => {
        if (componentsAllowReplace.length) {
            return componentsAllowReplace
                .map(c => c.replacer.getNewPrimitive())
                .filter(Boolean);
        }

        const targets = rm_components?.length ? rm_components : (added_net?.length ? added_net.map(n => n.designator) : []);

        if (targets.length) {
            const results = await Promise.all(targets.map(id => searchComponentInSCH(id).catch(() => null)));
            return results.flatMap(r => r?.map(r => r.component) ?? []).filter(Boolean);
        }

        return [];
    };

    const primitives = await getPrimitives();

    if (primitives.length) {
        const sum = primitives.reduce((acc, p) => ({
            x: acc.x + p!.getState_X(),
            y: acc.y + p!.getState_Y()
        }), { x: 0, y: 0 });

        placeTarget.x = to2(sum.x / primitives.length);
        placeTarget.y = to2(sum.y / primitives.length);
    }

    // placeTarget.x -= root.width / 2;
    // placeTarget.y += root.height / 2;

    if (placeTarget.y === 0)
        placeTarget.y = 10;
    if (placeTarget.x === 0)
        placeTarget.x = 10;

    return placeTarget;
}

function getNetForUnusedPins(components: CircuitAssembly['components'], edges: CircuitAssembly['edges']) {
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

    return netForUnusedPins;
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

    let { components, rm_components, edges, added_net } = circuit;

    let componentsAllowReplace: ComponentToReplace[] = [];

    let schematic: ExplainCircuit | undefined;

    if (rm_components) {
        // @ts-ignore
        schematic = await getSchematic(await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.COMPONENT), { disableExtractPartUuid: true });
        let componentsNotAllowReplace = components;

        const tasks = components.map(async component => {
            const designator = rmPartFromDesignator(component.designator);
            if (!rm_components!.includes(designator)) {
                eda.sys_Log.add(`Replace not allow: "${designator}" not found in rm components: ${rm_components}`)
                return;
            }
            if (!component.part_uuid) {
                eda.sys_Log.add(`Replace not allow: "${designator}" not part_uuid`)
                return;
            }

            const schComponent = schematic!.components.find(sc => sc.designator === designator);
            if (!schComponent) {
                eda.sys_Log.add(`Replace not allow: "${designator}" not found in sch: ${schematic!.components.map(c => c.designator)}`)
                return;
            }

            const schematicMap = new Map(
                schComponent.pins.map(p => [String(p.pin_number), p.signal_name])
            );

            const mismatches = component.pins.filter(cPin => {
                const sSignal = schematicMap.get(String(cPin.pin_number));
                return sSignal !== undefined && sSignal !== cPin.signal_name;
            });

            if (mismatches.length > 0) {
                eda.sys_Log.add(`Replace not allow: "${designator}" found ${mismatches.length} mismatches`)
                return;
            }

            const primitives = await searchComponentInSCH(designator);
            if (!primitives || !primitives?.length) {
                eda.sys_Log.add(`Replace not allow: "${designator}" primitve not found`)
                return;
            }

            let primitive;

            if (primitives.length > 1)
                primitive = primitives.find(primitive => {
                    const id = component.subPartName?.split('.').at(-1);
                    const oldid = primitive.component.getState_SubPartName()?.split('.').at(-1);
                    return id && oldid && id === oldid;
                })
            else primitive = primitives[0];

            if (!primitive) return;

            const replacer = await ComponentReplacer(primitive.component, component.part_uuid, component.subPartName);

            const { cause, isAllow } = replacer.isAllow();

            if (!isAllow) {
                const msg = `Not allow replace componet "${designator}": ` + cause;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                return;
            }

            componentsAllowReplace.push({ component, replacer });
            componentsNotAllowReplace = componentsNotAllowReplace.filter(c => rmPartFromDesignator(c.designator) !== designator);
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
                    ...componentsAllowReplace.map(c => rmPartFromDesignator(c.component.designator)),
                    ...componentsNotAllowReplace.map(c => rmPartFromDesignator(c.designator))
                ]

                let signalsInAllComponents = schematic!.components
                    .filter(component => !notAllowDesignators.includes(rmPartFromDesignator(component.designator)))
                    .flatMap(component => component.pins.filter(p => signalsWithNotRep.includes(p.signal_name)).map(p => p.signal_name))
                    .filter(Boolean);

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
            const primitive = replacer.getOldPrimitive();
            if (!primitive) return;
            const designator = rmPartFromDesignator(component.designator);

            try {
                await replacer.replace();
                components = components.filter(c => rmPartFromDesignator(c.designator) !== designator);
                rm_components = rm_components!.filter(rmdesignator => rmdesignator !== designator);
                const pattern = new RegExp(`${designator}[_.]`);
                edges = edges.filter(e => !e.sections.some(s =>
                    pattern.test(s.incomingShape ?? '') || pattern.test(s.outgoingShape ?? '')
                ))
            } catch (error) {
                const msg = `Failed replace componet "${designator}": ` + (error as Error).message;
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                eda.sys_Log.add(msg);
            }
        });

        await Promise.all(tasks);

        components = components.filter(component => {
            const designator = rmPartFromDesignator(component.designator);
            if (!(designator.includes('|') && designator.length > 4)) return true;
            const pattern = new RegExp(`${designator}[_.]`);
            return edges.some(e =>
                e.sections.some(s =>
                    pattern.test(s.incomingShape ?? '') || pattern.test(s.outgoingShape ?? '')
                )
            );
        });

        added_net = added_net?.filter(an => components.some(c => c.pins.some(p => p.signal_name === an.net)));
    }

    const placeTarget = await calculateTargetPlace(root, componentsAllowReplace, rm_components, added_net);

    const offset = await searchFreePlaceV2(placeTarget, { w: root.width, h: root.height }, rm_components)
    eda.sys_Log.add(`Place at: ${JSON.stringify(offset)}`);

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

    const netForUnusedPins = getNetForUnusedPins(components, edges);

    await placeNet(added_net ?? [], placedComp, true, componentsOnSch);
    await placeNet(netForUnusedPins, placedComp, false, componentsOnSch);

    if (!rm_components?.length && !components.length && componentsAllowReplace.length) {
        const net = componentsAllowReplace[0].component.pins?.[0]?.signal_name;
        if (net) {
            const wire = await eda.sch_PrimitiveWire.getAll(net).then(w => w?.[0]);
            if (wire) {
                wire.done();
            }
        }
    }

    eda.sys_Message.showToastMessage(`Assemble complete.`, ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`Assemble complete.`);
}
