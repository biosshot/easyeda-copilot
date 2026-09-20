type BoardRecord = {
    name: string;
    schematic?: { uuid: string } | null;
    pcb?: { uuid: string } | null;
};

type DocumentRecord = { uuid: string };

export type BoardDeletionApi = {
    boards(): Promise<BoardRecord[]>;
    schematics(): Promise<DocumentRecord[]>;
    pcbs(): Promise<DocumentRecord[]>;
    deleteBoard(name: string): Promise<boolean>;
    deleteSchematic(uuid: string): Promise<boolean>;
    deletePcb(uuid: string): Promise<boolean>;
};

async function removeDocument(
    kind: 'schematic' | 'pcb',
    uuid: string | undefined,
    remove: (uuid: string) => Promise<boolean>,
    list: () => Promise<DocumentRecord[]>,
    errors: string[],
) {
    if (!uuid) return true;
    try {
        await remove(uuid);
    } catch (error) {
        errors.push(`${kind} ${uuid}: ${String(error)}`);
    }
    try {
        const removed = !(await list()).some(document => document.uuid === uuid);
        if (!removed) errors.push(`${kind} deletion failed: ${uuid}`);
        return removed;
    } catch (error) {
        errors.push(`${kind} verification failed: ${String(error)}`);
        return false;
    }
}

/** Delete linked documents before their board so a failed cleanup remains retryable. */
export async function deleteBoardWithDocuments(name: string, api: BoardDeletionApi) {
    const board = (await api.boards()).find(item => item.name === name);
    if (!board) return { success: false, boardDeleted: false, errors: [`Board not found: ${name}`] };

    const schematicUuid = board.schematic?.uuid;
    const pcbUuid = board.pcb?.uuid;
    const errors: string[] = [];
    const schematicDeleted = await removeDocument(
        'schematic', schematicUuid, api.deleteSchematic, api.schematics, errors,
    );
    const pcbDeleted = await removeDocument('pcb', pcbUuid, api.deletePcb, api.pcbs, errors);
    let boardDeleted = false;

    if (schematicDeleted && pcbDeleted) {
        try {
            boardDeleted = !(await api.boards()).some(item => item.name === name);
            if (!boardDeleted) {
                await api.deleteBoard(name);
                boardDeleted = !(await api.boards()).some(item => item.name === name);
            }
        } catch (error) {
            errors.push(`board ${name}: ${String(error)}`);
        }
        if (!boardDeleted) errors.push(`board deletion failed: ${name}`);
    }

    return {
        success: boardDeleted && schematicDeleted && pcbDeleted,
        boardDeleted,
        schematicDeleted,
        pcbDeleted,
        schematicUuid,
        pcbUuid,
        errors,
    };
}
