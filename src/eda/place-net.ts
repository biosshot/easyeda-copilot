import { placeComponent } from "./place-component";
import { getShortSymPos } from "./rm-compoment-with-connections";
import { findPin, hasDirectWire } from "./search";
import { AddedNet, NET_PORT_COMPONENT, PlacedComponents } from "./types";
import { withTimeout } from "./utils";

// Конфигурация попыток: длины и базовые направления (dx, dy)
// Направления: 0 - Вправо, 1 - Вниз (экранная Y), 2 - Влево, 3 - Вверх
const trialLengths = [20, 40, 60, 80, 100];
const trialPortOffsetLengths = [25, 35, 45, 55, 65, 75, 85];

const directions = [
    { dx: 1, dy: 0, port_offset_y: -1 },   // rigth
    { dx: 0, dy: -1, port_offset_y: 0 },  // top
    { dx: -1, dy: 0, port_offset_y: -1 },  // left
    { dx: 0, dy: 1, port_offset_y: 0 },    // bottom
];

function groupAndSortNetsByDesignator(nets: AddedNet[]): AddedNet[][] {
    const grouped = new Map<string, AddedNet[]>();

    for (const net of nets) {
        const group = grouped.get(net.designator) || [];
        group.push(net);
        grouped.set(net.designator, group);
    }

    const result: AddedNet[][] = [];
    for (const group of grouped.values()) {
        const sorted = [...group].sort((a, b) => {
            const aNum = typeof a.pin_number === 'number' ? a.pin_number : parseInt(a.pin_number, 10) || 0;
            const bNum = typeof b.pin_number === 'number' ? b.pin_number : parseInt(b.pin_number, 10) || 0;
            return aNum - bNum;
        });
        result.push(sorted);
    }

    return result;
}

const checkNeedMakePort = async (simComps: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[], pin: ISCH_PrimitiveComponentPin, net: string) => {
    if (simComps.length) {
        const shortSymsPos = await Promise.all(simComps.map(simComp => getShortSymPos(simComp))).catch(e => undefined);

        if (shortSymsPos) {
            for (const pos of shortSymsPos) {
                if (!pos) continue;

                const hasDirect = await hasDirectWire(net, { x: pin.getState_X(), y: pin.getState_Y() }, { x: pos.pinX, y: pos.pinY }).catch(r => null);
                if (hasDirect === true) {
                    return false;
                }
            }
        }
    }

    return true;
}

async function place(net: AddedNet, placeComponents: PlacedComponents, makePort: boolean) {
    let makePortForThis = makePort;

    const pin = await findPin(net.designator, { num: net.pin_number, name: net.pin_name }, placeComponents);
    if (!pin) {
        const msg = `Not found pin in placenet: ${net.designator} ${net.pin_number}`;
        eda.sys_Log.add(msg);
        eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
        return;
    }

    let simComps: (ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2)[] | undefined;

    if (makePortForThis) {
        simComps = (await withTimeout(eda.sch_PrimitiveComponent.getAll(), 1500).catch(e => []))
            .filter(c => c.getState_Net() === net.net || c.getState_OtherProperty()?.['Global Net Name'] === net.net &&
                (c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_FLAG || c.getState_ComponentType() === ESCH_PrimitiveComponentType.NET_PORT));

        if (simComps.length) {
            if (!(await checkNeedMakePort(simComps, pin.pin, net.net))) {
                makePortForThis = false
            }
        }
    }

    if (makePort && !makePortForThis) {
        eda.sys_Log.add(`Signal exits: ${JSON.stringify(net)}`);
        return;
    }

    const pinCount = pin.pins?.[0]?.length ?? 10;

    const pinX = pin.pin.getState_X();
    const pinY = pin.pin.getState_Y();
    const rot = pin.pin.getState_Rotation();

    // Получаем все пины компонента для проверки коллизий
    const allComponentPins = pin.pins?.[0] ?? [];

    // Функция проверки коллизии: возвращает true, если endY совпадает с Y любого пина компонента
    const hasPinCollision = (checkY: number) => {
        return allComponentPins.some(p => p.getState_Y() === checkY && p.getState_PinNumber() != net.pin_number && p.getState_Rotation() === rot);
    };

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

        const portMakeVariants = makePortForThis ? [makePortForThis, !makePortForThis] : [false];

        for (const makePortForThis__ of portMakeVariants) {
            if (wireCreated) break;
            makePortForThis = makePortForThis__;

            // Внутренний цикл по направлениям
            for (const wireLength of trialLengths) {
                if (wireCreated) break;

                let portOffsets = makePortForThis__ ? trialPortOffsetLengths : [0];
                if (dir.port_offset_y === 0) {
                    portOffsets = [0];
                }

                for (const portOffsetLen of portOffsets) {
                    if (wireCreated) break;

                    endX = pinX + dir.dx * wireLength;
                    endY = pinY + dir.dy * wireLength;
                    endYPort = endY + dir.port_offset_y * portOffsetLen;

                    // Проверка коллизии: endY не должен совпадать с Y любого пина компонента
                    if (hasPinCollision(endYPort)) {
                        continue;
                    }

                    try {
                        const wire = await eda.sch_PrimitiveWire.create([pinX, pinY, endX, endY, endX, endYPort], net.net);
                        if (wire) {
                            wireCreated = true;
                            break;
                        }
                    } catch (err) {
                        // pass
                    }
                }
            }
        }
    }

    if (simComps?.length) {
        if (!await checkNeedMakePort(simComps, pin.pin, net.net)) {
            makePortForThis = false
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

export async function placeNet(nets: AddedNet[], placeComponents: PlacedComponents, makePort: boolean) {
    const groups = groupAndSortNetsByDesignator(nets);

    for (const group of groups) {
        for (const net of group) {
            await place(net, placeComponents, makePort)
        }
    };
}