import { CircuitAssembly } from "../types/circuit";
import { placeComponent } from "./place-component";
import { getShortSymPos, isPointOnSegment, rmWireFromComponentPin } from "./rm-compoment-with-connections";
import { findPin, hasDirectWire } from "./search";
import { AddedNet, NET_PORT_COMPONENT, PlacedComponents, RmNet } from "./types";
import { withTimeout } from "./utils";

// Конфигурация попыток: длины и базовые направления (dx, dy)
// Направления: 0 - Вправо, 1 - Вниз (экранная Y), 2 - Влево, 3 - Вверх
const trialLengths = [20, 30, 40, 60, 80, 100, 120, 140, 160, 180, 190, 210, 230, 10, 5];
const trialPortOffsetLengths = [15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145, 155, 165, 175, 185, 195, 205, 215].map(x => x - 5);

const directions = [
    { dx: 1, dy: 0, port_offset_y: -1 },   // rigth
    { dx: 0, dy: -1, port_offset_y: 0 },  // top
    { dx: -1, dy: 0, port_offset_y: -1 },  // left
    { dx: 0, dy: 1, port_offset_y: 0 },    // bottom
];

async function groupAndSortNetsByDesignator(nets: AddedNet[], placeComponents: PlacedComponents) {
    const grouped = new Map<string, AddedNet[]>();

    for (const net of nets) {
        const group = grouped.get(net.designator) || [];
        group.push(net);
        grouped.set(net.designator, group);
    }

    const result: AddedNet[][] = [];
    for (const group of grouped.values()) {
        // const sorted = [...group].sort((a, b) => {
        //     const aNum = typeof a.pin_number === 'number' ? a.pin_number : parseInt(a.pin_number, 10) || 0;
        //     const bNum = typeof b.pin_number === 'number' ? b.pin_number : parseInt(b.pin_number, 10) || 0;
        //     return aNum - bNum;
        // });
        // const pins = await findPin(group[0].designator, { num: group[0].pin_number }, placeComponents).then(p => p?.pins?.[0]).catch(e => undefined);
        // if (!pins) {
        //     eda.sys_Log.add(`Not found pins for sort ${group[0].designator}`)
        const sorted = group.toSorted((a, b) => {
            const aNum = typeof a.pin_number === 'number' ? a.pin_number : parseInt(a.pin_number, 10) || 0;
            const bNum = typeof b.pin_number === 'number' ? b.pin_number : parseInt(b.pin_number, 10) || 0;
            return aNum - bNum;
        });
        result.push(sorted);
        // }
        // else {
        //     const sorted = group.toSorted((a, b) => {
        //         const aNum = pins.find(p => p.getState_PinNumber() === a.pin_number)?.getState_Y() || 0;
        //         const bNum = pins.find(p => p.getState_PinNumber() === b.pin_number)?.getState_Y() || 0;
        //         return aNum - bNum;
        //     });
        //     result.push(sorted);
        // }
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

async function place(group: AddedNet[], myIndex: number, placeComponents: PlacedComponents, makePort: boolean) {
    const net: AddedNet = group[myIndex];

    const pin = await findPin(net.designator, { num: net.pin_number, name: net.pin_name }, placeComponents);
    if (!pin) {
        const msg = `Not found pin in placenet: ${net.designator} ${net.pin_number}`;
        eda.sys_Log.add(msg);
        eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
        return;
    }

    if (myIndex > 0 && pin.pins[0]?.length) {
        const eqNet = group.slice(0, myIndex).filter(n => n.net === net.net && n.designator === net.designator);
        if (!eqNet.length)
            eda.sys_Log.add(`Fail merget wire not found eqNet ${net.designator} ${net.net}`);
        const notEqNet = group.filter(n => n.net !== net.net && n.designator === net.designator);

        const pinsInEqNet = pin.pins[0].filter(p => eqNet.some(n => n.pin_number === p.getState_PinNumber()))
        const pinsNotInEqNet = pin.pins[0].filter(p => notEqNet.some(n => n.pin_number === p.getState_PinNumber()))

        for (const prevNet of eqNet) {
            const prevPin = pinsInEqNet.find(p => p.getState_PinNumber() === prevNet.pin_number);
            if (!prevPin) {
                eda.sys_Log.add(`Fail merget wire not found prevPin ${net.designator} ${net.net}`);
                continue;
            }

            const myPinX = pin.pin.getState_X();
            const myPinY = pin.pin.getState_Y();
            const prevPinX = prevPin.getState_X();
            const prevPinY = prevPin.getState_Y();
            if (prevPinX !== myPinX && prevPinY !== myPinY) continue;
            if (prevPin.getState_Rotation() !== pin.pin.getState_Rotation()) {
                eda.sys_Log.add(`Fail merget wire rotation not eq ${net.designator} ${net.net}`);
                continue;
            }

            const hasOtherPointOnLine = pinsNotInEqNet
                // .filter(p => p.getState_PinNumber() !== prevPin.getState_PinNumber() && p.getState_PinNumber() !== pin.pin.getState_PinNumber())
                .some(p => isPointOnSegment({ x: p.getState_X(), y: p.getState_Y() },
                    {
                        start: {
                            x: myPinX,
                            y: myPinY,
                        },
                        end: {
                            x: prevPinX,
                            y: prevPinY
                        },
                        originalIndex: -1
                    },
                ));

            if (hasOtherPointOnLine) {
                eda.sys_Log.add(`Fail merget wire has pin on line ${net.designator} ${net.net}`)
                continue;
            }

            const line = [myPinX, myPinY, prevPinX, prevPinY];

            try {
                const wire = await eda.sch_PrimitiveWire.create(line, net.net);
                if (wire) {
                    // eda.sys_Log.add(`Create merget wire between ${net.designator} ${net.net} ${JSON.stringify(line)}`)
                    return;
                }
                else {
                    eda.sys_Log.add(`Failded create merget wire between ${net.designator} ${net.net} ${JSON.stringify(line)}`)
                }
            } catch (err) {
                eda.sys_Log.add(`Failded create merget wire between ${net.designator} ${net.net} ${JSON.stringify(line)}`)
            }
        }
    }
    else {
        eda.sys_Log.add(`Fail merget wire not this first net ${net.designator} ${net.net}`);
    }

    let makePortForThis = makePort;

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
    const groups = await groupAndSortNetsByDesignator(nets, placeComponents);

    for (const group of groups) {
        for (let index = 0; index < group.length; index++) {
            const net = group[index];
            await place(group, index, placeComponents, makePort)
        }
    };
}

export async function rmNet(nets: RmNet[], placeComponents: PlacedComponents) {
    for (const net of nets) {
        await rmWireFromComponentPin(net.designator, net.pin_number, net.net).catch(e => {
            const msg = `Failded rm net from: ${net.designator} ${net.pin_number}`;
            eda.sys_Log.add(msg);
            eda.sys_Message.showToastMessage(msg, ESYS_ToastMessageType.ERROR);
        });
    }
}