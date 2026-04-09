import type { ExplainCircuit } from '@copilot/shared/types/circuit';

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
    // 1. Получаем нетлист как строку
    eda.sys_Message.showToastMessage(`Please make sure there are no duplicate designators or go to Design -> Annotate Designator`, ESYS_ToastMessageType.INFO);

    const netlistText: string = await eda.sch_Netlist.getNetlist(ESYS_NetlistType.ALLEGRO);
    const pinToSignal = parseAllegroNetlist(netlistText);


    if (!primitiveIds) {
        primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
    }

    const componentsMap: Map<string, ExplainCircuit['components'][0] & { code?: string }> = new Map();

    for (const id of primitiveIds) {
        const primitiveComponent: ISCH_PrimitiveComponent_2 | undefined = await eda.sch_PrimitiveComponent.get(id).then(r => Array.isArray(r) ? r[0] : r).catch(err => null);

        if (!primitiveComponent || primitiveComponent.getState_PrimitiveType() !== ESCH_PrimitiveType.COMPONENT) {
            // eda.sys_Log.add(`[getSchematic] Error Processing component ${JSON.stringify(primitiveComponent)}`);
            continue;
        }

        const designator = primitiveComponent.getState_Designator() ?? '';

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
                y: primitiveComponent.getState_Y()
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