import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryScopes, searchComponentLibraries } from '../src/eda/library-search.ts';

const globals = globalThis as typeof globalThis & { eda: Record<string, unknown> };

function useLibraryApi() {
    const calls: string[] = [];
    const search = async (_query: string, library: string) => {
        calls.push(library);
        return [{ uuid: `device-${library}`, libraryUuid: library }];
    };
    globals.eda = {
        lib_LibrariesList: {
            getSystemLibraryUuid: async () => 'system-uuid',
            getPersonalLibraryUuid: async () => 'personal-uuid',
            getProjectLibraryUuid: async () => 'project-uuid',
            getFavoriteLibraryUuid: async () => 'favorite-uuid',
        },
        lib_Device: { search },
        lib_Footprint: { search },
        lib_PanelLibrary: { search },
    };
    return calls;
}

test('searches every editor library section without flattening duplicate results', async () => {
    const calls = useLibraryApi();
    const result = await searchComponentLibraries({ query: 'PCA9685', libraries: ['all'], limit: 1 });
    assert.deepEqual(result.requestedScopes, [...libraryScopes]);
    assert.equal(result.sections.length, 8);
    assert.equal(result.sections.every(section => section.count === 1 && !section.error), true);
    assert.deepEqual(calls, [
        'system-uuid', 'recent', 'personal-uuid', 'project-uuid',
        'user', 'stdPublic', 'favorite-uuid', 'lcsc',
    ]);
    assert.equal('flatResults' in result, false);
});

test('reports a failed section without discarding successful sections', async () => {
    useLibraryApi();
    const libraries = globals.eda.lib_LibrariesList as { getPersonalLibraryUuid: () => Promise<string> };
    libraries.getPersonalLibraryUuid = async () => { throw new Error('offline'); };
    const result = await searchComponentLibraries({ query: 'ESP32-S3' });
    assert.equal(result.sections.filter(section => section.error).length, 1);
    assert.equal(result.sections.filter(section => section.count === 1).length, 7);
});

test('validates query, selections, and pagination before searching', async () => {
    useLibraryApi();
    await assert.rejects(searchComponentLibraries({ query: '' }), /Missing query/);
    await assert.rejects(searchComponentLibraries({ query: 'x', libraries: ['unknown'] }), /selection/);
    await assert.rejects(searchComponentLibraries({ query: 'x', page: 1.5 }), /pagination/);
});
