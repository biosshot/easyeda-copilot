import type { AddedNet } from './types';

export interface UnresolvedNetPortSample {
    net: AddedNet;
    reason: 'pin not found' | 'wire conflict' | 'no free route';
}

const MAX_MESSAGE_LENGTH = 400;
const MAX_FIELD_LENGTH = 24;
const MAX_SAMPLES = 3;

const shortField = (value: string | number) => String(value).replace(/\s+/g, ' ').slice(0, MAX_FIELD_LENGTH);

export function formatUnresolvedNetPortMessage(total: number, samples: UnresolvedNetPortSample[]): string {
    const shown = samples.slice(0, MAX_SAMPLES);
    const examples = shown.map(({ net, reason }) =>
        `${shortField(net.designator)}/${shortField(net.pin_number)} -> ${shortField(net.net)} (${reason})`,
    );
    const remaining = Math.max(0, total - shown.length);
    const details = examples.length ? `: ${examples.join('; ')}` : '';
    const more = remaining ? `; ${remaining} more` : '';
    return `${total} unresolved net ports${details}${more}. See source-assemble log.`.slice(0, MAX_MESSAGE_LENGTH);
}
