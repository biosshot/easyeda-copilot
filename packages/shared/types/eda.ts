/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type _ from '@jlceda/pro-api-types';
import { CircuitAssembly, ExplainCircuit } from './circuit';
import { BoardAssemble } from './pcb/board-assemble';
import { ExplainPCB, SimplifiedDrcCategory } from './pcb/explain';
import { SimulateResult } from './spice';

declare global {
    interface EDA {
        assembleCircuit?: (circuit: CircuitAssembly) => Promise<void>,
        assembleBoard?: (board: BoardAssemble) => Promise<void>,
        getSchematic?: (primitiveIds?: string[]) => Promise<ExplainCircuit>,
        getPcb?: () => Promise<ExplainPCB>,
        checkPcbDrc?: (limit: number) => Promise<SimplifiedDrcCategory[]>,
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
