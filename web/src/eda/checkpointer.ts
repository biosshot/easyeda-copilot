import AppDBClient, { AppDBDocument, AppDBStore } from 'appdb';
import '../types/eda'
import { isEasyEda } from './utils';

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
    const page = await eda.dmt_Schematic.getCurrentSchematicPageInfo().catch(e => undefined);
    if (!page) return undefined;
    return page.uuid;
}

async function saveCheckpoint(minor: boolean) {
    try {
        const content = await eda.sys_FileManager.getDocumentSource();
        if (!content) {
            eda.sys_Message.showToastMessage('Failed insert checkpoint to db: not found content', ESYS_ToastMessageType.WARNING);
            return null;
        }
        const id = generateInsecureToken(16);

        const checkpoint: Checkpoint = {
            _id: id,
            timestamp: Date.now(),
            content: content,
            pageId: await getCurrentPageId()
        };

        if (!minor) {
            const db = await checkpointsDb;
            if (db) {
                try {
                    const allChekpoints = await db.checkpoints.find({})

                    if (allChekpoints.length && allChekpoints.length >= 100) {
                        const sortedById = allChekpoints.sort((a, b) => a.timestamp! - b.timestamp!);
                        const toRemove = sortedById.slice(0, sortedById.length - 99);
                        for (const checkpoint of toRemove) {
                            db.checkpoints.remove({ _id: checkpoint._id });
                        }
                    }

                    await db.checkpoints.insert(checkpoint);
                    eda.sys_Message.showToastMessage('Create checkpoint', ESYS_ToastMessageType.SUCCESS);
                } catch (e) {
                    eda.sys_Message.showToastMessage('Failed insert checkpoint to db: ' + (e as Error).message, ESYS_ToastMessageType.ERROR);
                }
            }
        }

        lastCheckpoint = checkpoint;
        return checkpoint._id;
    } catch (e) {
        eda.sys_Message.showToastMessage('Failed to save checkpoint: ' + (e as Error).message, ESYS_ToastMessageType.ERROR);
        return null;
    }
}

const confirmationMessage = (...args: Parameters<typeof eda.sys_Dialog.showConfirmationMessage>) => {
    return new Promise<boolean>((resolve, reject) => {
        eda.sys_Dialog.showConfirmationMessage(args[0], args[1], args[2], args[3], resolve);
    })
}

async function restoreCheckpoint(id?: string) {
    let checkpoint;

    if (!id) {
        checkpoint = lastCheckpoint;
    }
    else {
        const db = await checkpointsDb;
        if (db) {
            checkpoint = await db.checkpoints.find({ _id: id }).then(r => r[0]).catch(e => undefined) as Checkpoint | undefined;
        }
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
        if (success) eda.sys_Message.showToastMessage('Loaded checkpoint', ESYS_ToastMessageType.SUCCESS);
        else eda.sys_Message.showToastMessage('Fail load checkpoint', ESYS_ToastMessageType.ERROR);
        return success;
    } catch (e) {
        eda.sys_Message.showToastMessage('Failed to restore checkpoint: ' + (e as Error).message, ESYS_ToastMessageType.ERROR);
        return false;
    }
}

export const checkpointer = {
    restore: restoreCheckpoint,
    save: saveCheckpoint,
    hasCheckpoint: () => !!lastCheckpoint
}

if (isEasyEda())
    eda.checkpointer = checkpointer;