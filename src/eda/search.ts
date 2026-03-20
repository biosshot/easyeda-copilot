export const searchComponentInSCH = async (designator: string) => {
    designator = designator.trim();
    // @ts-ignore
    const promIdComponent = await eda.sch_PrimitiveComponent.getAllPrimitiveId(ESCH_PrimitiveComponentType.COMPONENT);
    const components = await eda.sch_PrimitiveComponent.get(promIdComponent);

    for (let index = 0; index < components.length; index++) {
        const component = components[index];
        if (component.getState_Designator()?.trim() === designator)
            return { component, primitiveId: promIdComponent[index] };
    }

    return undefined;
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

export async function hasDirectWire(net: string, p1: { x: number, y: number }, p2: { x: number, y: number }) {
    const wires = await eda.sch_PrimitiveWire.getAll(net);

    for (const wire of wires) {
        const lineRaw = wire.getState_Line()

        const wireData = (Array.isArray(lineRaw[0]) ? lineRaw : [lineRaw]) as number[][];

        const hasP1 = wireData.find(w => w.find((v, i) => i % 2 === 0 ? v === p1.x && w[i + 1] === p1.y : false))
        const hasP2 = wireData.find(w => w.find((v, i) => i % 2 === 0 ? v === p2.x && w[i + 1] === p2.y : false))

        if (hasP1 && hasP2) return true
    }

    return false
}