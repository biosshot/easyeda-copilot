import assert from 'node:assert/strict';
import test from 'node:test';
import { readPartUuidFromPrimitive, storePartUuidOnPrimitive, resolvedPartUuid } from '../src/eda/component-part-ref';
const deviceUuid = '32d67bb993d443e996e7aab9f54dbcf6';

function primitive(component: { uuid: string; libraryUuid: string }, initial: Record<string, unknown> = {}) {
    let properties = { ...initial };
    return {
        getState_Component: () => component,
        getState_OtherProperty: () => properties,
        setState_OtherProperty: (next: Record<string, string | number | boolean>) => {
            properties = next;
        },
        properties: () => properties,
    };
}

test('stores and restores a public-library device reference without losing existing properties', () => {
    const value = primitive(
        { uuid: 'symbol-uuid', libraryUuid: 'public-library' },
        { Value: 'PCA9685' },
    );

    storePartUuidOnPrimitive(value, { uuid: deviceUuid, libraryUuid: 'public-library' });

    assert.deepEqual(readPartUuidFromPrimitive(value), {
        uuid: deviceUuid,
        libraryUuid: 'public-library',
    });
    assert.equal(value.properties().Value, 'PCA9685');
});

test('preserves the original LCSC device in the same metadata as public components', () => {
    const value = primitive({
        uuid: 'local-device-uuid',
        libraryUuid: '0819f05c4eef4c71ace90d822a990e87',
    });

    storePartUuidOnPrimitive(value, deviceUuid);

    assert.equal(readPartUuidFromPrimitive(value), deviceUuid);
    assert.equal(Object.keys(value.properties()).length, 1);
});

test('missing or throwing metadata APIs are optional for readback and placement', () => {
    assert.equal(readPartUuidFromPrimitive({}), null);
    assert.equal(storePartUuidOnPrimitive({}, deviceUuid), false);
    const native = { getState_Component: () => ({ uuid: deviceUuid, libraryUuid: 'lcsc' }),
        getState_OtherProperty: () => { throw new Error('unsupported'); } };
    assert.equal(readPartUuidFromPrimitive(native), deviceUuid);
    let writes = 0;
    assert.equal(storePartUuidOnPrimitive({ ...native, setState_OtherProperty: () => { writes++; } }, deviceUuid), false);
    assert.equal(writes, 0, 'unreadable existing properties must not be overwritten');
    assert.equal(storePartUuidOnPrimitive({ getState_OtherProperty: () => ({}),
        setState_OtherProperty: () => { throw new Error('unsupported'); } }, deviceUuid), false);
    assert.equal(readPartUuidFromPrimitive({ getState_Component: () => { throw new Error('unsupported'); } }), null);
});

test('unresolved IDs become null; uppercase original IDs normalize to the legacy schema', () => {
    for (const uuid of ['a9f4d7ddbdc45ac8', '0'.repeat(32), 'bad']) {
        assert.equal(resolvedPartUuid(uuid), null);
        assert.equal(resolvedPartUuid({ uuid, libraryUuid: 'user' }), null);
    }
    assert.equal(resolvedPartUuid(deviceUuid.toUpperCase()), deviceUuid);
});

test('malformed and null metadata do not break readback', () => {
    for (const metadata of ['{', 'null', '{}']) {
        const value = primitive({ uuid: 'native', libraryUuid: 'public' }, { 'EasyEDA Copilot Part Ref': metadata });
        assert.deepEqual(readPartUuidFromPrimitive(value), { uuid: 'native', libraryUuid: 'public' });
    }
});

test('falls back to the native component reference for pre-existing symbols', () => {
    const value = primitive({ uuid: 'symbol-uuid', libraryUuid: 'public-library' });

    assert.deepEqual(readPartUuidFromPrimitive(value), {
        uuid: 'symbol-uuid',
        libraryUuid: 'public-library',
    });
});
