// @ts-ignore
import type _ from '@jlceda/pro-api-types';
import type { ExplainCircuit } from '../types/circuit';

// Безопасное извлечение чисел из строк
function safeParseInt(str: string, fallback = 0): number {
    const num = parseInt(str, 10);
    return isNaN(num) ? fallback : num;
}

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

export async function getSchematic(primitiveIds?: string[]) {
    try {
        // 1. Получаем нетлист как строку
        const netlistText: string = await eda.sch_Netlist.getNetlist(ESYS_NetlistType.ALLEGRO);
        const pinToSignal = parseAllegroNetlist(netlistText);
        console.log("[getSchematic] Parsed netlist, total pins:", pinToSignal.entries());

        const explainCircuit: ExplainCircuit = { components: [] };

        if (!primitiveIds) {
            primitiveIds = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
        }

        for (const id of primitiveIds) {
            let prim: any = await eda.sch_Primitive.getPrimitiveByPrimitiveId(id);

            if (!prim || prim.getState_PrimitiveType() !== ESCH_PrimitiveType.COMPONENT) {
                console.error(`[getSchematic] Error Processing component`, prim);
                continue;
            }

            const designator = (prim as any).designator || '';

            if (!designator.trim()) {
                console.error(`[getSchematic] Error Processing component`);
                continue;
            }

            let value: string | null = null;

            if (prim.name.includes("Manufacturer Part")) {
                value = prim.manufacturerId;
            }
            else if (prim.name.includes("Value")) {
                value = prim.otherProperty.Value;
            }
            else if (prim.name[0] !== '=') {
                value = prim.name;
            }

            if (!value) {
                value = prim.manufacturerId || '';
            }

            const pins = [];

            console.log(`[getSchematic] Processing component: ${designator}, Value: ${value}`);
            const rawPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(prim.primitiveId)

            if (Array.isArray(rawPins)) {
                for (const p of rawPins) {
                    const rawNum = p.getState_PinNumber();
                    const pinNumber = safeParseInt(rawNum, 0);
                    const pinName = p.getState_PinName();

                    // Сопоставление: "R7.1" → сигнал
                    const pinRef = `${designator}.${pinNumber}`;
                    const signalName = pinToSignal.get(pinRef) || '';
                    console.log(`[getSchematic]   Pin: ${pinRef}, Name: ${pinName}, Signal: ${signalName}`);

                    pins.push({
                        pin_number: pinNumber,
                        name: pinName,
                        signal_name: signalName,
                    });
                }
            }

            explainCircuit.components.push({
                designator,
                value: value ?? 'none',
                pins,
                part_uuid: await eda.lib_Device.search(prim.supplierId).then(devices => devices?.[0].uuid).catch(() => null) ?? null,
            });
        }

        return explainCircuit;
    } catch (error) {
        console.error('[extractSchematicData] Error:', error);
        throw error;
    }
}