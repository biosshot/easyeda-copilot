export type DesignatorAnnotationMode = 'preserve' | 'resequence';

export type AnnotatableComponentUnit = {
    pageUuid: string;
    pageName: string;
    pageIndex: number;
    primitiveId: string;
    designator: string;
    subPartName: string;
    uniqueId: string;
    componentKey: string;
    x: number;
    y: number;
};

export type LogicalComponent = {
    key: string;
    units: AnnotatableComponentUnit[];
    designator: string;
    prefix: string;
    number?: string;
    x: number;
    y: number;
    pageIndex: number;
};

export type DesignatorAssignment = {
    component: LogicalComponent;
    designator: string;
};

export type DesignatorAnnotationPlan = {
    assignments: DesignatorAssignment[];
    changed: DesignatorAssignment[];
};

function compareUnits(a: AnnotatableComponentUnit, b: AnnotatableComponentUnit) {
    return a.pageIndex - b.pageIndex || b.y - a.y || a.x - b.x || a.primitiveId.localeCompare(b.primitiveId);
}

export function componentBaseDesignator(designator: string, subPartName: string) {
    if (!subPartName) return designator;

    const explicitPart = designator.match(/^(.*\d+)\.(\d+)$/);
    return explicitPart?.[1] ?? designator;
}

export function splitDesignatorNumber(designator: string) {
    const match = designator.match(/^(.*?)(\d+)$/);
    return match
        ? { prefix: match[1], number: match[2] }
        : { prefix: designator, number: undefined };
}

function makeLogicalComponent(key: string, units: AnnotatableComponentUnit[]): LogicalComponent {
    units.sort(compareUnits);
    const designator = componentBaseDesignator(units[0].designator, units[0].subPartName);
    const { prefix, number } = splitDesignatorNumber(designator);
    return {
        key,
        units,
        designator,
        prefix,
        number,
        pageIndex: Math.min(...units.map(unit => unit.pageIndex)),
        x: Math.min(...units.map(unit => unit.x)),
        y: Math.max(...units.map(unit => unit.y)),
    };
}

export function groupLogicalComponents(units: AnnotatableComponentUnit[]) {
    const sorted = [...units].sort(compareUnits);
    const groups = new Map<string, AnnotatableComponentUnit[]>();
    const fallbackGroups = new Map<string, Array<{ key: string; subParts: Set<string> }>>();
    const subPartsByUniqueId = new Map<string, Set<string>>();

    for (const unit of sorted) {
        if (!unit.uniqueId || !unit.subPartName) continue;
        const subParts = subPartsByUniqueId.get(unit.uniqueId) ?? new Set<string>();
        subParts.add(unit.subPartName);
        subPartsByUniqueId.set(unit.uniqueId, subParts);
    }

    for (const unit of sorted) {
        if (!unit.subPartName) {
            groups.set(`primitive:${unit.pageUuid}:${unit.primitiveId}`, [unit]);
            continue;
        }

        if (unit.uniqueId && (subPartsByUniqueId.get(unit.uniqueId)?.size ?? 0) > 1) {
            const key = `uid:${unit.uniqueId}`;
            const group = groups.get(key) ?? [];
            group.push(unit);
            groups.set(key, group);
            continue;
        }

        const base = componentBaseDesignator(unit.designator, unit.subPartName);
        const fallbackKey = `${base}\u0000${unit.componentKey}`;
        const candidates = fallbackGroups.get(fallbackKey) ?? [];
        let candidate = candidates.find(item => !item.subParts.has(unit.subPartName));
        if (!candidate) {
            candidate = {
                key: `multipart:${fallbackKey}:${candidates.length}`,
                subParts: new Set(),
            };
            candidates.push(candidate);
            fallbackGroups.set(fallbackKey, candidates);
        }
        candidate.subParts.add(unit.subPartName);
        const group = groups.get(candidate.key) ?? [];
        group.push(unit);
        groups.set(candidate.key, group);
    }

    return [...groups].map(([key, group]) => makeLogicalComponent(key, group)).sort((a, b) => (
        a.pageIndex - b.pageIndex || b.y - a.y || a.x - b.x || a.key.localeCompare(b.key)
    ));
}

function nextFreeDesignator(prefix: string, used: Set<string>, nextByPrefix: Map<string, number>) {
    let number = nextByPrefix.get(prefix) ?? 1;
    let candidate = `${prefix}${number}`;
    while (used.has(candidate)) {
        number++;
        candidate = `${prefix}${number}`;
    }
    nextByPrefix.set(prefix, number + 1);
    used.add(candidate);
    return candidate;
}

export function planDesignatorAnnotation(
    units: AnnotatableComponentUnit[],
    mode: DesignatorAnnotationMode,
): DesignatorAnnotationPlan {
    const components = groupLogicalComponents(units);
    const assignments: DesignatorAssignment[] = [];
    const used = new Set<string>();
    const nextByPrefix = new Map<string, number>();

    if (mode === 'preserve') {
        const pending: LogicalComponent[] = [];
        for (const component of components) {
            if (component.number !== undefined && !used.has(component.designator)) {
                used.add(component.designator);
                assignments.push({ component, designator: component.designator });
            } else {
                pending.push(component);
            }
        }
        for (const component of pending) {
            assignments.push({
                component,
                designator: nextFreeDesignator(component.prefix, used, nextByPrefix),
            });
        }
    } else {
        for (const component of components) {
            assignments.push({
                component,
                designator: nextFreeDesignator(component.prefix, used, nextByPrefix),
            });
        }
    }

    assignments.sort((a, b) => (
        a.component.pageIndex - b.component.pageIndex ||
        b.component.y - a.component.y ||
        a.component.x - b.component.x ||
        a.component.key.localeCompare(b.component.key)
    ));
    return {
        assignments,
        changed: assignments.filter(item => item.component.units.some(unit => (
            componentBaseDesignator(unit.designator, unit.subPartName) !== item.designator
        ))),
    };
}
