import { z } from "zod";

export interface LsclCatalogTreeItem {
    catalogName: string,
    sonList: {
        catalogId: string,
        catalogName: string,
    }[]
};

export const LCSC_uuid = () => z.string().regex(/^[0-9a-f]{32}$/);

export const PartUuidStruct = () => z.union([
    LCSC_uuid(),
    z.object({
        uuid: z.string().min(1),
        libraryUuid: z.string().min(1),
    }),
]);

export type PartUuid = z.infer<ReturnType<typeof PartUuidStruct>>;

export const getPartUuid = (partUuid: PartUuid) => typeof partUuid === 'string' ? partUuid : partUuid.uuid;
export const getPartLibraryUuid = (partUuid: PartUuid) => typeof partUuid === 'string'
    || partUuid.libraryUuid === '0819f05c4eef4c71ace90d822a990e87' ? 'lcsc' : partUuid.libraryUuid;
export const getPartUuidKey = (partUuid: PartUuid) => `${getPartLibraryUuid(partUuid)}:${getPartUuid(partUuid)}`;
export const samePartUuid = (a: PartUuid | null | undefined, b: PartUuid | null | undefined) =>
    Boolean(a && b && getPartUuidKey(a) === getPartUuidKey(b));
export const isMissingPartUuid = (partUuid: PartUuid | null | undefined) =>
    !partUuid || /^0+$/.test(getPartUuid(partUuid));
