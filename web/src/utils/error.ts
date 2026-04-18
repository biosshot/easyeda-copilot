import { t } from '../i18n';

export const formatError = (e: unknown) => {
    const eMessage = e instanceof Error ? e.message : String(e);
    const isAbort = /aborted|AbortError/i.test(eMessage);
    const errMsg = isAbort
        ? t('error.requestCancelled')
        : eMessage.startsWith('Request failed')
            ? eMessage
            : t('error.requestFailed', { error: eMessage });
    return errMsg;
}