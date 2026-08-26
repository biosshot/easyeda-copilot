/**
 * Геометрия компонентов платы: габариты и координаты отдельных выводов.
 *
 * get_current_pcb отдаёт у компонента только состав контактов (номер и цепь),
 * без позиций, поэтому поставить подпись точно к нужному выводу было нельзя.
 * Данные в API есть — getAllPinsByPrimitiveId и getPrimitivesBBox, — здесь они
 * доводятся до наружного интерфейса.
 *
 * Все координаты и размеры — в мм.
 */

export interface PcbPadGeometry {
    pad: string;
    net?: string;
    x: number;
    y: number;
    layer: string;
    rotation: number;
}

export interface PcbBox {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

export interface PcbComponentGeometry {
    designator: string;
    x: number;
    y: number;
    rotation: number;
    layer: string;
    /** Габарит компонента со всеми его примитивами. */
    bbox?: PcbBox;
    pads?: PcbPadGeometry[];
}

export interface PcbGeometryRequest {
    /** Ограничить выборку. Пусто — все компоненты платы. */
    designators?: string[];
    include_pads?: boolean;
}

export interface PcbGeometryReport {
    components: PcbComponentGeometry[];
    /** Запрошенные обозначения, которых на плате не нашлось. */
    not_found: string[];
}
