export const libraryScopes = [
    'system', 'recent', 'personal', 'project', 'public', 'std_edition_public', 'favorite', 'lcsc',
] as const;

type Scope = typeof libraryScopes[number];
type Kind = 'device' | 'footprint' | 'panel_library';

const labels: Record<Scope, string> = {
    system: 'System',
    recent: 'Recent',
    personal: 'Personal',
    project: 'Project',
    public: 'Public',
    std_edition_public: 'Std Edition Public',
    favorite: 'Favorite',
    lcsc: 'LCSC',
};

const aliases: Partial<Record<Scope, string>> = {
    recent: 'recent', public: 'user', std_edition_public: 'stdPublic', lcsc: 'lcsc',
};

export async function resolveLibrary(scope: Scope): Promise<string> {
    if (aliases[scope]) return aliases[scope];
    const getters = {
        system: () => eda.lib_LibrariesList.getSystemLibraryUuid(),
        personal: () => eda.lib_LibrariesList.getPersonalLibraryUuid(),
        project: () => eda.lib_LibrariesList.getProjectLibraryUuid(),
        favorite: () => eda.lib_LibrariesList.getFavoriteLibraryUuid(),
    };
    const uuid = await getters[scope as keyof typeof getters]();
    if (!uuid) throw new Error(`No ${labels[scope]} library is available in this editor.`);
    return uuid;
}

function choices<T extends string>(input: unknown, allowed: readonly T[], defaults: readonly T[]): T[] {
    const raw: readonly unknown[] = input === undefined ? defaults : Array.isArray(input) ? input : [input];
    if (!raw.length) return [...defaults];
    if (raw.some(item => item !== 'all' && !allowed.includes(item as T))) {
        throw new Error('Invalid library search selection');
    }
    return raw.includes('all') ? [...allowed] : [...new Set(raw)] as T[];
}

export async function searchComponentLibraries(body: Record<string, unknown>) {
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) throw new Error('Missing query');
    const kinds = choices<Kind>(body.kind, ['device', 'footprint', 'panel_library'], ['device']);
    const scopes = choices(body.libraries, libraryScopes, libraryScopes);
    const integer = (value: unknown, fallback: number, max: number) => {
        if (value === undefined) return fallback;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
            throw new Error('Invalid search pagination');
        }
        return value;
    };
    const limit = integer(body.limit, 10, 50);
    const page = integer(body.page, 1, 100);
    const sections = [];

    for (const scope of scopes) {
        let libraryUuid: string;
        try {
            libraryUuid = await resolveLibrary(scope);
        } catch (error) {
            for (const kind of kinds) {
                sections.push({ scope, section: labels[scope], kind, count: 0, results: [], error: String(error) });
            }
            continue;
        }
        for (const kind of kinds) {
            try {
                const raw = kind === 'device'
                    ? await eda.lib_Device.search(query, libraryUuid, undefined, undefined, limit, page)
                    : kind === 'footprint'
                        ? await eda.lib_Footprint.search(query, libraryUuid, undefined, limit, page)
                        : await eda.lib_PanelLibrary.search(query, libraryUuid, undefined, limit, page);
                const results = raw.map(item => ({ ...item, libraryUuid: item.libraryUuid || libraryUuid }));
                sections.push({ scope, section: labels[scope], kind, libraryUuid, count: results.length, results });
            } catch (error) {
                sections.push({
                    scope, section: labels[scope], kind, libraryUuid, count: 0, results: [], error: String(error),
                });
            }
        }
    }
    return { query, kinds, requestedScopes: scopes, limit, page, sections };
}
