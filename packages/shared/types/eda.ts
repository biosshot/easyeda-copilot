/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type _ from '@jlceda/pro-api-types';
import { CircuitAssembly, ExplainCircuit } from './circuit';
import { BoardAssemble } from './pcb/board-assemble';
import { ExplainPCB, SimplifiedDrcCategory } from './pcb/explain';
import { SimulateResult } from './spice';
import { RawPcb } from './pcb/raw';
import {
    SilkscreenDeleteReport,
    SilkscreenDeleteRequest,
    SilkscreenImageEntry,
    SilkscreenImageReport,
    SilkscreenImageRequest,
    SilkscreenLayer,
    SilkscreenTextEntry,
    SilkscreenTextReport,
    SilkscreenTextRequest,
} from './pcb/silkscreen';
import { PcbGeometryReport, PcbGeometryRequest } from './pcb/geometry';
import { KeepoutRegionReport, KeepoutRegionRequest } from './pcb/keepout';

declare global {
    interface EDA {
        assembleCircuit?: (circuit: CircuitAssembly) => Promise<void>,
        assembleBoard?: (board: BoardAssemble) => Promise<void>,
        getSchematic?: (primitiveIds?: string[]) => Promise<ExplainCircuit>,
        getPcb?: () => Promise<ExplainPCB>,
        getPcbRaw?: () => Promise<RawPcb>,
        checkPcbDrc?: (limit: number) => Promise<SimplifiedDrcCategory[]>,
        addSilkscreenText?: (request: SilkscreenTextRequest) => Promise<SilkscreenTextReport>,
        getSilkscreenText?: (layer?: SilkscreenLayer) => Promise<SilkscreenTextEntry[]>,
        deleteSilkscreenText?: (request: SilkscreenDeleteRequest) => Promise<SilkscreenDeleteReport>,
        getPcbComponentGeometry?: (request?: PcbGeometryRequest) => Promise<PcbGeometryReport>,
        addPcbKeepoutRegion?: (request: KeepoutRegionRequest) => Promise<KeepoutRegionReport>,
        deletePcbKeepoutRegions?: (primitiveIds: string[]) => Promise<{ deleted: number }>,
        addSilkscreenImage?: (request: SilkscreenImageRequest) => Promise<SilkscreenImageReport>,
        getSilkscreenImages?: (layer?: SilkscreenLayer) => Promise<SilkscreenImageEntry[]>,
        deleteSilkscreenImages?: (primitiveIds: string[]) => Promise<{ deleted: number }>,
        getAsmCircuit?: (primitiveIds?: string[]) => Promise<CircuitAssembly>,
        getLibraryUuidList?: (libraryUuid?: string) => Promise<string[]>,
        checkpointer?: {
            restore: (id?: string, allAgree?: boolean) => Promise<boolean>;
            save: (minor: boolean) => Promise<string | null>;
            list: () => Promise<{
                _id: string;
                timestamp: number;
                pageId?: string;
                isCurrentPage: boolean;
            }[]>;
            read: (id: string) => Promise<{
                _id: string;
                timestamp: number;
                pageId?: string;
                content: string;
            } | null>;
            hasCheckpoint: () => boolean;
        }
        simulationResult?: SimulateResult,
        searchComponentInSCH: (designator: string) => Promise<{
            component: ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1;
            primitiveId: string;
        }[] | undefined>
    }
}
