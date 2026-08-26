import {
    PcbComponentGeometry,
    PcbGeometryReport,
    PcbGeometryRequest,
    PcbPadGeometry,
} from "@copilot/shared/types/pcb/geometry";
import { assertPcbDocument } from "./pcb";
import { milToMm, round, safeString } from "./utils";

function layerName(layerId: number): string {
    if (layerId === EPCB_LayerId.TOP) return 'top';
    if (layerId === EPCB_LayerId.BOTTOM) return 'bottom';
    if (layerId === EPCB_LayerId.MULTI) return 'multi';
    return String(layerId);
}

const mm = (value: number) => round(milToMm(value));

export async function getPcbComponentGeometry(request?: PcbGeometryRequest): Promise<PcbGeometryReport> {
    await assertPcbDocument('getPcbComponentGeometry');

    const requested = request?.designators?.filter(Boolean) ?? [];
    const wanted = requested.length ? new Set(requested) : undefined;
    const includePads = request?.include_pads ?? true;

    const components = await eda.pcb_PrimitiveComponent.getAll().catch(() => [] as IPCB_PrimitiveComponent[]);
    const found: PcbComponentGeometry[] = [];
    const seen = new Set<string>();

    for (const component of components) {
        const designator = component.getState_Designator() || '';
        if (wanted && !wanted.has(designator)) continue;

        seen.add(designator);
        const primitiveId = component.getState_PrimitiveId();

        const entry: PcbComponentGeometry = {
            designator,
            x: mm(component.getState_X()),
            y: mm(component.getState_Y()),
            rotation: component.getState_Rotation(),
            layer: layerName(component.getState_Layer()),
        };

        const box = await eda.pcb_Primitive.getPrimitivesBBox([primitiveId]).catch(() => undefined);
        if (box) {
            const left = mm(box.minX);
            const right = mm(box.maxX);
            const bottom = mm(box.minY);
            const top = mm(box.maxY);

            entry.bbox = {
                left,
                right,
                top,
                bottom,
                width: round(right - left),
                height: round(top - bottom),
            };
        }

        if (includePads) {
            const pins = await eda.pcb_PrimitiveComponent
                .getAllPinsByPrimitiveId(primitiveId)
                .catch(() => undefined);

            const pads: PcbPadGeometry[] = (pins ?? []).map(pin => ({
                pad: pin.getState_PadNumber(),
                net: safeString(pin.getState_Net()),
                x: mm(pin.getState_X()),
                y: mm(pin.getState_Y()),
                layer: layerName(pin.getState_Layer()),
                rotation: pin.getState_Rotation(),
            }));

            entry.pads = pads;
        }

        found.push(entry);
    }

    return {
        components: found,
        not_found: requested.filter(designator => !seen.has(designator)),
    };
}
