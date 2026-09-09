import type { PlacementInput } from '#types/pcb/layout-model.ts';
import type { PcbRoutingRules } from '#types/pcb/routing-model.ts';
import { isPowerSignalName, isSwitchingPowerSignalName } from '#utils/signals.ts';
import { allNets, isConnectedSignal } from './utils.ts';

const DEFAULT_SIGNAL_ROUTE_Z_INDEX = 0;
const DEFAULT_POWER_ROUTE_Z_INDEX = -400;

export function createDefaultRoutingRules(input: PlacementInput): PcbRoutingRules {
    const signals = allNets(input);
    const ignoredSignals = input.solverOptions.ignoredRatsnestSignals.filter(isConnectedSignal);
    const routedSignals = signals.filter((signal) => !ignoredSignals.includes(signal));
    const defaultPowerSignals = routedSignals.filter(isLowPriorityPowerSignal);
    const defaultSignalSignals = routedSignals.filter((signal) => !isLowPriorityPowerSignal(signal));

    return {
        layers: [
            { name: 'F.Cu', side: 'top', direction: 'horizontal' },
            { name: 'B.Cu', side: 'bottom', direction: 'vertical' },
        ],
        defaultTraceWidth: 0.2,
        defaultClearance: 0.127,
        defaultViaDiameter: 0.61,
        defaultViaDrill: 0.305,
        ignoredSignals,
        stitchRules: [],
        polygonRules: [],
        netClasses: [
            ...(defaultSignalSignals.length > 0 ? [{
                name: 'default',
                signals: defaultSignalSignals,
                zIndex: DEFAULT_SIGNAL_ROUTE_Z_INDEX,
                routeMode: 'route' as const,
            }] : []),
            ...(defaultPowerSignals.length > 0 ? [{
                name: 'default_power',
                signals: defaultPowerSignals,
                zIndex: DEFAULT_POWER_ROUTE_Z_INDEX,
                routeMode: 'route' as const,
            }] : []),
            {
                name: 'ignored',
                signals: ignoredSignals,
                routeMode: 'ignore' as const,
            },
        ],
    };
}

function isLowPriorityPowerSignal(signal: string) {
    return isPowerSignalName(signal) && !isSwitchingPowerSignalName(signal);
}
