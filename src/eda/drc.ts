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

export async function checkPcbDrc(limit: number): Promise<SimplifiedDrcCategory[]> {
    const drcResult = await eda.pcb_Drc.check(true, false, true);
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
