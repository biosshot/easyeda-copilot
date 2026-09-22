import type { Bridge } from '../bridge';
import { withTarget, type OperationTarget } from './cancellation';

export async function captureTarget(bridge: Bridge): Promise<OperationTarget> {
    const selectedId = bridge.getSelectedEasyEdaInstanceId?.();
    const selected = await bridge.getSelectedEasyEdaInstance();
    if (selectedId && !selected) throw new Error('The selected EasyEDA instance is disconnected. Reconnect or explicitly select another instance.');
    const instances = selected ? [selected] : await bridge.listEasyEdaInstances();
    if (instances.length !== 1) throw new Error('Select one EasyEDA instance before starting an operation.');
    const target = { instanceId: instances[0].instanceId };
    const document = await withTarget(target, () => bridge.requestEasyEda('get-command-target')) as { documentUuid?: string };
    if (!document.documentUuid) throw new Error('Current document UUID is unavailable.');
    return { ...target, documentUuid: document.documentUuid };
}
