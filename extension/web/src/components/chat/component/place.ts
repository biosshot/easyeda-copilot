import '@copilot/shared/types/eda';

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
    const maybeLibUuid = await eda.getLibraryUuidList?.() ?? [await eda.lib_LibrariesList.getSystemLibraryUuid() ?? 'lcsc'];

    let comp;

    for (const lib of maybeLibUuid) {
        try {
            const compPromise = eda.sch_PrimitiveComponent.placeComponentWithMouse({
                libraryUuid: lib,
                uuid: part_uuid
            });

            comp = await withTimeout(compPromise, 3000);
        } catch (error) {
            comp = undefined;
        }

        if (comp) break;
    }

    if (!comp) throw new Error("Component place failed");
}