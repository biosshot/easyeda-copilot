import AppDBClient from 'appdb';
import "@copilot/shared/types/eda";

interface Checkpoint {
    _id: string,
    timestamp: number,
    content: string,
    name?: string,
    pageId?: string
}

const checkpointsDb = new AppDBClient(false).init('checkpoints', {
    // These are indexes, not allowed fields. Keep them unchanged for existing databases.
    checkpoints: ['timestamp', 'content', '_id', 'pageId']
});

let lastCheckpoint: Checkpoint | undefined;
const pinned = new Map<string, number>();

const generateInsecureToken = (length = 16) => {
    return (Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2))
        .substring(0, length);
};

const getCurrentPageId = async () => {
    const page = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (!page?.uuid) throw new Error('Current document UUID is unavailable');
    return page.uuid;
}

async function saveCheckpoint(minor: boolean, name?: string) {
    try {
        if (name !== undefined && (typeof name !== 'string' || name.trim().length > 200)) {
            throw new Error('Checkpoint name must be a string of at most 200 characters');
        }
        const pageId = await getCurrentPageId();
        const content = await eda.sys_FileManager.getDocumentSource();
        if (!content) {
            eda.sys_Message.showToastMessage('Failed insert checkpoint to db: not found content', ESYS_ToastMessageType.WARNING);
            return null;
        }

        const checkpoint: Checkpoint = {
            _id: generateInsecureToken(16),
            timestamp: Date.now(),
            content,
            ...(name?.trim() ? { name: name.trim() } : {}),
            pageId
        };

        if (await getCurrentPageId() !== pageId) {
            throw new Error('Current document changed while creating checkpoint');
        }

        if (!minor) {
            const db = await checkpointsDb;
            const allCheckpoints = await db.checkpoints.find({});

            if (allCheckpoints.length >= 512) {
                const sorted = allCheckpoints.sort((a, b) => a.timestamp! - b.timestamp!);
                for (const item of sorted.slice(0, sorted.length - 99)) {
                    if ((pinned.get(item._id!) ?? 0) > Date.now()) continue;
                    pinned.delete(item._id!);
                    await db.checkpoints.remove({ _id: item._id });
                }
            }

            await db.checkpoints.insert(checkpoint);
            eda.sys_Message.showToastMessage('Create checkpoint', ESYS_ToastMessageType.SUCCESS);
        }

        lastCheckpoint = checkpoint;
        return checkpoint._id;
    } catch (error) {
        eda.sys_Message.showToastMessage('Failed to save checkpoint: ' + (error as Error).message, ESYS_ToastMessageType.ERROR);
        return null;
    }
}

const confirmationMessage = (...args: Parameters<typeof eda.sys_Dialog.showConfirmationMessage>) => {
    return new Promise<boolean>((resolve) => {
        eda.sys_Dialog.showConfirmationMessage(args[0], args[1], args[2], args[3], resolve);
    })
}

async function restoreCheckpoint(id?: string, allAgree = false, signal?: AbortSignal) {
    signal?.throwIfAborted();
    let checkpoint: Checkpoint | undefined;

    if (!id) {
        checkpoint = lastCheckpoint;
    }
    else {
        const db = await checkpointsDb;
        checkpoint = await db.checkpoints.find({ _id: id }).then(r => r[0]).catch(() => undefined) as Checkpoint | undefined;
    }
    signal?.throwIfAborted();

    if (!checkpoint) {
        eda.sys_Message.showToastMessage('Not found checkpoint to restore', ESYS_ToastMessageType.INFO);
        return false;
    }

    if (!checkpoint.pageId) {
        eda.sys_Message.showToastMessage('This legacy checkpoint has no document UUID and cannot be restored safely.', ESYS_ToastMessageType.ERROR);
        return false;
    }

    if (checkpoint.pageId !== await getCurrentPageId()) {
        eda.sys_Message.showToastMessage('This checkpoint was not created for this page.', ESYS_ToastMessageType.ERROR);
        return false;
    }

    if (!allAgree)
        if (!await confirmationMessage('Are you sure you want to restore this checkpoint? Current changes may be lost.', 'Restore'))
            return false;

    signal?.throwIfAborted();

    if (checkpoint === lastCheckpoint) {
        lastCheckpoint = undefined;
    }

    try {
        const success = await eda.sys_FileManager.setDocumentSource(checkpoint.content);
        eda.sys_Message.showToastMessage(success ? 'Loaded checkpoint' : 'Fail load checkpoint', success ? ESYS_ToastMessageType.SUCCESS : ESYS_ToastMessageType.ERROR);
        return success;
    } catch (error) {
        eda.sys_Message.showToastMessage('Failed to restore checkpoint: ' + (error as Error).message, ESYS_ToastMessageType.ERROR);
        return false;
    }
}

async function listCheckpoints() {
    const db = await checkpointsDb;
    const currentPageId = await getCurrentPageId();
    const checkpoints = await db.checkpoints.find({}).catch(() => []) as Checkpoint[];

    return checkpoints
        .map(checkpoint => ({
            _id: checkpoint._id,
            timestamp: checkpoint.timestamp,
            name: checkpoint.name == null ? `Unnamed — ${new Date(checkpoint.timestamp).toISOString()}` : String(checkpoint.name),
            pageId: checkpoint.pageId,
            isCurrentPage: Boolean(checkpoint.pageId) && checkpoint.pageId === currentPageId,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
}

async function readCheckpoint(id: string) {
    const db = await checkpointsDb;
    const checkpoint = await db.checkpoints.find({ _id: id }).then(r => r[0]).catch(() => undefined) as Checkpoint | undefined;
    if (!checkpoint) return null;

    return {
        _id: checkpoint._id,
        timestamp: checkpoint.timestamp,
        name: checkpoint.name == null ? undefined : String(checkpoint.name),
        pageId: checkpoint.pageId,
        content: checkpoint.content,
    };
}

export const checkpointer = {
    pin: (id: string, expiresAt: number) => { pinned.set(id, expiresAt); },
    unpin: (id: string) => { pinned.delete(id); },
    restore: restoreCheckpoint,
    save: saveCheckpoint,
    list: listCheckpoints,
    read: readCheckpoint,
    hasCheckpoint: () => !!lastCheckpoint
}
