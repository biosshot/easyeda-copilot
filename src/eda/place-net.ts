import { placeComponent } from "./place-component";
import { getShortSymPos } from "./rm-compoment-with-connections";
import { findPin, hasDirectWire } from "./search";
import { AddedNet, NET_PORT_COMPONENT, PlacedComponents } from "./types";
import { withTimeout } from "./utils";

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

export async function placeNet(nets: AddedNet[], placeComponents: PlacedComponents, makePort: boolean) {
    if (!nets) return;

    // Конфигурация попыток: длины и базовые направления (dx, dy)
    // Направления: 0 - Вправо, 1 - Вниз (экранная Y), 2 - Влево, 3 - Вверх
    const trialLengths = [20, 40, 60, 80, 100];
    const trialPortOffsetLengths = [25, 35, 45, 55, 65];

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
            continue;
        }

        const pinCount = pin.pins?.[0]?.length ?? 10;

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
    };
}