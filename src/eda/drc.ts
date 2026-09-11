import type { InspectPcbNet, SimplifiedDrcCategory, SimplifiedDrcViolation } from '@copilot/shared/types/pcb/explain';

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
        primitive_ids: Array.isArray(item.objs) ? item.objs.filter((id): id is string => typeof id === 'string') : undefined,
        rule_name: typeof item.ruleName === 'string' ? item.ruleName : undefined,
        layer: typeof item.layer === 'string' ? item.layer : undefined,
        // Preserve native object descriptors, parameters and errData for repair.
        // In particular, errData coordinates are NOT native PCB mil or normalized mm.
        native: {
            obj1: item.obj1, obj2: item.obj2,
            explanation: item.explanation, pos: item.pos,
            globalIndex: item.globalIndex, errorObjType: item.errorObjType,
            ruleTypeName: item.ruleTypeName,
        },
    };
}

export async function checkPcbDrc(limit: number): Promise<SimplifiedDrcCategory[]> {
    const drcResult = await eda.pcb_Drc.check(true, false, true);
    if (!Array.isArray(drcResult)) throw new Error('Native PCB DRC did not return detailed results');
    const violations = drcResult;

    return violations.map(category => {
        const rawCategory = category as Record<string, unknown>;
        const groups = Array.isArray(rawCategory.list)
            ? (rawCategory.list as Array<{ name: string; list: Array<Record<string, unknown>> }>)
            : [];
        const nonEmptyGroups = groups.filter(group => Array.isArray(group.list) && group.list.length);
        const perGroup = Math.max(1, Math.floor(limit / Math.max(1, nonEmptyGroups.length)));

        return {
            name: rawCategory.name as string,
            violation_count: nonEmptyGroups.reduce((sum, group) => sum + group.list.length, 0),
            truncated: nonEmptyGroups.some(group => group.list.length > perGroup),
            list: nonEmptyGroups.map(group => ({
                name: group.name,
                violation_count: group.list.length,
                truncated: group.list.length > perGroup,
                list: group.list.slice(0, perGroup).map(simplifyItem),
            })).filter(group => group.list.length > 0),
        };
    }).filter(category => category.list.length > 0);
}

/** Return native findings for this net, filtering before limiting details. */
export async function checkPcbNetDrc(net: string, limit: number): Promise<InspectPcbNet['drc']> {
    const result = await eda.pcb_Drc.check(true, false, true);
    if (!Array.isArray(result)) throw new Error('Native PCB DRC did not return detailed results');
    const token = `(${net})`;
    const mentionsNet = (suffix?: string) => suffix === token || suffix?.startsWith(token + ':') || suffix?.startsWith(token + ' ');
    const violations: SimplifiedDrcViolation[] = [];
    for (const category of result) {
        for (const group of category.list ?? []) {
            for (const item of group.list ?? []) {
                const violation = simplifyItem(item);
                if (group.name !== net && !mentionsNet(violation.obj1) && !mentionsNet(violation.obj2)) continue;
                violations.push(violation);
            }
        }
    }
    const count = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 24;
    return {
        violation_count: violations.length,
        truncated: violations.length > count,
        violations: violations.slice(0, count),
    };
}
