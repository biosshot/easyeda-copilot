import { z } from 'zod';
import { CircuitModStruct, ExplainCircuitStruct, type CircuitMod, type ExplainCircuit, type Circuit, type CircuitAssembly } from './types/circuit.ts';
import { makeAutoPlacement } from './circuit-layout/index.ts';
import { shortSymbolsMap } from './circuit-layout/short-symbol.ts';
import { hasConnection } from './circuit-layout/signals.ts';
import { getSymbol } from './devices/symbols/symbol-parser.ts';
import { rotatePointClockwise } from './utils/math.ts';
import { recalculateRootBlock } from './utils/circuit-merge.ts';
import type { SymbolPin } from './types/symbol.ts';
import masterLogger from './logger.ts';

const logger = masterLogger.child({ TAG: 'extract-circuit' });
const inputSchema = z.object({ circuit: CircuitModStruct(), inputCircuit: ExplainCircuitStruct().optional() });
export type ExtractCircuitInput = z.input<typeof inputSchema>;
type CircuitState = {
  circuit: CircuitMod;
  inputCircuit: ExplainCircuit;
  components: Circuit['components'];
  circuitAssembly?: CircuitAssembly;
  replaceComponents: string[];
  rmnet: CircuitAssembly['rm_net'];
  addednet: CircuitAssembly['added_net'];
};

