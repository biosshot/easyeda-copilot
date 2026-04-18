import { CircuitAssembly, ExplainCircuit } from "@copilot/shared/types/circuit";
import { searchFreePlaceV2 } from "./free-place-searcher";
import { placeComponent } from "./place-component";
import { placeNet, rmNet } from "./place-net";
import { ComponentReplacer } from "./replacer";
import { getShortSymPos, removeComponent } from "./rm-compoment-with-connections";
import { getSchematic } from "./schematic";
import { findPin, getPrimitiveComponentPins, hasDirectWire, searchComponentInSCH } from "./search";
import { AddedNet, ComponentToReplace, GND_PORT_COMPONENT, NET_PORT_COMPONENT, Offset, PlacedComponents, VCC_PORT_COMPONENT } from "./types";
import { chunkArray, getPageSize, rmPartFromDesignator, to2, withTimeout } from "./utils";
import PQueue from 'p-queue';

const assembleQueue = new PQueue({ concurrency: 1 });

const applyOffset = (x: number, y: number, offset: Offset) => {

    if (offset.x) x = offset.x + x;
    if (offset.y) y = offset.y - y;

    return { x, y };
}

async function createComponet(component: CircuitAssembly['components'][0], offset: Offset = { x: 0, y: 0 }) {
    let comp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1 | undefined;
    const { part_uuid: partUuid, designator, pos } = component;
    if (!partUuid) throw new Error("createComponet partUuid not found");

    const { x, y } = applyOffset(pos.x + (pos.center?.x ?? (pos.width / 2)), (pos.y + (pos.center?.y ?? (pos.height / 2))), offset)

    if (partUuid === 'GND') {
        comp = await placeComponent(GND_PORT_COMPONENT, { x, y, rotate: pos.rotate });

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
        }, { x, y, rotate: pos.rotate, subPartName: component.sub_part_name });

        comp.setState_Designator(rmPartFromDesignator(designator));
    }

    eda.sys_Log.add(`Place component ${designator} ${partUuid} at ${x} ${y} rot: ${pos.rotate}`)

    return comp;
}

