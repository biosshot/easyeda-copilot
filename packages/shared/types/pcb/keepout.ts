/**
 * Зоны запрета на плате.
 *
 * constraintRegion в DSL расстановки запрещает только размещение деталей —
 * в его документации это сказано прямо. Медь он не трогает, поэтому заливка
 * земли спокойно заходит под антенну модуля и душит её. Здесь настоящий
 * запрет: на заливку, переходные, трассы.
 *
 * Координаты и размеры — в мм, прямоугольник задаётся центром.
 */

export type KeepoutRule =
    | 'no_pours'
    | 'no_vias'
    | 'no_wires'
    | 'no_fills'
    | 'no_components'
    | 'no_inner_layers';

export type KeepoutLayer = 'top' | 'bottom' | 'multi';

export interface KeepoutRegionRequest {
    x: number;
    y: number;
    width: number;
    height: number;
    /** По умолчанию оба медных слоя. */
    layers?: KeepoutLayer[];
    /** По умолчанию запрет заливки и переходных. */
    rules?: KeepoutRule[];
    name?: string;
}

export interface KeepoutRegionEntry {
    primitive_id: string;
    layer: KeepoutLayer;
    name?: string;
    rules: KeepoutRule[];
    bbox?: { left: number; right: number; top: number; bottom: number };
}

export interface KeepoutRegionReport {
    created: KeepoutRegionEntry[];
    failed: Array<{ layer: KeepoutLayer; reason: string }>;
}
