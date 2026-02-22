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