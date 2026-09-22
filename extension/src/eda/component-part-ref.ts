import type { PartUuid } from '@copilot/shared/types/lcsc';
import { getPartLibraryUuid, getPartUuid } from '@copilot/shared/types/lcsc';

const EASYEDA_SYSTEM_LIBRARY_UUID = '0819f05c4eef4c71ace90d822a990e87';
const COPILOT_PART_REF_PROPERTY = 'EasyEDA Copilot Part Ref';

type ComponentReferencePrimitive = {
    getState_Component?(): { uuid?: string; libraryUuid?: string } | null | undefined;
    getState_OtherProperty?(): Record<string, unknown> | null | undefined;
    setState_OtherProperty?(otherProperty: Record<string, string | number | boolean>): unknown;
};

export function readComponentProperties(primitive: ComponentReferencePrimitive): Record<string, unknown> {
    try { return primitive.getState_OtherProperty?.() ?? {}; } catch { return {}; }
}

export function resolvedPartUuid(ref: PartUuid | null | undefined): PartUuid | null {
    if (!ref) return null;
    const uuid = getPartUuid(ref);
    if (typeof uuid !== 'string' || !/^[a-f0-9]{32}$/i.test(uuid) || /^0+$/.test(uuid)) return null;
    const library = getPartLibraryUuid(ref);
    if (typeof library !== 'string' || !library.trim()) return null;
    return normalizePartUuid(uuid.toLowerCase(), library);
}

function normalizePartUuid(uuid: string, libraryUuid?: string): PartUuid {
    if (!libraryUuid || libraryUuid === 'lcsc' || libraryUuid === EASYEDA_SYSTEM_LIBRARY_UUID) {
        return uuid;
    }
    return { uuid, libraryUuid };
}

export function readPartUuidFromPrimitive(primitive: ComponentReferencePrimitive): PartUuid | null {
    const properties = readComponentProperties(primitive);
    const storedRef = properties[COPILOT_PART_REF_PROPERTY];

    if (typeof storedRef === 'string' && storedRef) {
        try {
            const parsed = JSON.parse(storedRef) as Partial<{ uuid: string; libraryUuid: string }>;
            if (typeof parsed.uuid === 'string' && parsed.uuid
                && typeof parsed.libraryUuid === 'string' && parsed.libraryUuid) {
                const resolved = resolvedPartUuid(parsed as PartUuid);
                if (resolved) return resolved;
            }
        } catch {
            // Ignore malformed user-edited metadata and fall back to EasyEDA's native reference.
        }
    }

    try {
        const ref = primitive.getState_Component?.();
        if (typeof ref?.uuid !== 'string' || !ref.uuid) return null;
        return normalizePartUuid(ref.uuid, ref.libraryUuid);
    } catch { return null; }
}

export function storePartUuidOnPrimitive(primitive: ComponentReferencePrimitive, partUuid: PartUuid): boolean {
    try {
        if (!primitive.setState_OtherProperty || !primitive.getState_OtherProperty) return false;
        // Do not replace existing properties when their getter fails.
        const properties = primitive.getState_OtherProperty() ?? {};
        primitive.setState_OtherProperty({
            ...properties,
            [COPILOT_PART_REF_PROPERTY]: JSON.stringify({
                uuid: getPartUuid(partUuid),
                libraryUuid: getPartLibraryUuid(partUuid),
            }),
        });
        return true;
    } catch { return false; }
}