/** Existing MCP postprocessing, with the sequential LangGraph steps expressed as async calls. */
export async function extractCircuit(input: ExtractCircuitInput): Promise<{ circuit: CircuitAssembly }> {
  // Reject disabled blocks before schema validation, network access or any layout work.
  if (Array.isArray(input?.circuit?.add_reused_blocks) && input.circuit.add_reused_blocks.length) {
    throw new Error('Reusable blocks are not supported. Do not use add_reused_blocks; add individual components instead.');
  }
  const data = inputSchema.parse(input);
  const missing = data.circuit.add_components.filter(c => !c.part_uuid || /^0+$/.test(c.part_uuid));
  if (missing.length) throw new Error('All add_components must have part_uuid: ' + missing.map(c => c.designator).join(', '));
  const state: CircuitState = {
    circuit: data.circuit,
    inputCircuit: data.inputCircuit ?? { components: [] },
    components: data.circuit.add_components.map(c => c.block_name === '__v_root__' ? { ...c, block_name: 'main' } : c),
    replaceComponents: [], rmnet: [], addednet: [],
  };
    const findReplaced = async (state: CircuitState): Promise<Partial<CircuitState>> => {
        const replaceComponents: Circuit['components'] = [];

        for (const component of state.components) {
            const { designator } = component;

            if (!state.circuit.rm_components?.includes(designator)) {
                continue;
            }
            if (!component.part_uuid) {
                logger.warn({ designator }, 'Not found in part_uuid')
                continue;
            }

            const schComponent = state.inputCircuit.components.find(c => c.designator === designator);
            if (!schComponent || !schComponent.part_uuid) {
                logger.warn({ designator }, 'Not found in inputCircuit')
                continue;
            }

            const baseSignals = [...new Set(schComponent.pins.map(p => p.signal_name))].toSorted();
            const newSignals = [...new Set(component.pins.map(p => p.signal_name))].toSorted();

            if (JSON.stringify(baseSignals) !== JSON.stringify(newSignals)) {
                logger.warn({ designator, baseSignals, newSignals }, 'mismatches signals');
                continue;
            }

            const applySignalName = (component: ExplainCircuit['components'][0], symbolPins: SymbolPin[]) => {
                return symbolPins.map((spin) => ({ ...spin, signal_name: component.pins.find(cpin => cpin.pin_number == spin.num)?.signal_name ?? crypto.randomUUID().slice(0, 8) }));
            }

            const oldSymbol = await getSymbol(schComponent.part_uuid);
            const newSymbol = await getSymbol(component.part_uuid);

            if (!oldSymbol || !newSymbol) {
                logger.warn({ designator }, 'not found symbol')
                continue;
            }

            if (oldSymbol.pins.length !== newSymbol.pins.length) {
                logger.warn({ designator, oldSymbol: oldSymbol.pins.length, newSymbol: newSymbol.pins.length }, 'Pin lens not eq')
                continue;
            }

            const oldSymbolPins = applySignalName(schComponent, oldSymbol.pins);
            const newSymbolPins = applySignalName(component, newSymbol.pins);

            const validate = (type: 'num' | 'name' | 'signal') => {
                let rotate: number | undefined;

                for (const npin of newSymbolPins) {
                    const n = npin.name.toLowerCase();
                    let opin;

                    if (type === 'name') {
                        opin = oldSymbolPins.find(op => op.name.toLowerCase() === n);
                    }
                    else if (type === 'num') {
                        opin = oldSymbolPins.find(op => op.num == npin.num);
                    }
                    else if (type === 'signal') {
                        const opins = oldSymbolPins.filter(op => op.signal_name == npin.signal_name);
                        if (opins.length > 1) {
                            opin = opins.find(op => op.num == npin.num) ?? opins.find(op => op.name == npin.name);
                            if (!opin) opin = opins[0];
                        }
                        else {
                            opin = opins[0];
                        }
                    }

                    if (!opin) {
                        logger.warn({ designator, npin: npin, oldSymbolPins }, 'Not found pins')
                        return false
                    }

                    const ok = ((opin) => {

                        const oldPinCoords = {
                            x: Math.round(opin.x),
                            y: Math.round(opin.y)
                        }

                        let foundRotate = false;

                        const maybeRot = rotate === undefined ? [0, 90, 180, 270] : [rotate];

                        for (const rot of maybeRot) {
                            let newPinCoords = {
                                x: Math.round(npin.x),
                                y: Math.round(npin.y)
                            }

                            if (rot !== 0) {
                                newPinCoords = rotatePointClockwise(newPinCoords, rot);
                                newPinCoords.x = Math.round(newPinCoords.x);
                                newPinCoords.y = Math.round(newPinCoords.y);
                            }

                            rotate = rot;

                            if (newPinCoords.x === oldPinCoords.x || newPinCoords.y === oldPinCoords.y) {
                                // if (Math.abs(newPinCoords.x - oldPinCoords.x) < 5 && Math.abs(newPinCoords.y - oldPinCoords.y) < 5) {
                                foundRotate = true;
                                break;
                                // }
                            }
                        }

                        return foundRotate;
                    })(opin);

                    if (!ok) {
                        return false
                    }
                }

                return true;
            }

            if (validate('signal')) {
                replaceComponents.push(component);
            }
            else {
                logger.warn({ designator }, 'Pin not ok')
            }
        }

        return {
            components: state.components,
            replaceComponents: replaceComponents.map(c => c.designator)
        }
    }

    const applyRmAddNet = (state: CircuitState): Partial<CircuitState> => {
        const componentsWithRm = state.inputCircuit.components.filter(c => !state.circuit.rm_components?.includes(c.designator));
        const rmnet: CircuitAssembly['rm_net'] = [];
        const addednet: CircuitAssembly['added_net'] = [];

        for (const connect of (state.circuit.external_rm_connect ?? [])) {
            const component = componentsWithRm.find(c => c.designator === connect.designator);
            if (!component) {
                throw new Error(`Error in external_rm_connect: ${JSON.stringify(connect)} not found component with this designator "${connect.designator}"`)
                // continue;
            }
            const pin = component.pins.find(p => p.pin_number == connect.pin_number);
            if (pin) {
                rmnet.push({
                    designator: connect.designator,
                    net: pin.signal_name,
                    pin_number: connect.pin_number
                })

                // @warn-is-mut
                pin.signal_name = '';
            }
            else {
                logger.warn(connect, 'Failed not found pin in apply rm');
                throw new Error(`Error in external_rm_connect: ${JSON.stringify(connect)} not found pin with this pin_number "${connect.pin_number}"`)
            }
        }

        for (const connect of (state.circuit.external_connect ?? [])) {
            const component = componentsWithRm.find(c => c.designator === connect.designator);
            if (!component) {
                logger.warn(connect, 'Failed not found component in apply added')
                throw new Error(`Error in external_connect: ${JSON.stringify(connect)} not found component with this designator "${connect.designator}"`)
                // continue;
            }
            const pin = component.pins.find(p => p.pin_number == connect.pin_number);
            const hasInRm = rmnet.some(rc => rc.pin_number == pin?.pin_number);

            if (!pin)
                throw new Error(`Error in external_connect: ${JSON.stringify(connect)} not found pin with this pin_number "${connect.pin_number}"`)

            if (pin.signal_name && pin.signal_name !== connect.signal_name && !hasInRm) {
                logger.warn({ connect, pin, hasInRm }, 'Failed not found pin or net is not empty in apply added; adding to rm signals...');

                rmnet.push({
                    designator: connect.designator,
                    net: pin.signal_name,
                    pin_number: connect.pin_number
                })
            }

            addednet.push({
                designator: connect.designator,
                net: connect.signal_name,
                pin_number: connect.pin_number
            })

            // @warn-is-mut
            pin.signal_name = connect.signal_name;
        }

        return {
            rmnet, addednet
        }
    }

    const autoPlacement = async (state: CircuitState): Promise<Partial<CircuitState>> => {
        const componentsWithRm = state.inputCircuit.components.filter(c => !state.circuit.rm_components?.includes(c.designator));
        const inputSignals = new Set(
            componentsWithRm.flatMap(component => component.pins.map(pin => pin.signal_name)).filter(Boolean)
        );
        const externalSignals = [
            ...new Set([
                ...state.circuit.add_reused_blocks.flatMap(block => block.ports.map(port => port.signal_name)).filter(Boolean),
                ...state.components.flatMap(component => component.pins.map(pin => pin.signal_name))
                    .filter((signalName): signalName is string => Boolean(signalName) && inputSignals.has(signalName))
            ])
        ];

        const blockNames = [...new Set(state.components.map(c => c.block_name))];

        const circuit: Circuit = {
            blocks: [
                // {
                //     name: 'main',
                //     description: '',
                //     next_block_names: blockNames
                // },
                ...blockNames.map(block_name => ({
                    description: '',
                    name: block_name,
                    next_block_names: []
                })),
            ],
            components: state.components,
            metadata: { description: '', project_name: '' },
            reused_blocks: state.circuit.add_reused_blocks
        };

        const result: CircuitAssembly = await makeAutoPlacement(circuit, undefined, {}, {
            splitMultiPartComponent: true,
            layoutRefinement: true,
            externalSignals
        });

        result.assembly_options = {
            centered: false,
        };

        const shortSymbolsUuid = Object.values(shortSymbolsMap).map(s => s.partUuid)
        for (const component of result.components) {
            if (!shortSymbolsUuid.includes(component.part_uuid ?? '')) continue;
            const signalName = component.pins[0].signal_name;
            let pin;
            let pinOwner;

            if (state.addednet!.some(s => s.net === signalName)) continue;

            for (const comp of componentsWithRm) {
                if (state.rmnet!.some(rc => rc.designator === comp.designator && rc.net === signalName)) continue;
                pin = comp.pins.find(p => p.signal_name === signalName);
                pinOwner = comp;
                if (pin) break;
            }

            if (!pin || !pinOwner) {
                logger.warn({ signalName }, "Not found external pin")
                continue;
            }

            state.addednet!.push({
                designator: pinOwner.designator,
                net: pin.signal_name,
                pin_number: pin.pin_number
            })
        }

        result.rm_net = state.rmnet;
        result.added_net = state.addednet?.filter(net => hasConnection(net.net));
        result.rm_components = state.circuit.rm_components ?? undefined;

        const rmSet = new Set([...(state.circuit.rm_components ?? []), ...(state.replaceComponents ?? [])]);

        result.blocks_rect = result.blocks_rect?.map(b => ({ ...b, name: b.name.replace('block_', '') })).filter(block => {
            if (block.name.includes('__v_root__')) return true;
            return result.components.some(
                c => c.block_name === block.name && !rmSet.has(c.designator)
            );
        });

        result.reused_blocks = [];

        result.blocks_rect = recalculateRootBlock(result.blocks_rect ?? [], result.components, result.edges);

        return {
            circuitAssembly: {
                ...result,
                replace_components: state.replaceComponents,
                metadata: {
                    project_name: 'Completions',
                    description: 'These are changes to the current circuit',
                }
            }
        }
    }


  Object.assign(state, await findReplaced(state));
  Object.assign(state, applyRmAddNet(state));
  Object.assign(state, await autoPlacement(state));
  return { circuit: state.circuitAssembly! };
}
