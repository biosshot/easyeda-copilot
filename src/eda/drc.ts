import type { SimplifiedDrcCategory, SimplifiedDrcViolation } from '@copilot/shared/types/pcb/explain';

function formatDrcMessage(str: string | undefined, param: Record<string, string> | undefined) {
    if (!str || !param) return str ?? '';
    return str.replace(/\{(\w+)\}/g, (_, key) => param[key] ?? `{${key}}`);
}

function simplifyItem(item: Record<string, unknown>): SimplifiedDrcViolation {
    const explanation = item.explanation as Record<string, unknown> | undefined;
    const param = explanation?.param as Record<string, string> | undefined;
    const obj1 = item.obj1 as Record<string, string> | undefined;
    const obj2 = item.obj2 as Record<string, string> | undefined;

    return {
        errorType: item.errorType as string,
        obj1: obj1?.suffix,
        obj2: obj2?.suffix,
        message: formatDrcMessage(explanation?.str as string | undefined, param),
    };
}

function simplifyCategories(drcResult: unknown, limit: number): SimplifiedDrcCategory[] {
    const violations = Array.isArray(drcResult) ? drcResult : [];

    return violations.map(category => {
        const rawCategory = category as Record<string, unknown>;
        const groups = Array.isArray(rawCategory.list)
            ? (rawCategory.list as Array<{ name: string; list: Array<Record<string, unknown>> }>)
            : [];
        const nonEmptyGroups = groups.filter(group => Array.isArray(group.list) && group.list.length);
        const perGroup = Math.max(1, Math.floor(limit / Math.max(1, nonEmptyGroups.length)));

        return {
            name: rawCategory.name as string,
            list: nonEmptyGroups.map(group => ({
                name: group.name,
                list: group.list.slice(0, perGroup).map(simplifyItem),
            })).filter(group => group.list.length > 0),
        };
    }).filter(category => category.list.length > 0);
}

export async function checkPcbDrc(limit: number): Promise<SimplifiedDrcCategory[]> {
    return simplifyCategories(await eda.pcb_Drc.check(true, false, true), limit);
}

/**
 * ERC схемы. Плату проверить было чем, схему — нет, хотя API симметричен.
 * Именно эта проверка ловит висящие входы, конфликты выходов и цепи,
 * случайно слипшиеся в одну.
 */
/**
 * ERC схемы.
 *
 * В отличие от DRC платы, `sch_Drc.check` отдаёт не разбор по нарушениям,
 * а сводку по типам: [{ type: 'warn', count: 35 }]. Деталей в API нет —
 * увидеть их можно только в панели редактора, для этого есть showInEditor.
 */
export async function checkSchematicErc(limit: number, showInEditor = false) {
    const docType = await eda.dmt_SelectControl.getCurrentDocumentInfo().then(d => d?.documentType).catch(() => undefined);
    if (docType !== EDMT_EditorDocumentType.SCHEMATIC_PAGE) {
        throw new Error('Failed checkSchematicErc. Open schematic page doc to fix.');
    }

    const raw = await eda.sch_Drc.check(true, showInEditor, true);
    const entries = Array.isArray(raw) ? raw as Array<Record<string, unknown>> : [];

    const summary = entries
        .filter(entry => typeof entry?.type === 'string')
        .map(entry => ({
            type: entry.type as string,
            count: Number(entry.count) || 0,
        }));

    // Форма могла снова поменяться: если ни одна запись не разобралась,
    // честнее отдать сырой ответ, чем выдать пустоту за отсутствие проблем.
    const unparsed = entries.length > 0 && summary.length === 0;

    return {
        summary,
        errors: summary.filter(s => s.type !== 'warn').reduce((total, s) => total + s.count, 0),
        warnings: summary.filter(s => s.type === 'warn').reduce((total, s) => total + s.count, 0),
        shown_in_editor: showInEditor,
        // Разбор по форме DRC платы: вдруг схема когда-нибудь начнёт отвечать так же.
        violations: simplifyCategories(raw, limit),
        raw: unparsed ? JSON.stringify(entries).slice(0, 600) : undefined,
    };
}
