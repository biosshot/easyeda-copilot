// Async function body for execute_js. Copy and set the observed target UUID.
const expectedDocument = 'REPLACE_WITH_TARGET_PCB_UUID';
if (expectedDocument === 'REPLACE_WITH_TARGET_PCB_UUID') throw new Error('Set the target PCB UUID before execution');
async function assertDocument() {
    const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
    if (doc?.uuid !== expectedDocument || doc?.documentType !== 3) throw new Error('Target PCB is not active');
}
await assertDocument();
const startedAt = new Date().toISOString();
const pours = await eda.pcb_PrimitivePour.getAll();
const rebuilds = [];
for (const pour of pours) {
    await assertDocument();
    const id = pour.getState_PrimitiveId();
    try {
        const poured = await pour.rebuildCopperRegion();
        rebuilds.push({ primitive_id: id, status: poured ? 'rebuilt' : 'unconfirmed' });
    } catch (error) {
        rebuilds.push({ primitive_id: id, status: 'failed', error: String(error) });
    }
    await assertDocument();
}
const filled = (await eda.pcb_PrimitivePoured.getAll()).map(poured => ({
    pour_id: poured.getState_PourPrimitiveId(),
    fill_count: poured.getState_PourFills().length,
}));
await assertDocument();
const drc = await eda.pcb_Drc.check(true, false, true);
if (!Array.isArray(drc)) throw new Error('Native DRC did not return detailed results');
await assertDocument();
let violationCount = 0;
for (const category of drc) {
    if (!Array.isArray(category.list)) throw new Error('Unexpected DRC category shape');
    for (const group of category.list) {
        if (!Array.isArray(group.list)) throw new Error('Unexpected DRC group shape');
        violationCount += group.list.length;
    }
}
return {
    document_uuid: expectedDocument, started_at: startedAt, finished_at: new Date().toISOString(),
    consistency: 'document-identity-checked; no revision lock',
    rebuilds, filled, refill_confirmed: rebuilds.every(item => item.status === 'rebuilt'),
    violation_count: violationCount, drc_passed: violationCount === 0, drc,
};
