interface Checkpoint {
    id: string,
    timestamp: number,
    content: string,
}

let lastCheckpoint: Checkpoint | undefined;

const generateInsecureToken = (length = 16) => {
    return (Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2))
        .substring(0, length);
};

async function saveCheckpoint() {
    try {
        const content = await eda.sys_FileManager.getDocumentSource();
        if (!content) return null;
        const id = generateInsecureToken(16);

        const checkpoint: Checkpoint = {
            id,
            timestamp: Date.now(),
            content: content,
        };

        lastCheckpoint = checkpoint;
        return checkpoint;
    } catch (e) {
        eda.sys_Message.showToastMessage('Failed to save checkpoint: ' + (e as Error).message, ESYS_ToastMessageType.ERROR);
        return null;
    }
}

async function restoreCheckpoint(checkpoint: Checkpoint | undefined = lastCheckpoint) {
    if (!checkpoint) {
        eda.sys_Message.showToastMessage('Not found checkpoint to restore', ESYS_ToastMessageType.INFO);
        return false;
    }

    if (checkpoint === lastCheckpoint) {
        lastCheckpoint = undefined;
    }

    try {
        const success = await eda.sys_FileManager.setDocumentSource(checkpoint.content);
        return success;
    } catch (e) {
        eda.sys_Message.showToastMessage('Failed to restore checkpoint: ' + (e as Error).message, ESYS_ToastMessageType.ERROR);
        return false;
    }
}

export const checkpointer = {
    restore: restoreCheckpoint,
    save: saveCheckpoint,
    hasCheckpoint: () => !!lastCheckpoint,
}

