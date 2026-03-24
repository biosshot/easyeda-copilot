

function withTimeout<T>(
    promise: T,
    timeout_ms: number,
    errorMessage = 'Operation timeout'
): Promise<T> {
    let timeoutId: number;

    const timeoutPromise = new Promise<never>((_, reject) => {
        // @ts-ignore
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeout_ms);
    });

    // @ts-ignore
    const safePromise = promise.then((result) => {
        if (timeoutId) clearTimeout(timeoutId);
        return result;

        // @ts-ignore
    }).catch((err) => {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
    });

    return Promise.race([safePromise, timeoutPromise]);
}

export const placeComponent = async (part_uuid: string) => {
    let maybeLibUuid;
    const isOffline = eda.sys_Environment.isHalfOfflineMode() || eda.sys_Environment.isOfflineMode();

    if (isOffline) {
        maybeLibUuid = ['0819f05c4eef4c71ace90d822a990e87', 'f5af0881d090439f925343ec8aedf154', 'lcsc'];
    }
    else {
        maybeLibUuid = ['lcsc'];
    }

    let comp;

    for (const lib of maybeLibUuid) {
        try {
            const compPromise = eda.sch_PrimitiveComponent.placeComponentWithMouse({
                libraryUuid: lib,
                uuid: part_uuid
            });

            if (isOffline)
                comp = await withTimeout(compPromise, 3000);
            else
                comp = await compPromise;

        } catch (error) {
            comp = undefined;
        }

        if (comp) break;
    }

    if (!comp) throw new Error("Component place failed");
}