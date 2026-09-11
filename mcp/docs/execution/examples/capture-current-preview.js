// Async function body for execute_js. Capture the current viewport and visible layers.
const expectedUuid = 'REPLACE_WITH_CURRENT_DOCUMENT_UUID';
async function assertDocument() {
    if ((await eda.dmt_SelectControl.getCurrentDocumentInfo())?.uuid !== expectedUuid) {
        throw new Error('Wrong active document');
    }
}
await assertDocument();
const image = await eda.dmt_EditorControl.getCurrentRenderedAreaImage();
if (!image) throw new Error('Native canvas did not return an image');
await assertDocument();
// Returning the native Blob makes execute_js save it on the MCP host.
return image;
