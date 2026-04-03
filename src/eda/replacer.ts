import { CircuitAssembly } from "../types/circuit";
import { placeComponent } from "./place-component";
import { getSchematic } from "./schematic";
import { searchComponentInSCH } from "./search";

const rotatePoint = (p: { x: number, y: number }, rotate: number) => {
    const radians = -rotate * (Math.PI / 180);
    const rotateMatrix = [
        [Math.cos(radians), -Math.sin(radians)],
        [Math.sin(radians), Math.cos(radians)]]

    return {
        x: Math.round(rotateMatrix[0][0] * p.x + rotateMatrix[0][1] * p.y),
        y: Math.round(rotateMatrix[1][0] * p.x + rotateMatrix[1][1] * p.y)
    }
}

const validLine = (values: number[][]) => {
    for (let i = 0; i < values.length; i++) {

        if (values[i][0] !== values[i][2] && values[i][1] !== values[i][3])
            return false;

        if (values.length <= i + 1) continue;

        const hasP1 = values[i][2] === values[i + 1][0] || values[i][3] === values[i + 1][1];
        const hasP2 = values[i][2] === values[i + 1][2] || values[i][3] === values[i + 1][3];

        if (!hasP1 && !hasP2)
            return false;
    }
    return true
}

export async function ComponentReplacer(primitiveId: string, primrive: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2, component: CircuitAssembly['components'][0]) {
    const fakeX = - (10000 + Math.round(Math.random() * 10000))

    const savedProps = {
        x: primrive.getState_X(),
        y: primrive.getState_Y(),
        rotation: primrive.getState_Rotation(),
        mirror: primrive.getState_Mirror(),
        designator: primrive.getState_Designator(),
        addIntoBom: primrive.getState_AddIntoBom(),
        addIntoPcb: primrive.getState_AddIntoPcb(),
        uniqueId: primrive.getState_UniqueId(),
    };

    let isAllow = true;
    let newComp: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2 | undefined;
    let rotate: number | undefined = undefined;
    let cause: string | undefined;
    let pinMissSizes: {
        oldX: number,
        oldY: number,
        missDX: number,
        missDY: number,
        pinNumber: string | number,
    }[] = [];

    try {
        newComp = await placeComponent({
            libraryUuid: 'lcsc',
            uuid: component.part_uuid!
        }, {
            x: fakeX,
            y: 0,
            addIntoBom: savedProps.addIntoBom,
            addIntoPcb: savedProps.addIntoPcb,
            subPartName: component.sub_part_name
        });

        if (!newComp) {
            throw new Error("Failed create new component in replace: " + component.part_uuid);
        }

        const newCompId = newComp.getState_PrimitiveId();
        const newPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(newCompId).catch(e => undefined);
        const oldpins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId).catch(e => undefined);

        if (!newPins || !oldpins) {
            throw new Error('Pins not found in replace');
        }

        if (oldpins?.length !== newPins?.length) {
            throw new Error(`Not safe replace pins lens ${oldpins?.length}: ${newPins?.length}`)
        }

        const validate = async (type: 'num' | 'name' | 'signal') => {
            for (const npin of newPins) {
                const npinNumber = npin.getState_PinNumber();
                const npinName = npin.getState_PinName().toLowerCase();

                let opin

                if (type === 'name') {
                    opin = oldpins?.find(op => op.getState_PinName().toLowerCase() == npinName)
                }
                else if (type === 'num') {
                    opin = oldpins?.find(op => op.getState_PinNumber() == npinNumber)
                }
                else if (type === 'signal') {
                    const schematic = await getSchematic([primitiveId], { disableExtractPartUuid: true });
                    const circuitComponent = schematic.components.find(c => c.designator === savedProps.designator);
                    if (!circuitComponent) throw new Error('Replacer validate Not found circuit component');
                    const newPin = component.pins.find(p => p.pin_number == npinNumber || p.name == npinName);
                    if (!newPin) throw new Error('Replacer validate Not found newPin');
                    const circuitPin = circuitComponent.pins.find(cp => cp.signal_name === newPin.signal_name);
                    opin = oldpins?.find(op => op.getState_PinNumber() == circuitPin?.pin_number)
                }

                if (!opin) {
                    throw new Error('Not safe replace not eq pin: ' + npinNumber)
                }

                let npincoords = {
                    x: Math.round(npin.getState_X() - newComp!.getState_X()),
                    y: Math.round(-npin.getState_Y() - newComp!.getState_Y())
                }

                if (npin.getState_Rotation() !== opin.getState_Rotation() && rotate === undefined) {
                    rotate = -(npin.getState_Rotation() - opin.getState_Rotation())
                }

                if (rotate !== undefined)
                    npincoords = rotatePoint(npincoords, -rotate)

                const ox = Math.round(opin.getState_X() - savedProps.x);
                const oy = Math.round(-opin.getState_Y() - savedProps.y);

                if (npincoords.x !== ox || npincoords.y !== oy) {
                    if (npincoords.x !== ox && npincoords.y !== oy)
                        throw new Error('Not safe replace pins coord not eq');
                    else if (Math.abs(npincoords.x - ox) < 30 && Math.abs(npincoords.y - oy) < 30) {
                        // pass
                    }
                    else throw new Error('Not safe replace pins coord not eq');
                }

                pinMissSizes.push({
                    oldX: opin.getState_X(),
                    oldY: -opin.getState_Y(),
                    missDX: npincoords.x - ox,
                    missDY: npincoords.y - oy,
                    pinNumber: npinNumber
                })
            }
        }

        try {
            await validate('signal');
        } catch (error) {
            rotate = undefined;
            pinMissSizes = [];
            try {
                await validate('num');
            } catch (error) {
                rotate = undefined;
                pinMissSizes = [];
                await validate('name');
            }
        }
    } catch (error) {
        isAllow = false;
        cause = (error as Error).message;
        if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId()).catch(e => undefined);
    }

    return {
        isAllow() {
            return { isAllow, cause };
        },

        async cancel() {
            if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId()).catch(e => undefined);
        },

        getNewPrimitive() {
            return newComp;
        },

        getOldPrimitive() {
            return primrive;
        },

        async replace() {
            if (!newComp || !isAllow) throw new Error('Replace not allow');
            let componentCircuit;
            if (pinMissSizes.length && savedProps.designator) {
                const circuit = await getSchematic([primitiveId]);
                componentCircuit = circuit.components.find(c => c.designator === savedProps.designator);
            }

            await eda.sch_PrimitiveComponent.delete(primitiveId).catch(e => undefined);

            // Error if you try it at once
            if (rotate !== undefined) {
                if (rotate < 0)
                    rotate = 360 + rotate;

                eda.sys_Log.add(`Replace need rotate ${primrive.getState_Designator()} ${rotate}`)
                newComp.setState_Rotation(rotate);

            }
            await newComp?.done();

            const offsetsX = pinMissSizes.filter(p => p.missDX).map(p => p.missDX);
            const allEqualX = offsetsX.every(val => val === offsetsX[0]);

            const offsetsY = pinMissSizes.filter(p => p.missDY).map(p => p.missDY);
            const allEqualY = offsetsY.every(val => val === offsetsY[0]);

            const offsetX = (allEqualX ? (offsetsX[0] ?? 0) : 0);
            const offsetY = (allEqualY ? (offsetsY[0] ?? 0) : 0);

            newComp.setState_X(savedProps.x + offsetX);
            newComp.setState_Y(savedProps.y - offsetY);

            if (allEqualX) {
                pinMissSizes = pinMissSizes.map(p => ({ ...p, missDX: p.missDX + offsetX }))
            }
            if (allEqualY) {
                pinMissSizes = pinMissSizes.map(p => ({ ...p, missDY: p.missDY - offsetY }))
            }

            pinMissSizes = pinMissSizes.filter(p => p.missDX || p.missDY);
            eda.sys_Log.add(`Replacer ${savedProps.designator} pinMissSizes ${JSON.stringify(pinMissSizes)}`)

            newComp.setState_Designator(savedProps.designator);
            newComp.setState_UniqueId(savedProps.uniqueId);

            if (savedProps.mirror) {
                newComp.setState_Mirror(savedProps.mirror);
            }

            await newComp?.done();

            for (const pinMiss of pinMissSizes) {
                const pin = componentCircuit?.pins.find(p => p.pin_number == pinMiss.pinNumber);
                let maked = false;

                if (pin) {
                    eda.sys_Log.add(`Replacer ${savedProps.designator} found pin in sch '${pinMiss.pinNumber}' ${JSON.stringify(componentCircuit)}`);
                    const wires = await eda.sch_PrimitiveWire.getAll(pin.signal_name).catch(e => []);
                    let wire;
                    let wireData;
                    let wireIndex;
                    let wireDataIndex;

                    for (const wire_ of wires) {
                        const lineRaw = wire_.getState_Line()

                        wireData = (Array.isArray(lineRaw[0]) ? lineRaw : [lineRaw]) as number[][];

                        for (let index = 0; index < wireData.length; index++) {
                            wireDataIndex = index;
                            const w = wireData[index];

                            wireIndex = w.findIndex((v, i) => i % 2 === 0 ? v === pinMiss.oldX && w[i + 1] === -pinMiss.oldY : false);
                            if (wireIndex !== -1) break;
                        }

                        if (wireIndex !== -1) {
                            wire = wire_;
                            break;
                        }
                    }

                    if (wire) {
                        // if (wireDataIndex === 0 || wireDataIndex === wireData!.length - 1) {
                        eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire before ${wireDataIndex}; ${wireIndex}; ${wire.getState_PrimitiveId()}; ${JSON.stringify(wireData)}`);
                        eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire apply ${JSON.stringify(pinMiss)}`);

                        wireData![wireDataIndex!][wireIndex!] += pinMiss.missDX;
                        wireData![wireDataIndex!][wireIndex! + 1] -= pinMiss.missDY;

                        try {
                            // if (validLine(wireData!)) {
                            eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire ${wireDataIndex}; ${wireIndex}; ${wire.getState_PrimitiveId()}; ${JSON.stringify(wireData)}`);

                            await eda.sch_PrimitiveWire.modify(wire.getState_PrimitiveId(), {
                                line: wireData
                            })

                            await wire.done();
                            maked = true;
                        }
                        // else {
                        catch (e) {
                            eda.sys_Log.add(`Replacer ${savedProps.designator} not valid modify data: ${wireDataIndex}; ${wireIndex}; ${JSON.stringify(wireData)}`);
                        }
                        // }
                        // else {
                        //     eda.sys_Log.add(`Replacer ${savedProps.designator} not valid modify data: ${JSON.stringify(wireData)}`);
                        // }
                    }
                    else {
                        eda.sys_Log.add(`Replacer ${savedProps.designator} not fpund wire && wireDataIndex && wireIndex && wireData ${wire}; ${wireDataIndex}; ${wireIndex}; ${wireData}`);
                    }
                }

                if (!maked) {
                    eda.sys_Log.add(`Replacer ${savedProps.designator} not found pin in sch ${pinMiss.pinNumber}`);
                    eda.sys_Log.add(`- ${JSON.stringify(pinMiss)}`);
                    await eda.sch_PrimitiveWire.create([
                        pinMiss.oldX, -pinMiss.oldY,
                        pinMiss.oldX + pinMiss.missDX, -(pinMiss.oldY + pinMiss.missDY)]).catch(e => undefined);
                }
            }

            if (!pinMissSizes.length && componentCircuit?.pins.length) {
                for (const pin of componentCircuit.pins) {
                    const wires = await eda.sch_PrimitiveWire.getAll(pin.signal_name).catch(e => []);
                    for (const wire of wires) {
                        await wire.done().catch(e => undefined);
                    }
                }
            }
        }
    }
}
