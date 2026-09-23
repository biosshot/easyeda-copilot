// Async function body for execute_js. Inspect with apply: false before changing the page.
// Use a DRAWING device from a library. Width/Height below verify that device;
// they do not resize an existing symbol or create a new custom-sized drawing.
const target = {
    pageUuid: 'REPLACE_WITH_CURRENT_SCHEMATIC_PAGE_UUID',
    libraryUuid: 'REPLACE_WITH_DRAWING_LIBRARY_UUID', // Empty = system library.
    deviceUuid: 'REPLACE_WITH_DRAWING_DEVICE_UUID', // Empty = search by exact deviceName.
    deviceName: '', // Optional when deviceUuid is set; otherwise required for search.
    width: 1655, // Replace with the custom drawing's actual Width.
    height: 1170, // Replace with the custom drawing's actual Height.
    apply: false,
};

if (target.pageUuid.startsWith('REPLACE_')) throw new Error('Set pageUuid first');
if (target.libraryUuid.startsWith('REPLACE_')) throw new Error('Set libraryUuid, or use an empty string for the system library');
if (target.deviceUuid.startsWith('REPLACE_')) throw new Error('Set deviceUuid, or use an empty string to search by deviceName');
if (!target.deviceUuid && !target.deviceName) throw new Error('Set deviceUuid or deviceName');
if (![target.width, target.height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Set the expected Width and Height of the drawing device');
}

async function currentPage() {
    const [document, page] = await Promise.all([
        eda.dmt_SelectControl.getCurrentDocumentInfo(),
        eda.dmt_Schematic.getCurrentSchematicPageInfo(),
    ]);
    if (document?.uuid !== target.pageUuid || document?.documentType !== 1 || page?.uuid !== target.pageUuid) {
        throw new Error('The requested schematic page is not active');
    }
    return page;
}

function property(object, name) {
    const entry = Object.entries(object ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry?.[1];
}

function pageDescription(page) {
    const data = page.titleBlockData ?? {};
    return {
        uuid: page.uuid,
        symbol: property(data, 'Symbol')?.value,
        width: Number(property(data, 'Width')?.value),
        height: Number(property(data, 'Height')?.value),
    };
}

const before = pageDescription(await currentPage());
const libraryUuid = target.libraryUuid || await eda.lib_LibrariesList.getSystemLibraryUuid();
if (!libraryUuid) throw new Error('Drawing library is unavailable');

let deviceUuid = target.deviceUuid;
if (!deviceUuid) {
    // Search returns device UUIDs, not the project's placed-part IDs.
    const pageSize = 100;
    const matches = [];
    for (let page = 1; page <= 10; page++) {
        const results = await eda.lib_Device.search(target.deviceName, libraryUuid, [], 20, pageSize, page);
        matches.push(...results.filter(item => item.name === target.deviceName && item.libraryUuid === libraryUuid));
        if (results.length < pageSize) break;
        if (page === 10) throw new Error('Drawing search was truncated; specify deviceUuid');
    }
    if (matches.length !== 1) throw new Error(`Expected one exact drawing device; found ${matches.length}`);
    deviceUuid = matches[0].uuid;
}

const device = await eda.lib_Device.get(deviceUuid, libraryUuid);
if (!device || device.uuid !== deviceUuid || device.libraryUuid !== libraryUuid) {
    throw new Error('Drawing device is unavailable in the selected library');
}
if (target.deviceName && device.name !== target.deviceName) {
    throw new Error(`Device name differs: ${device.name}`);
}
const association = device.association;
const symbolUuid = association?.symbol?.uuid ?? association?.symbolUuid;
const symbolLibraryUuid = association?.symbol?.libraryUuid ?? libraryUuid;
const symbolType = association?.symbol?.type ?? association?.symbolType;
if (!symbolUuid || symbolType !== 20) throw new Error('Device symbol is not DRAWING');
const symbol = await eda.lib_Symbol.get(symbolUuid, symbolLibraryUuid);
if (!symbol || symbol.type !== 20) throw new Error('Associated DRAWING symbol is unavailable');

const drawingSize = {
    width: Number(property(device.property?.otherProperty, 'Width')),
    height: Number(property(device.property?.otherProperty, 'Height')),
};
if (drawingSize.width !== target.width || drawingSize.height !== target.height) {
    throw new Error(`Drawing dimensions differ: ${drawingSize.width} x ${drawingSize.height}`);
}

const selected = { libraryUuid, deviceUuid, deviceName: device.name, symbolName: symbol.name, ...drawingSize };
if (!target.apply) return { applied: false, before, selected };

await currentPage(); // Recheck after asynchronous library lookups.
await eda.sch_PrimitiveComponent.create(device, 0, 0);
const after = pageDescription(await currentPage());
return {
    applied: true,
    before,
    after,
    selected,
    verified: after.symbol === symbol.name && after.width === target.width && after.height === target.height,
};
