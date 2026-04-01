import { PlacedComponents } from "./types";
import { rmPartFromDesignator, to2 } from "./utils";

export const searchComponentInSCH = async (designator: string) => {
    designator = rmPartFromDesignator(designator);

    // @ts-ignore
    const promIdComponent = await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.COMPONENT);
    const components = await eda.sch_PrimitiveComponent.get(promIdComponent);
    const found = [];

    for (let index = 0; index < components.length; index++) {
        const component = components[index];
        if (rmPartFromDesignator(component.getState_Designator()?.trim() ?? '') === designator)
            found.push({ component, primitiveId: promIdComponent[index] });
    }

    return found.length ? found : undefined;
}

export async function getPrimitiveComponentPins(id: string) {
    const pins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(id);
    if (!pins) throw new Error("Pins not found");

    return pins.sort((a, b) => {
        const aNum = Number(a.getState_PinNumber());
        const bNum = Number(b.getState_PinNumber());
        return aNum - bNum;
    });
}

const fuzzyRound = (x: number, y: number) => {
    return Math.abs(x - y) < 10;
}

export async function getAllPrimitivePins() {
    const promIdComponent = await eda.sch_PrimitiveComponent.getAllPrimitiveId().catch(e => []);
    const pins = await Promise.allSettled(promIdComponent.map(async id => ({ primitiveId: id, pins: (await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(id))! })));
    return pins.filter(result => result.status === 'fulfilled').map(result => result.value!).filter(item => item.pins);
}

export async function hasDirectWire(net: string, p1: { x: number, y: number }, p2: { x: number, y: number }) {
    const wires = await eda.sch_PrimitiveWire.getAll(net);

    for (const wire of wires) {
        const lineRaw = wire.getState_Line()

        const wireData = (Array.isArray(lineRaw[0]) ? lineRaw : [lineRaw]) as number[][];

        const hasP1 = wireData.find(w => w.find((v, i) => i % 2 === 0 ? fuzzyRound(v, p1.x) && fuzzyRound(w[i + 1], p1.y) : false))
        const hasP2 = wireData.find(w => w.find((v, i) => i % 2 === 0 ? fuzzyRound(v, p2.x) && fuzzyRound(w[i + 1], p2.y) : false))

        if (hasP1 && hasP2) return true
    }

    return false
}

export const findPin = async (designator: string, pin_: { num: number | string, name?: string }, placeComponents: PlacedComponents, useSchComps = true) => {
    const pinNumber = pin_.num;
    designator = rmPartFromDesignator(designator);

    let pins: ISCH_PrimitiveComponentPin[][] = [];
    let isExternal = false;
    let components: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined)[] = [];

    await Promise.all(Object.entries(placeComponents).map(async ([pdesignator, placedComp]) => {
        pdesignator = rmPartFromDesignator(pdesignator);

        if (pdesignator === designator) {
            const c = await eda.sch_PrimitiveComponent.get(placedComp.primitive_id);
            components.push(c);
            pins.push(placedComp.pins);
        }
    }));

    if (useSchComps && !pins.length) {
        isExternal = true;
        components = (await searchComponentInSCH(designator).then(c => c?.map(c => c.component))) ?? [];
        pins = components ? await Promise.all(components.map(c => getPrimitiveComponentPins(c?.getState_PrimitiveId() ?? ''))) : []
    }

    let pin: ISCH_PrimitiveComponentPin | undefined;
    let component: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;

    if (pinNumber == 1 && pins.length === 1 && pins[0].length === 1) { pin = pins[0][0]; component = components[0]; }
    else {
        for (let index = 0; index < pins.length; index++) {
            component = components[index];
            pin = pins[index].find(p => p.getState_PinNumber() == pinNumber);
            if (pin) break;
        }
    }
    if (!pin && pin_.name) {
        for (let index = 0; index < pins.length; index++) {
            component = components[index];
            pin = pins[index].find(p => p.getState_PinName() == pin_.name);
            if (pin) break;
        }
    }

    if (!pin) return null;

    return { pin: pin, isExternal, component, pins };
};