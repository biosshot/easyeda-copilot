import { BoardAssemble } from "@copilot/shared/types/pcb/board-assemble";
import "@copilot/shared/types/eda";
import { isEasyEda } from "./utils";

export const assembleBoard = async (board: BoardAssemble) => {
    if (isEasyEda() && typeof eda.assembleBoard === 'function') {
        await eda.assembleBoard(board);
        return;
    }

    throw new Error('Fail assemble PCB board');
}
