import type { CircuitWithPos } from "./types/circuit";

const to2 = (x: number) => { x = Math.round(x); return x - (x % 5); }

function chunkArray(arr: any[], size: number) {
    const chunkedArr = [];
    for (let i = 0; i < arr.length; i += size) {
        chunkedArr.push(arr.slice(i, i + size));
    }
    return chunkedArr;
}

async function createComponet(component: CircuitWithPos['components'][0], offset = { x: 0, y: 0 }) {
    let comp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;
    const { part_uuid: partUuid, designator, pos } = component;
    if (!partUuid) throw new Error("createComponet partUuid not found");

    const create = async (data: { libraryUuid: string, uuid: string }) => {
        const comp = await eda.sch_PrimitiveComponent.create(data,
            to2(offset.x + pos.x + (pos.center?.x ?? (pos.width / 2))),
            to2(offset.y - (pos.y + (pos.center?.y ?? (pos.height / 2)))),
            undefined, pos.rotate
        );

        if (!comp) throw new Error("Component not found");
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

async function placeComponents(components: CircuitWithPos['components'], offset = { x: 0, y: 0 }) {
    const placedComponentsP = components.map(async (component) => {
        const { part_uuid: partUuid, designator } = component;
        if (!partUuid) return;

        try {
            const placedComponent: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 = await createComponet(component, offset);

            const primitive_id = placedComponent.getState_PrimitiveId();

            const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitive_id);
            if (!pins) throw new Error("Pins not found");

            const sortedPins = pins.sort((a, b) => {
                const aNum = Number(a.getState_PinNumber());
                const bNum = Number(b.getState_PinNumber());
                return aNum - bNum;
            });

            await placedComponent.done();

            return { primitive_id, pins: sortedPins, designator };
        } catch (err) {
            eda.sys_Message.showToastMessage(`Component error ${designator}: ${(err as any).message}`, ESYS_ToastMessageType.ERROR);
            return null;
        }
    });

    const placedComponents = await Promise.all(placedComponentsP);

    // @ts-ignore
    return Object.fromEntries(placedComponents.filter(Boolean).map((component) => [component.designator, component]));
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

async function drawEdges(edges: CircuitWithPos['edges'], components: CircuitWithPos['components'], placeComponents: any, offset = { x: 0, y: 0 }) {
    const pointToArr = (p: any) => [offset.x + p.x, -(offset.y - p.y)];

    const findPin = (designator: string, pin: any) => {
        pin = Number(pin);
        const pins = placeComponents[designator]?.pins || [];
        if (pin === 1 && pins.length === 1) return pins[0];
        return pins.find((p: any) => Number(p.getState_PinNumber()) === pin);
    };

    for (const edge of edges) {
        for (const section of edge.sections) {
            const [sdesignator, spin] = section.incomingShape.split("_pin_");
            const [tdesignator, tpin] = section.outgoingShape.split("_pin_");

            const signalName = components
                .find(comp => comp.designator === sdesignator)?.pins?.find(p => Number(spin) === Number(p.pin_number))?.signal_name ?? "";
            const netName = signalName?.toUpperCase?.();

            const srcpin = findPin(sdesignator, spin);
            const trgpin = findPin(tdesignator, tpin);
            if (!srcpin || !trgpin) {
                if (!srcpin)
                    eda.sys_Message.showToastMessage(`Wire error not found pin: ${sdesignator} ${spin}`, ESYS_ToastMessageType.ERROR);
                if (!trgpin)
                    eda.sys_Message.showToastMessage(`Wire error not found pin: ${tdesignator} ${tpin}`, ESYS_ToastMessageType.ERROR);

                continue;
            }

            const srcpx = srcpin.getState_X();
            const srcpy = srcpin.getState_Y();
            const trgpx = trgpin.getState_X();
            const trgpy = trgpin.getState_Y();

            let values: number[] = [srcpx, srcpy];

            if ("bendPoints" in section) {
                for (const bend of section.bendPoints) {
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
                await eda.sch_PrimitiveWire.create(values, netName);
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

export async function assembleCircuit(circuit: CircuitWithPos) {
    eda.sys_Message.showToastMessage(`Assemble circuit...`, ESYS_ToastMessageType.INFO);
    const pageSize = await getPageSize();
    const root = (circuit.blocks_rect ?? []).find(block => block.name === 'block___v_root__');

    const offset = { x: 0, y: 0 };

    if (root) {
        offset.x = (pageSize.width - root.width) / 2;
        offset.y = ((pageSize.height - root.height) / 2) + root.height;
    }

    const placedComp = await placeComponents(circuit.components, offset);

    await drawEdges(circuit.edges, circuit.components, placedComp, offset);

    for (const block of circuit.blocks_rect ?? []) {
        if (block.name === 'block___v_root__') continue;
        const padding = 5;

        const y = offset.y - (block.y - padding);
        const x = offset.x + block.x - padding;

        await eda.sch_PrimitiveRectangle.create(x, y, block.width + (padding * 2), block.height + (padding * 2), 2);

        const descArr = chunkArray(block.description.split(' '), 8).map(arr => arr.join(' '))
        const desc = descArr.join('\n');

        await eda.sch_PrimitiveText.create(x, y + 3 + (5 * descArr.length), desc, undefined, undefined, undefined, 5)

        await eda.sch_PrimitiveText.create(x, y + 18 + (5 * descArr.length), block.name, undefined, undefined, undefined, 14);

    }

    eda.sys_Message.showToastMessage(`Assemble complete.`, ESYS_ToastMessageType.SUCCESS);
}
