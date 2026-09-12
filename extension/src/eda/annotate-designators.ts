import { checkpointer } from './checkpointer';
import {
    type AnnotatableComponentUnit,
    componentBaseDesignator,
    type DesignatorAnnotationMode,
    type DesignatorAnnotationPlan,
    groupLogicalComponents,
    planDesignatorAnnotation,
} from './designator-annotation-plan';

export type { DesignatorAnnotationMode } from './designator-annotation-plan';

export type DesignatorAnnotationResult = {
    mode: DesignatorAnnotationMode;
    pages: number;
    components: number;
    units: number;
    renamed: number;
    changes: Array<{
        pages: string[];
        from: string | string[];
        to: string;
        sub_parts?: string[];
    }>;
};

const PAGE_SETTLE_MS = 400;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function openDocument(documentUuid: string) {
    const opened = await eda.dmt_EditorControl.openDocument(documentUuid);
    if (!opened) throw new Error(`Failed to open document: ${documentUuid}`);
    await delay(PAGE_SETTLE_MS);
}

async function ensureSchematicPage() {
    const current = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
    if (current?.documentType === EDMT_EditorDocumentType.SCHEMATIC_PAGE) return;

    const board = await eda.dmt_Board.getCurrentBoardInfo().catch(() => undefined);
    const pageUuid = board?.schematic?.page?.[0]?.uuid;
    if (!pageUuid) throw new Error('Open a schematic page or a PCB linked to a schematic before annotation.');
    await openDocument(pageUuid);
}

async function readCurrentPageUnits(page: IDMT_SchematicPageItem, pageIndex: number) {
    const components = (await eda.sch_PrimitiveComponent.getAll()).filter(component => (
        component.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT
    ));
    return components.map(component => {
        const linked = component.getState_Component?.();
        return {
            pageUuid: page.uuid,
            pageName: page.name,
            pageIndex,
            primitiveId: component.getState_PrimitiveId(),
            designator: component.getState_Designator?.() ?? '',
            subPartName: component.getState_SubPartName?.() ?? '',
            uniqueId: component.getState_UniqueId?.() ?? '',
            componentKey: linked ? `${linked.libraryUuid}:${linked.uuid}` : '',
            x: component.getState_X(),
            y: component.getState_Y(),
        } satisfies AnnotatableComponentUnit;
    });
}

async function readSchematicUnits(pages: IDMT_SchematicPageItem[]) {
    const result: AnnotatableComponentUnit[] = [];
    for (const [pageIndex, page] of pages.entries()) {
        await openDocument(page.uuid);
        result.push(...await readCurrentPageUnits(page, pageIndex));
    }
    return result;
}

function assignmentByUnit(plan: DesignatorAnnotationPlan) {
    return new Map(plan.assignments.flatMap(assignment => assignment.component.units.map(unit => [
        `${unit.pageUuid}:${unit.primitiveId}`,
        assignment.designator,
    ])));
}

async function applyPlan(
    pages: IDMT_SchematicPageItem[],
    plan: DesignatorAnnotationPlan,
    checkpoints: Map<string, string>,
) {
    const expectedByUnit = assignmentByUnit(plan);
    const changedPageUuids = new Set(plan.changed.flatMap(item => item.component.units.map(unit => unit.pageUuid)));

    for (const page of pages) {
        if (!changedPageUuids.has(page.uuid)) continue;
        await openDocument(page.uuid);
        const checkpointId = await checkpointer.save(false);
        if (!checkpointId) throw new Error(`Failed to create annotation checkpoint for page: ${page.name}`);
        checkpoints.set(page.uuid, checkpointId);

        const components = (await eda.sch_PrimitiveComponent.getAll()).filter(component => (
            component.getState_ComponentType() === ESCH_PrimitiveComponentType.COMPONENT
        ));
        for (const component of components) {
            const key = `${page.uuid}:${component.getState_PrimitiveId()}`;
            const expected = expectedByUnit.get(key);
            const actual = componentBaseDesignator(
                component.getState_Designator?.() ?? '',
                component.getState_SubPartName?.() ?? '',
            );
            if (expected === undefined || actual === expected) continue;
            component.setState_Designator(expected);
            await component.done();
        }
    }
}

async function verifyPlan(pages: IDMT_SchematicPageItem[], plan: DesignatorAnnotationPlan) {
    const actual = await readSchematicUnits(pages);
    const actualByUnit = new Map(actual.map(unit => [
        `${unit.pageUuid}:${unit.primitiveId}`,
        componentBaseDesignator(unit.designator, unit.subPartName),
    ]));
    const expectedByUnit = assignmentByUnit(plan);

    for (const [key, expected] of expectedByUnit) {
        const value = actualByUnit.get(key);
        if (value !== expected) {
            throw new Error(`Designator annotation did not persist for ${key}: expected ${expected}, got ${value ?? 'missing'}`);
        }
    }

    const logical = groupLogicalComponents(actual);
    const seen = new Set<string>();
    for (const component of logical) {
        if (seen.has(component.designator)) {
            throw new Error(`Duplicate designator remains after annotation: ${component.designator}`);
        }
        seen.add(component.designator);
    }
}

async function rollbackPages(pages: IDMT_SchematicPageItem[], checkpoints: Map<string, string>) {
    const failed: string[] = [];
    for (const page of [...pages].reverse()) {
        const checkpointId = checkpoints.get(page.uuid);
        if (!checkpointId) continue;
        try {
            await openDocument(page.uuid);
            if (!await checkpointer.restore(checkpointId, true)) failed.push(page.name);
        } catch {
            failed.push(page.name);
        }
    }
    return failed;
}

export async function annotateDesignators(mode: DesignatorAnnotationMode): Promise<DesignatorAnnotationResult> {
    const originalDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
    let pages: IDMT_SchematicPageItem[] = [];
    const checkpoints = new Map<string, string>();

    try {
        await ensureSchematicPage();
        pages = await eda.dmt_Schematic.getCurrentSchematicAllSchematicPagesInfo();
        if (!pages.length) throw new Error('The current schematic has no pages.');

        const units = await readSchematicUnits(pages);
        const plan = planDesignatorAnnotation(units, mode);
        try {
            await applyPlan(pages, plan, checkpoints);
            await verifyPlan(pages, plan);
        } catch (error) {
            const rollbackFailed = await rollbackPages(pages, checkpoints);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(rollbackFailed.length
                ? `${message}; annotation rollback failed for: ${rollbackFailed.join(', ')}`
                : `${message}; annotation transaction rolled back`);
        }

        return {
            mode,
            pages: pages.length,
            components: plan.assignments.length,
            units: units.length,
            renamed: plan.changed.length,
            changes: plan.changed.map(item => {
                const previous = [...new Set(item.component.units.map(unit => (
                    componentBaseDesignator(unit.designator, unit.subPartName)
                )))];
                return {
                    pages: [...new Set(item.component.units.map(unit => unit.pageName))],
                    from: previous.length === 1 ? previous[0] : previous,
                    to: item.designator,
                    ...(
                        item.component.units.some(unit => unit.subPartName)
                            ? { sub_parts: [...new Set(item.component.units.map(unit => unit.subPartName).filter(Boolean))] }
                            : {}
                    ),
                };
            }),
        };
    } finally {
        const current = await eda.dmt_SelectControl.getCurrentDocumentInfo().catch(() => undefined);
        if (originalDocument?.uuid && current?.uuid !== originalDocument.uuid) {
            await openDocument(originalDocument.uuid);
        }
    }
}
