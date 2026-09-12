export const formatError = (e: unknown) => {
    const eMessage = e instanceof Error ? e.message : String(e);
    const isAbort = /aborted|AbortError/i.test(eMessage);
    const errMsg = isAbort
        ? 'Request cancelled by user.'
        : eMessage.startsWith('Request failed')
            ? eMessage
            : `Request failed: ${eMessage}`;
    return errMsg;
}