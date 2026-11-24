import { PcbDrcBundleSchema } from '@copilot/shared/types/pcb/drc';
import { RawPcbSchema } from '@copilot/shared/types/pcb/raw';
import type { Bridge } from '../bridge';
import { importEasyEdaBoardV2 } from './easyeda-board-v2';

export async function requestRoutingBoardV2(bridge: Bridge): Promise<{ text: string; pcb?: unknown; drc?: unknown; [key: string]: unknown }> {
    const capture = await bridge.requestEasyEda('export-routing-input', { version: 2 }) as Record<string, unknown>;
    if (typeof capture?.text !== 'string') throw new Error('EasyEDA returned no autoroute JSON');
    return { ...capture, text: capture.text };
}

export function parseRoutingBoardV2(capture: Awaited<ReturnType<typeof requestRoutingBoardV2>>, evidencePath?: string) {
    if (!capture.pcb) {
        const evidence = evidencePath ? ` Native response saved to ${evidencePath}` : '';
        throw new Error(`RoutingBoard V2 native capture is unavailable. Reload the extension.${evidence}`);
    }
    return importEasyEdaBoardV2(JSON.parse(capture.text), RawPcbSchema().parse(capture.pcb), PcbDrcBundleSchema().parse(capture.drc));
}