async function placeComponents(components: CircuitAssembly['components'], offset: Offset = { x: 0, y: 0 }): Promise<PlacedComponents> {
    const placedComponentsP = components.map(async (component) => {
        const { part_uuid: partUuid, designator } = component;
        if (!partUuid) return undefined;

        try {
            const placedComponent: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1 = await createComponet(component, offset);
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
                // await wire?.done();
            } catch (err) {
                const msg = `Wire error: ${(err as Error).message} ${JSON.stringify(values)} ${netName} ${section.incomingShape} -> ${section.outgoingShape};\n` +
                    `- srcpin: ${srcpin?.component?.getState_Designator?.()}; trgpin: ${trgpin?.component?.getState_Designator?.()}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
            }
        }
    }

}

async function drawRect(blocksRect: CircuitAssembly['blocks_rect'], offset: Offset = { x: 0, y: 0 }) {

    for (const block of blocksRect ?? []) {
        try {
            if (block.name === 'block___v_root__') continue;
            const padding = 5;

            const { x, y } = applyOffset(block.x - padding, block.y - padding, offset)

            const rect = await eda.sch_PrimitiveRectangle.create(x, y, block.width + (padding * 2), block.height + (padding * 2), 2);

            const descArr = chunkArray(block.description.split(' '), 8).map(arr => arr.join(' '))
            const desc = descArr.join('\n');

            const text = await eda.sch_PrimitiveText.create(x, y + 3 + (5 * descArr.length), desc, undefined, undefined, undefined, 5)
            const text_2 = await eda.sch_PrimitiveText.create(x, y + 18 + (5 * descArr.length), block.name, undefined, undefined, undefined, 14);

        } catch (error) {
            // pass
        }
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
        if (edges.some(e => e.sections?.some(s => s.incomingShape === l || s.outgoingShape === l))) {
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

async function assembleCircuitTask(circuit: CircuitAssembly) {
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

    let { components, rm_components, edges, added_net } = circuit;

    const componentsAllowReplace: ComponentToReplace[] = [];

    let schematic: ExplainCircuit | undefined;

    if (circuit.replace_components) {
        // @ts-ignore
        const tasks = circuit.replace_components.map(async designator => {
            designator = rmPartFromDesignator(designator);
            const componentsToRep = components.filter(c => rmPartFromDesignator(c.designator) === designator).filter(c => c.part_uuid);

            if (!componentsToRep.length) {
                eda.sys_Log.add(`Replace not allow: "${designator}" not found in components: ${components.map(c => c.designator)}`)
                return;
            }

            const primitives = await searchComponentInSCH(designator);
            if (!primitives || !primitives?.length) {
                eda.sys_Log.add(`Replace not allow: "${designator}" primitve not found`)
                return;
            }

            for (const component of componentsToRep) {
                if (!component.part_uuid) {
                    eda.sys_Log.add(`Replace not allow: "${designator}" not found part_uuid`)
                    return;
                }

                let primitive;

                if (primitives.length > 1) {
                    const id = component.sub_part_name?.split('.').at(-1);
                    primitive = primitives.find(primitive => {
                        const oldid = primitive.component.getState_SubPartName()?.split('.').at(-1);
                        return id && oldid && id === oldid;
                    })
                }
                else primitive = primitives[0];

                if (!primitive) {
                    eda.sys_Log.add(`Not found part: "${designator}" ${component.sub_part_name}`)
                    return;
                }

                const replacer = await ComponentReplacer(primitive.primitiveId, primitive.component, component);

                const { cause, isAllow } = replacer.isAllow();

                if (!isAllow) {
                    const msg = `Not allow replace componet "${designator}": ` + cause;
                    eda.sys_Log.add(msg);
                    eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                    return;
                }

                componentsAllowReplace.push({ component, replacer });
            }
        });

        await Promise.all(tasks);
    }

    if (componentsAllowReplace.length) {
        const tasks = componentsAllowReplace.map(async ({ component, replacer }) => {
            if (!component.part_uuid) return;
            const primitive = replacer.getOldPrimitive();
            if (!primitive) return;
            const designator = rmPartFromDesignator(component.designator);

            try {
                await replacer.replace();
                eda.sys_Log.add(`Replace ok: "${designator}"`);

                components = components.filter(c => rmPartFromDesignator(c.designator) !== designator);
                rm_components = rm_components!.filter(rmdesignator => rmPartFromDesignator(rmdesignator) !== designator);
                // @ts-ignore
                const pattern = new RegExp(`${RegExp.escape(designator)}[_.]`);
                edges = edges.filter(e => !e.sections?.some(s =>
                    pattern.test(s.incomingShape ?? '') || pattern.test(s.outgoingShape ?? '')
                ))

                if (!added_net) added_net = [];

                for (const pin of component.pins) {
                    if (!pin.signal_name) continue;
                    added_net.push({
                        designator,
                        net: pin.signal_name,
                        pin_number: pin.pin_number
                    })
                }
            } catch (error) {
                const msg = `Failed replace componet "${designator}": ` + (error as Error).message;
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.WARNING);
                eda.sys_Log.add(msg);
            }
        });

        eda.sys_Log.add('Replace start...')
        await Promise.all(tasks);
        eda.sys_Log.add('Replace done')

        components = components.filter(component => {
            const designator = rmPartFromDesignator(component.designator);
            if (!(designator.includes('|') && designator.length > 4)) return true;
            // @ts-ignore
            const pattern = new RegExp(`${RegExp.escape(designator)}[_.]`);
            return edges.some(e =>
                e.sections?.some?.(s =>
                    pattern.test(s.incomingShape ?? '') || pattern.test(s.outgoingShape ?? '')
                )
            );
        });

        added_net = added_net?.filter(an => components.some(c => c.pins.some(p => p.signal_name === an.net)));
    }

    const placeTarget = await calculateTargetPlace(root, componentsAllowReplace, rm_components, added_net);

    const offset = await searchFreePlaceV2(placeTarget, { w: root.width, h: root.height })
    eda.sys_Log.add(`Place at: ${JSON.stringify(offset)}`);

    if (rm_components?.length && await confirmationMessage('The following components will be removed:\n' + rm_components.join(', '), 'Confirm deletion')) {
        const addAddedNet = [];
        for (const designator of rm_components) {
            const added = await removeComponent(designator, schematic).catch(e => {
                const msg = `Error with rm component ${designator}: ${(e as Error).message}; ${(e as Error).stack}`;
                eda.sys_Log.add(msg);
                eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
                return [];
            });

            addAddedNet.push(...added);
        }

        if (!added_net) added_net = addAddedNet;
        else added_net = [...added_net, ...addAddedNet];
    }

    const placedComp = await placeComponents(components, offset);

    await drawEdges(edges, components, placedComp, offset);
    if (circuit.assembly_options?.draw_blocks)
        await drawRect(circuit.blocks_rect, offset);

    const netForUnusedPins = getNetForUnusedPins(components, edges);

    await new Promise<void>((resolve, reject) => setTimeout(resolve, Math.min((edges?.length ?? 10) * 50, 2000)));

    const needAddNet = await rmNet(circuit.rm_net ?? [], placedComp);

    if (!added_net) added_net = needAddNet;
    else added_net = [...added_net, ...needAddNet];

    await placeNet(added_net ?? [], placedComp, true);
    await placeNet(netForUnusedPins, placedComp, true);

    await new Promise<void>((resolve, reject) => setTimeout(resolve, 500));

    eda.sys_Message.showToastMessage(`Assemble complete.`, ESYS_ToastMessageType.SUCCESS);
    eda.sys_Log.add(`Assemble complete.`);
}

export function assembleCircuit(...args: Parameters<typeof assembleCircuitTask>) {
    return assembleQueue.add(() => assembleCircuitTask(...args))
}