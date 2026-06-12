import { to2, withTimeout } from "./utils";

const isOffline = eda.sys_Environment.isHalfOfflineMode() || eda.sys_Environment.isOfflineMode();

const SYS_LIB_UUID = eda.lib_LibrariesList.getSystemLibraryUuid();
const ECHOSYS_LIB = 'f5af0881d090439f925343ec8aedf154';

export async function getLibraryUuidList(libraryUuid?: string) {
    const maybeLibUuid = [];
    const sys_lib = await SYS_LIB_UUID;

    if (libraryUuid && libraryUuid?.toLowerCase() !== 'lcsc') {
        maybeLibUuid.push(libraryUuid);
    }

    if (sys_lib) {
        maybeLibUuid.push(sys_lib);
    }

    maybeLibUuid.push(ECHOSYS_LIB);

    return maybeLibUuid
}

export const placeComponent = async (data: { libraryUuid: string, uuid: string }, { x, y, rotate, mirror, addIntoBom, addIntoPcb, subPartName }:
    { x: number, y: number, rotate?: number, mirror?: boolean, addIntoBom?: boolean, addIntoPcb?: boolean, subPartName?: string }) => {
    const maybeLibUuid = await getLibraryUuidList(data.libraryUuid);

    let comp;

    for (const lib of maybeLibUuid) {
        try {
            const compPromise = eda.sch_PrimitiveComponent.create({
                uuid: data.uuid,
                libraryUuid: lib,
            }, to2(x), to2(y), subPartName, rotate, mirror, addIntoBom, addIntoPcb);

            comp = await withTimeout(compPromise, 25000);
        } catch (error) {
            comp = undefined;
        }

        if (comp) break;
    }

    if (!comp) throw new Error(`Component not found: ${data.uuid}; ${data.libraryUuid}`);

    return comp as ISCH_PrimitiveComponent | ISCH_PrimitiveComponent$1;
};