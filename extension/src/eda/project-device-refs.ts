import JSZip from 'jszip';
import type { PartUuid } from '@copilot/shared/types/lcsc';

// V3 exports retain the original library reference on the local DEVICE's META.
// This is identity readback only; symbol/footprint downloads remain in the backend.
export function deviceRefsFromProjectSource(source: string): Map<string, PartUuid> {
    const refs = new Map<string, PartUuid>();
    let deviceUuid: string | undefined;
    for (const line of source.split(/\r?\n/)) {
        try {
            if (!line.startsWith('{')) continue;
            const separator = line.indexOf('||');
            if (separator < 0) continue;
            const outer = JSON.parse(line.slice(0, separator));
            if (outer.type !== 'DOCHEAD' && outer.type !== 'META') continue;
            const text = line.slice(separator + 2).replace(/\|$/, '');
            const inner = text ? JSON.parse(text) : null;
            if (outer.type === 'DOCHEAD') {
                deviceUuid = inner?.docType === 'DEVICE' ? inner.uuid : undefined;
            } else if (deviceUuid) {
                const parts = typeof inner?.source === 'string' ? inner.source.split('|') : [];
                if (parts.length === 2 && /^[a-f0-9]{32}$/i.test(parts[0]) && parts[1]) {
                    refs.set(deviceUuid, parts[1] === '0819f05c4eef4c71ace90d822a990e87' || parts[1] === 'lcsc'
                        ? parts[0] : { uuid: parts[0], libraryUuid: parts[1] });
                } else {
                    refs.delete(deviceUuid);
                }
            }
        } catch {
            // A corrupt section must not poison the references from other devices.
            if (deviceUuid) refs.delete(deviceUuid);
            deviceUuid = undefined;
        }
    }
    return refs;
}

async function exportProjectDeviceRefs(): Promise<Map<string, PartUuid>> {
    if (typeof eda?.sys_FileManager?.getProjectFile !== 'function'
        || typeof eda?.dmt_SelectControl?.getCurrentDocumentInfo !== 'function') return new Map();
    const before = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    const file = await eda.sys_FileManager.getProjectFile();
    if (!file) return new Map();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const refs = new Map<string, PartUuid>();
    for (const entry of Object.values(zip.files)) {
        if (entry.dir || !entry.name.endsWith('.epru')) continue;
        for (const [uuid, ref] of deviceRefsFromProjectSource(await entry.async('string'))) refs.set(uuid, ref);
    }
    const after = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (before?.parentProjectUuid !== after?.parentProjectUuid || before?.uuid !== after?.uuid) {
        throw new Error('EasyEDA document changed while reading library references');
    }
    return refs;
}

// Optional identity recovery must not block normal schematic readback. Keep a
// single pending export even after timeout: repeated reads must not pile up work.
let pendingExport: Promise<Map<string, PartUuid>> | undefined;
export async function readProjectDeviceRefs(timeoutMs = 20_000): Promise<Map<string, PartUuid>> {
    if (pendingExport) return new Map();
    const task = exportProjectDeviceRefs().catch(() => new Map<string, PartUuid>());
    pendingExport = task;
    void task.finally(() => { if (pendingExport === task) pendingExport = undefined; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            task,
            new Promise<Map<string, PartUuid>>(resolve => {
                timer = setTimeout(() => resolve(new Map()), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
