/**
 * Произвольная шелкография на плате.
 *
 * Штатный ассемблер платы умеет только позиционные обозначения
 * (designatorText в board-assemble), а подписи к разъёмам, имя платы,
 * ревизию и прочий текст нанести было нечем.
 *
 * Все размеры и координаты — в мм, как в остальной модели платы;
 * перевод в милы, которые ждёт API EasyEDA, делается на стороне плагина.
 */

export type SilkscreenLayer = 'top' | 'bottom';

export type SilkscreenAlign =
    | 'left_top' | 'left_middle' | 'left_bottom'
    | 'center_top' | 'center' | 'center_bottom'
    | 'right_top' | 'right_middle' | 'right_bottom';

export interface SilkscreenTextItem {
    text: string;
    x: number;
    y: number;
    layer?: SilkscreenLayer;
    /** Высота символа, мм. */
    height?: number;
    /** Толщина штриха, мм. */
    line_width?: number;
    /** Поворот, градусы. */
    rotation?: number;
    /** Какая точка текста попадает в (x, y). */
    align?: SilkscreenAlign;
    /**
     * Зеркалить глифы. По умолчанию выключено: нижний слой EasyEDA отражает
     * сама, и второе отражение вернуло бы текст задом наперёд.
     */
    mirror?: boolean;
}

export interface SilkscreenTextRequest {
    items: SilkscreenTextItem[];
    /**
     * Обновлять существующий текст с тем же содержимым на том же слое
     * вместо добавления дубликата. Делает повторный вызов безопасным.
     */
    replace_existing?: boolean;
    /** Имя шрифта; должен быть уже импортирован в EasyEDA. */
    font_family?: string;
}

export interface SilkscreenTextFailure {
    text: string;
    reason: string;
}

export interface SilkscreenTextReport {
    added: number;
    updated: number;
    failed: SilkscreenTextFailure[];
    /**
     * Текст, чья точка привязки вышла за габарит платы. Не ошибка —
     * такой текст создаётся, но на производство он не попадёт.
     */
    outside_board: string[];
    /** Шрифт, которым фактически нанесён текст. */
    font_family: string;
}

export interface SilkscreenTextEntry {
    primitive_id: string;
    text: string;
    x: number;
    y: number;
    layer: SilkscreenLayer;
    height: number;
    line_width: number;
    rotation: number;
    mirror: boolean;
}

export interface SilkscreenImagePoint {
    x: number;
    y: number;
}

export interface SilkscreenImageRequest {
    /**
     * Кольца контура в мм, центрированные в начале координат.
     * Первое — внешний контур, остальные трактуются как отверстия.
     */
    rings: SilkscreenImagePoint[][];
    x: number;
    y: number;
    layer?: SilkscreenLayer;
    rotation?: number;
    /** По умолчанию выключено, как и у текста. */
    mirror?: boolean;
    width?: number;
    height?: number;
}

export interface SilkscreenImageEntry {
    primitive_id: string;
    x: number;
    y: number;
    layer: SilkscreenLayer;
    width: number;
    height: number;
    rotation: number;
    mirror: boolean;
    /**
     * Фактические границы отрисованной фигуры, мм. Единственный источник
     * правды о положении: поля x/y хранят якорь, который на отрисовку не влияет.
     */
    bbox?: { left: number; right: number; top: number; bottom: number };
}

export interface SilkscreenImageReport {
    placed: SilkscreenImageEntry;
    /** Центр фигуры вышел за контур платы. */
    outside_board: boolean;
    rings: number;
    points: number;
    /**
     * Насколько пришлось сдвинуть контур, чтобы фактический центр совпал с
     * запрошенным. Ненулевое значение — норма: так компенсируется то, что
     * система координат полигона не совпадает с координатами компонентов.
     */
    correction: { x: number; y: number };
}

export interface SilkscreenDeleteRequest {
    /** Удалить по идентификаторам примитивов. */
    primitive_ids?: string[];
    /** Удалить весь текст с точно таким содержимым. */
    texts?: string[];
    /** Ограничить удаление одним слоем. */
    layer?: SilkscreenLayer;
}

export interface SilkscreenDeleteReport {
    deleted: number;
    not_found: string[];
}
