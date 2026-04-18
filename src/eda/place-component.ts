import { to2, withTimeout } from "./utils";

const isOffline = eda.sys_Environment.isHalfOfflineMode() || eda.sys_Environment.isOfflineMode();

export const placeComponent = async (data: { libraryUuid: string, uuid: string }, { x, y, rotate, mirror, addIntoBom, addIntoPcb, subPartName }:
    { x: number, y: number, rotate?: number, mirror?: boolean, addIntoBom?: boolean, addIntoPcb?: boolean, subPartName?: string }) => {
    let maybeLibUuid;

    if (isOffline) {
        maybeLibUuid = [...new Set(['0819f05c4eef4c71ace90d822a990e87', 'f5af0881d090439f925343ec8aedf154', data.libraryUuid])];
    }
    else {
        maybeLibUuid = [data.libraryUuid];
    }

    let comp;

    for (const lib of maybeLibUuid) {
        try {
            const compPromise = eda.sch_PrimitiveComponent.create({
                uuid: data.uuid,
                libraryUuid: lib,
            }, to2(x), to2(y), subPartName, rotate, mirror, addIntoBom, addIntoPcb);

            if (isOffline)
                comp = await withTimeout(compPromise, 25000);
            else
                comp = await compPromise;

        } catch (error) {
            comp = undefined;
        }

        if (comp) break;
    }

    if (!comp) throw new Error("Component not found");

    return comp as ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1;
};