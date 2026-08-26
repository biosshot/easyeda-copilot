import {
    KeepoutLayer,
    KeepoutRegionEntry,
    KeepoutRegionReport,
    KeepoutRegionRequest,
    KeepoutRule,
} from "@copilot/shared/types/pcb/keepout";
import { assertPcbDocument } from "./pcb";
import { milToMm, mmToMil, round } from "./utils";

const RULE_IDS: Record<KeepoutRule, EPCB_PrimitiveRegionRuleType> = {
    no_components: EPCB_PrimitiveRegionRuleType.NO_COMPONENTS,
    no_vias: EPCB_PrimitiveRegionRuleType.NO_VIAS,
    no_wires: EPCB_PrimitiveRegionRuleType.NO_WIRES,
    no_fills: EPCB_PrimitiveRegionRuleType.NO_FILLS,
    no_pours: EPCB_PrimitiveRegionRuleType.NO_POURS,
    no_inner_layers: EPCB_PrimitiveRegionRuleType.NO_INNER_ELECTRICAL_LAYERS,
};

function layerId(layer: KeepoutLayer): TPCB_LayersOfRegion {
    if (layer === 'bottom') return EPCB_LayerId.BOTTOM;
    if (layer === 'multi') return EPCB_LayerId.MULTI;
    return EPCB_LayerId.TOP;
}

export async function addPcbKeepoutRegion(request: KeepoutRegionRequest): Promise<KeepoutRegionReport> {
    await assertPcbDocument('addPcbKeepoutRegion');

    const width = request?.width;
    const height = request?.height;
    if (!(width > 0) || !(height > 0)) throw new Error('width and height must be positive');

    const layers = request.layers?.length ? request.layers : (['top', 'bottom'] as KeepoutLayer[]);
    const rules = request.rules?.length ? request.rules : (['no_pours', 'no_vias'] as KeepoutRule[]);

    const ruleIds = rules.map(rule => {
        const id = RULE_IDS[rule];
        if (id === undefined) throw new Error(`Unknown keepout rule: ${rule}`);
        return id;
    });

    const left = mmToMil(request.x - width / 2);
    const right = mmToMil(request.x + width / 2);
    const bottom = mmToMil(request.y - height / 2);
    const top = mmToMil(request.y + height / 2);

    const source = [left, bottom, 'L', right, bottom, right, top, left, top] as TPCB_PolygonSourceArray;

    const created: KeepoutRegionEntry[] = [];
    const failed: KeepoutRegionReport['failed'] = [];

    for (const layer of layers) {
        try {
            const polygon = eda.pcb_MathPolygon.createPolygon(source);
            if (!polygon) throw new Error('invalid region geometry');

            const region = await eda.pcb_PrimitiveRegion.create(
                layerId(layer),
                polygon,
                ruleIds,
                request.name,
            );

            if (!region) throw new Error('EasyEDA returned no region primitive');

            // Габарит читаем у редактора: он единственный говорит, где фигура
            // оказалась на самом деле.
            const box = await eda.pcb_Primitive
                .getPrimitivesBBox([region.getState_PrimitiveId()])
                .catch(() => undefined);

            created.push({
                primitive_id: region.getState_PrimitiveId(),
                layer,
                name: request.name,
                rules,
                bbox: box ? {
                    left: round(milToMm(box.minX)),
                    right: round(milToMm(box.maxX)),
                    bottom: round(milToMm(box.minY)),
                    top: round(milToMm(box.maxY)),
                } : undefined,
            });
        } catch (error) {
            failed.push({ layer, reason: (error as Error).message });
        }
    }

    const summary = `Keepout region: ${created.length} created` + (failed.length ? `, ${failed.length} failed` : '');
    eda.sys_Log.add(summary, ESYS_LogType.INFO);
    eda.sys_Message.showToastMessage(
        summary,
        failed.length ? ESYS_ToastMessageType.WARNING : ESYS_ToastMessageType.SUCCESS,
    );

    return { created, failed };
}

export async function deletePcbKeepoutRegions(primitiveIds: string[]): Promise<{ deleted: number }> {
    await assertPcbDocument('deletePcbKeepoutRegions');

    if (!primitiveIds?.length) throw new Error('Pass primitive_ids to delete');

    const deleted = await eda.pcb_PrimitiveRegion.delete(primitiveIds);
    if (!deleted) throw new Error('EasyEDA rejected the region delete');

    return { deleted: primitiveIds.length };
}
