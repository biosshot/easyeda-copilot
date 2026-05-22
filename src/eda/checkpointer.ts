import AppDBClient from 'appdb';
import "@copilot/shared/types/eda";

interface Checkpoint {
    _id: string,
    timestamp: number,
    content: string,
    pageId?: string
}

const checkpointsDb = new AppDBClient(false).init('checkpoints', {
    checkpoints: ['timestamp', 'content', '_id', 'pageId']
});

let lastCheckpoint: Checkpoint | undefined;

const generateInsecureToken = (length = 16) => {
    return (Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2))
        .substring(0, length);
};

const getCurrentPageId = async () => {
    const page = await eda.dmt_Schematic.getCurrentSchematicPageInfo().catch(() => undefined);
    return page?.uuid;
}

async function saveCheckpoint(minor: boolean) {
    try {
        const content = await eda.sys_FileManager.getDocumentSource();
        if (!content) {
            eda.sys_Message.showToastMessage('Failed insert checkpoint to db: not found content', ESYS_ToastMessageType.WARNING);
            return null;
        }

        const checkpoint: Checkpoint = {
            _id: generateInsecureToken(16),
            timestamp: Date.now(),
            content,
            pageId: await getCurrentPageId()
        };

        if (!minor) {
            const db = await checkpointsDb;
            const allCheckpoints = await db.checkpoints.find({});

            if (allCheckpoints.length >= 512) {
                const sorted = allCheckpoints.sort((a, b) => a.timestamp! - b.timestamp!);
                for (const item of sorted.slice(0, sorted.length - 99)) {
                    db.checkpoints.remove({ _id: item._id });
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

async function restoreCheckpoint(id?: string) {
    let checkpoint: Checkpoint | undefined;

    if (!id) {
        checkpoint = lastCheckpoint;
    }
    else {
        const db = await checkpointsDb;
        checkpoint = await db.checkpoints.find({ _id: id }).then(r => r[0]).catch(() => undefined) as Checkpoint | undefined;
    }

    if (!checkpoint) {
        eda.sys_Message.showToastMessage('Not found checkpoint to restore', ESYS_ToastMessageType.INFO);
        return false;
    }

    if (checkpoint.pageId && checkpoint.pageId !== await getCurrentPageId()) {
        eda.sys_Message.showToastMessage('This checkpoint was not created for this page.', ESYS_ToastMessageType.ERROR);
        return false;
    }

    if (!await confirmationMessage('Are you sure you want to restore this checkpoint? Current changes may be lost.', 'Restore'))
        return false;

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
            pageId: checkpoint.pageId,
            isCurrentPage: !checkpoint.pageId || checkpoint.pageId === currentPageId,
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
        pageId: checkpoint.pageId,
        content: checkpoint.content,
    };
}

export const checkpointer = {
    restore: restoreCheckpoint,
    save: saveCheckpoint,
    list: listCheckpoints,
    read: readCheckpoint,
    hasCheckpoint: () => !!lastCheckpoint
}
