// Copy this script and fill in an existing record from a fresh source snapshot.
const edit = {
    documentUuid: 'REPLACE_WITH_CURRENT_DOCUMENT_UUID',
    docType: 'SCH_PAGE', // Use 'PCB' for a PCB source.
    type: 'TEXT',
    id: 'REPLACE_WITH_RECORD_ID',
    expected: { value: 'Existing note' },
    changes: { value: 'Updated note' },
    apply: false,
};

const document = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (document?.uuid !== edit.documentUuid) throw new Error('Wrong active document');
const source = await eda.sys_FileManager.getDocumentSource();
if (!source) throw new Error('Document source is unavailable');

// Keep line endings, the final terminator, outer identities and untouched lines.
function readRecords(text) {
    const pieces = text.split(/(\r\n|\n)/);
    const records = [];
    for (let index = 0; index < pieces.length; index += 2) {
        const line = pieces[index];
        if (!line.trim()) continue;
        const separator = line.indexOf('||');
        if (separator < 0) throw new Error('Missing record separator');
        const suffix = line.endsWith('|') ? '|' : '';
        const payload = line.slice(separator + 2, suffix ? -1 : undefined);
        records.push({ index, suffix,
            outer: JSON.parse(line.slice(0, separator).replace(/^\uFEFF/, '')),
            inner: payload ? JSON.parse(payload) : null });
    }
    const headers = records.filter(record => record.outer.type === 'DOCHEAD');
    if (headers.length !== 1 || records[0] !== headers[0]
        || headers[0].inner?.uuid !== edit.documentUuid || headers[0].inner?.docType !== edit.docType) {
        throw new Error('Expected one matching document snapshot');
    }
    const identities = new Set();
    for (const record of records) {
        const key = JSON.stringify([record.outer.type, record.outer.id ?? null]);
        if (identities.has(key)) throw new Error('Repeated record identity: resolve log history first');
        identities.add(key);
    }
    return { pieces, records };
}

// In 3.2.149, each export regenerates these three header fields even without edits.
// Compare all other fields, including document UUID/type and editor version.
function snapshotContent(records) {
    return JSON.stringify(records.map(({ outer, inner }) => {
        if (outer.type !== 'DOCHEAD') return { outer, inner };
        const header = { ...inner };
        for (const key of ['client', 'version', 'updateTime']) delete header[key];
        return { outer, inner: header };
    }));
}

const { records } = readRecords(source);
const target = records.find(record => record.outer.type === edit.type && record.outer.id === edit.id);
if (!target || !target.inner || typeof target.inner !== 'object' || Array.isArray(target.inner)) {
    throw new Error('Expected an existing record with an object payload');
}
if (edit.type === 'DOCHEAD') throw new Error('This example edits primitive fields, not document identity');
if (target.inner.locked) throw new Error('Target record is locked');
const isScalar = value => value === null || ['string', 'boolean'].includes(typeof value)
    || (typeof value === 'number' && Number.isFinite(value));
const keys = Object.keys(edit.changes);
if (!keys.length) throw new Error('No changes specified');
for (const key of keys) {
    if (!Object.hasOwn(target.inner, key) || !Object.hasOwn(edit.expected, key)
        || !isScalar(edit.expected[key]) || !isScalar(edit.changes[key])
        || target.inner[key] !== edit.expected[key]) {
        throw new Error('Field shape or old value changed: ' + key);
    }
}
const after = { ...target.inner, ...edit.changes };
const changed = keys.some(key => target.inner[key] !== after[key]);
if (!changed || !edit.apply) {
    return { applied: false, changed, documentUuid: edit.documentUuid,
        type: edit.type, id: edit.id, before: target.inner, after };
}
const tickets = records.map(record => record.outer.ticket).filter(value => value !== undefined);
if (!tickets.every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Unexpected ticket format');
const ticket = tickets.reduce((max, value) => Math.max(max, value), 0) + 1;
if (!Number.isSafeInteger(ticket)) throw new Error('Ticket counter overflow');
const latest = await eda.sys_FileManager.getDocumentSource();
if (!latest) throw new Error('Document source is unavailable before write');
const latestSnapshot = readRecords(latest);
const current = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (snapshotContent(latestSnapshot.records) !== snapshotContent(records)
    || current?.uuid !== document.uuid || current?.documentType !== document.documentType) {
    throw new Error('Document changed while preparing the edit; inspect the current state');
}
const latestTarget = latestSnapshot.records.find(record => record.outer.type === edit.type && record.outer.id === edit.id);
latestSnapshot.pieces[latestTarget.index] = JSON.stringify({ ...latestTarget.outer, ticket }) + '||'
    + JSON.stringify(after) + latestTarget.suffix;
const nextSource = latestSnapshot.pieces.join('');
readRecords(nextSource);
if (!await eda.sys_FileManager.setDocumentSource(nextSource)) throw new Error('EasyEDA rejected the source');
if ((await eda.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== document.uuid) {
    throw new Error('Active document changed after write; verify the original document');
}
const readback = await eda.sys_FileManager.getDocumentSource();
if (!readback) throw new Error('Write accepted but readback is unavailable');
const actual = readRecords(readback).records.find(record => record.outer.type === edit.type && record.outer.id === edit.id);
if (!actual || keys.some(key => actual.inner?.[key] !== after[key])) {
    throw new Error('Write accepted but target fields did not match; inspect before retrying');
}
return { applied: true, documentUuid: edit.documentUuid, type: edit.type, id: edit.id,
    before: target.inner, after: actual.inner, verification: 'Source readback only; run the affected stage checks.' };
