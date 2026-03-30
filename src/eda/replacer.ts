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

export async function ComponentReplacer(primitiveId: string, primrive: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent_2, new_part_uuid: string, subPartName?: string) {
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
    let rotate = 0
    let cause: string | undefined;
    const pinMissSizes: {
        oldX: number,
        oldY: number,
        missDX: number,
        missDY: number,
        pinNumber: string | number,
    }[] = [];

    try {
        newComp = await placeComponent({
            libraryUuid: 'lcsc',
            uuid: new_part_uuid
        }, {
            x: fakeX,
            y: 0,
            addIntoBom: savedProps.addIntoBom,
            addIntoPcb: savedProps.addIntoPcb,
            mirror: savedProps.mirror,
            subPartName
        });

        if (!newComp) {
            throw new Error("Failed create new component in replace: " + new_part_uuid);
        }

        const newCompId = newComp.getState_PrimitiveId();
        const newPins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(newCompId);
        const oldpins = await eda.sch_PrimitiveComponent.getAllPinsByPrimitiveId(primitiveId);

        if (!newPins || !oldpins) {
            throw new Error('Pins not found in replace');
        }

        if (oldpins?.length !== newPins?.length) {
            throw new Error(`Not safe replace pins lens ${oldpins?.length}: ${newPins?.length}`)
        }

        for (const npin of newPins) {
            const npinNumber = npin.getState_PinNumber();
            const opin = oldpins?.find(op => op.getState_PinNumber() == npinNumber)
            if (!opin) {
                throw new Error('Not safe replace not eq pin: ' + npinNumber)
            }

            let npincoords = {
                x: Math.round(npin.getState_X() - newComp.getState_X()),
                y: Math.round(-npin.getState_Y() - newComp.getState_Y())
            }

            if (npin.getState_Rotation() !== opin.getState_Rotation()) {
                rotate = -(npin.getState_Rotation() - opin.getState_Rotation())
                npincoords = rotatePoint(npincoords, -rotate)
            }

            const ox = Math.round(opin.getState_X() - savedProps.x);
            const oy = Math.round(-opin.getState_Y() - savedProps.y);

            if (npincoords.x !== ox || npincoords.y !== oy) {
                if (npincoords.x !== ox && npincoords.y !== oy)
                    throw new Error('Not safe replace pins coord not eq');
                else if (Math.abs(npincoords.x - ox) < 30 && Math.abs(npincoords.y - oy) < 30) {
                    pinMissSizes.push({
                        oldX: opin.getState_X(),
                        oldY: -opin.getState_Y(),
                        missDX: npincoords.x - ox,
                        missDY: npincoords.y - oy,
                        pinNumber: npinNumber
                    })
                }
                else throw new Error('Not safe replace pins coord not eq');
            }
        }
    } catch (error) {
        isAllow = false;
        cause = (error as Error).message;
        if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId());
    }

    return {
        isAllow() {
            return { isAllow, cause };
        },

        async cancel() {
            if (newComp) await eda.sch_PrimitiveComponent.delete(newComp.getState_PrimitiveId());
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

            await eda.sch_PrimitiveComponent.delete(primitiveId);

            // Error if you try it at once
            newComp.setState_Rotation(rotate);
            await newComp?.done();

            newComp.setState_X(savedProps.x);
            newComp.setState_Y(savedProps.y);

            newComp.setState_Designator(savedProps.designator);
            newComp.setState_UniqueId(savedProps.uniqueId);

            await newComp?.done();

            for (const pinMiss of pinMissSizes) {
                const pin = componentCircuit?.pins.find(p => p.pin_number == pinMiss.pinNumber);
                let maked = false;

                if (pin) {
                    eda.sys_Log.add(`Replacer ${savedProps.designator} found pin in sch`);
                    const wires = await eda.sch_PrimitiveWire.getAll(pin.signal_name);
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
                        if (wireDataIndex === 0 || wireDataIndex === wireData!.length - 1) {
                            eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire before ${wireDataIndex}; ${wireIndex}; ${wire.getState_PrimitiveId()}; ${JSON.stringify(wireData)}`);
                            eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire apply ${JSON.stringify(pinMiss)}`);

                            wireData![wireDataIndex!][wireIndex!] -= pinMiss.missDX;
                            wireData![wireDataIndex!][wireIndex! + 1] -= pinMiss.missDY;
                            eda.sys_Log.add(`Replacer ${savedProps.designator} modify wire ${wireDataIndex}; ${wireIndex}; ${wire.getState_PrimitiveId()}; ${JSON.stringify(wireData)}`);

                            await eda.sch_PrimitiveWire.modify(wire.getState_PrimitiveId(), {
                                line: wireData
                            })

                            wire.done();
                            maked = true;
                        }
                    }
                    else {
                        eda.sys_Log.add(`Replacer ${savedProps.designator} not fpund wire && wireDataIndex && wireIndex && wireData ${wire}; ${wireDataIndex}; ${wireIndex}; ${wireData}`);
                    }
                }

                if (!maked) {
                    eda.sys_Log.add(`Replacer ${savedProps.designator} not found pin in sch ${pinMiss.pinNumber}`);
                    await eda.sch_PrimitiveWire.create([
                        pinMiss.oldX, -pinMiss.oldY,
                        pinMiss.oldX + pinMiss.missDX, -(pinMiss.oldY + pinMiss.missDY)]).catch(e => undefined);
                }
            }
        }
    }
}
