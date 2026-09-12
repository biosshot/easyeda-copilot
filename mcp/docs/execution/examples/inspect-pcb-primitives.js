// Async function body for execute_js; inspection only.
const expectedUuid = 'REPLACE_WITH_CURRENT_DOCUMENT_UUID';
const ids = ['REPLACE_WITH_PRIMITIVE_ID']; // Use DRC primitive_ids, not display suffixes.
async function assertDocument() {
    const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (doc?.uuid !== expectedUuid || doc?.documentType !== 3) throw new Error('Wrong active PCB');
}
await assertDocument();
const primitives = await eda.pcb_Primitive.getPrimitivesByPrimitiveId(ids);
// Explicit allowlist: never enumerate and invoke arbitrary primitive methods.
const fields = ['PrimitiveId', 'PrimitiveType', 'Net', 'Layer', 'PrimitiveLock',
    'X', 'Y', 'Rotation', 'StartX', 'StartY', 'EndX', 'EndY', 'LineWidth',
    'Diameter', 'HoleDiameter', 'PadNumber', 'Designator'];
const items = primitives.map(primitive => {
    const state = {};
    const errors = {};
    for (const field of fields) {
        const getter = primitive['getState_' + field];
        if (typeof getter !== 'function') continue;
        try { state[field] = getter.call(primitive); }
        catch (error) { errors[field] = String(error); }
    }
    return { state, errors };
});
await assertDocument();
const found = new Set(items.map(item => item.state.PrimitiveId));
return {
    document_uuid: expectedUuid,
    coordinates: 'Native PCB frame; lengths/positions in mil, rotations in degrees. No routing-frame conversion.',
    items, unresolved_ids: ids.filter(id => !found.has(id)),
};
