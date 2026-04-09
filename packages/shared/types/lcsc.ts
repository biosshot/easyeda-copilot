import { z } from "zod";

export interface LsclCatalogTreeItem {
    catalogName: string,
    sonList: {
        catalogId: string,
        catalogName: string,
    }[]
};

export const LCSC_uuid = () => z.string().regex(/^[0-9a-f]{32}$/);