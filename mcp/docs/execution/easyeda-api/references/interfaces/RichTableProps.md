# RichTableProps interface

RichTable 组件属性

## Signature

```typescript
interface RichTableProps<T extends Record<string, any> = Record<string, any>>
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[border?](./RichTableProps.md)||boolean \| [BorderConfig](./BorderConfig.md)|_(Optional)_ 边框：true = 全边框，object = 精细控制|
|[className?](./RichTableProps.md)||string|_(Optional)_ 容器类名|
|[clipboard?](./RichTableProps.md)||[ClipboardConfig](./ClipboardConfig.md) \| true|_(Optional)_ 剪贴板（粘贴/剪切）|
|[columnResize?](./RichTableProps.md)||[ColumnResizeConfig](./ColumnResizeConfig.md) \| true|_(Optional)_ 列宽拖拽|
|[columns](./RichTableProps.md)||[ColumnDefOrGroup](../types/ColumnDefOrGroup.md)<!-- -->&lt;T&gt;\[\]|列定义|
|[customHeader?](./RichTableProps.md)||[CustomHeaderConfig](./CustomHeaderConfig.md)|_(Optional)_ 自定义表头（列可见性）|
|[data](./RichTableProps.md)||T\[\]|行数据|
|[dragSort?](./RichTableProps.md)||[DragSortConfig](./DragSortConfig.md) \| true|_(Optional)_ 拖拽排序|
|[editing?](./RichTableProps.md)||[EditingConfig](./EditingConfig.md)|_(Optional)_ 单元格编辑|
|[emptyText?](./RichTableProps.md)||string|_(Optional)_ 空数据提示文本，默认 "暂无数据"|
|[filtering?](./RichTableProps.md)||[FilteringConfig](./FilteringConfig.md) \| true|_(Optional)_ 筛选|
|[fixedColumns?](./RichTableProps.md)||[FixedColumnConfig](./FixedColumnConfig.md)|_(Optional)_ 固定列|
|[fixedHeader?](./RichTableProps.md)||boolean|_(Optional)_ 是否固定表头，默认 true|
|[headHeight?](./RichTableProps.md)||number|_(Optional)_ 表头高度，默认 32|
|[height?](./RichTableProps.md)||number \| string|_(Optional)_ 容器高度|
|[keyboard?](./RichTableProps.md)||[KeyboardConfig](./KeyboardConfig.md) \| true|_(Optional)_ 键盘导航|
|[loading?](./RichTableProps.md)||boolean|_(Optional)_ 加载中状态|
|[onAllChecked?](./RichTableProps.md)||(info: { data: T\[\]; checked: boolean }) =&gt; void|_(Optional)_ 全选/取消全选通知|
|[onCellClick?](./RichTableProps.md)||(info: [CellClickInfo](./CellClickInfo.md)<!-- -->&lt;T&gt;) =&gt; void|_(Optional)_ 单元格点击|
|[onCheckChange?](./RichTableProps.md)||(info: { checkedRows: T\[\]; checkedKeys: string\[\]; detail: [CheckChangeDetail](./CheckChangeDetail.md) }) =&gt; void|_(Optional)_ 勾选变更通知|
|[onColSizeChange?](./RichTableProps.md)||(info: { colKey: string; width: number }) =&gt; void|_(Optional)_ 列宽变更通知|
|[onDataChange?](./RichTableProps.md)||(info: { data: T\[\]; changedRow?: T; type?: [DataChangeType](../types/DataChangeType.md) }) =&gt; void|_(Optional)_ 数据变更通知|
|[onDragMoveEnd?](./RichTableProps.md)||(info: { fromIndices: number \| number\[\]; toIndex: number; currentIndices: number \| number\[\] }) =&gt; void|_(Optional)_ 拖拽排序结束通知|
|[onEditCommit?](./RichTableProps.md)||(info: { row: T; colKey: string; value: any; oldValue: any }) =&gt; void|_(Optional)_ 编辑提交通知|
|[onEditStateChange?](./RichTableProps.md)||(cell: [CellCoord](./CellCoord.md) \| null) =&gt; void|_(Optional)_ 编辑状态变更通知|
|[onError?](./RichTableProps.md)||(info: { message: string }) =&gt; void|_(Optional)_ 错误回调|
|[onFilterChange?](./RichTableProps.md)||(filters: Record&lt;string, string&gt;) =&gt; void|_(Optional)_ 筛选变更通知|
|[onHeaderContextMenu?](./RichTableProps.md)||(colKey: string) =&gt; void|_(Optional)_ 表头右键菜单|
|[onRowClick?](./RichTableProps.md)||(info: { row: T; index: number }) =&gt; void|_(Optional)_ 行单击|
|[onRowContextMenu?](./RichTableProps.md)||(info: { row: T; index: number }) =&gt; void|_(Optional)_ 行右键菜单|
|[onRowDoubleClick?](./RichTableProps.md)||(info: { row: T; index: number }) =&gt; void|_(Optional)_ 行双击|
|[onRowMouseEnter?](./RichTableProps.md)||(info: { row: T; index: number }) =&gt; void|_(Optional)_ 行鼠标进入|
|[onRowMouseLeave?](./RichTableProps.md)||(info: { row: T; index: number }) =&gt; void|_(Optional)_ 行鼠标离开|
|[onSelectionChange?](./RichTableProps.md)||(info: { selectedKeys: string\[\]; selectedRows: T\[\] }) =&gt; void|_(Optional)_ 选择变更通知|
|[onSortChange?](./RichTableProps.md)||(sort: [SortState](./SortState.md)<!-- -->\[\]) =&gt; void|_(Optional)_ 排序变更通知|
|[rowHeight?](./RichTableProps.md)||number|_(Optional)_ 行高，默认 28|
|[rowHighlightOnHover?](./RichTableProps.md)||boolean|_(Optional)_ 行悬浮高亮，默认 false|
|[rowKey?](./RichTableProps.md)||keyof T \| ((row: T, index: number) =&gt; string)|_(Optional)_ 行唯一标识字段或提取函数，默认 'id'|
|[searchHighlight?](./RichTableProps.md)||string|_(Optional)_ 搜索高亮词（对单元格文本大小写不敏感全匹配高亮）|
|[selection?](./RichTableProps.md)||[SelectionConfig](./SelectionConfig.md) \| true|_(Optional)_ 行选择|
|[showHeader?](./RichTableProps.md)||boolean|_(Optional)_ 是否显示表头，默认 true|
|[showRowNumber?](./RichTableProps.md)||boolean|_(Optional)_ 是否显示行号列|
|[sorting?](./RichTableProps.md)||[SortingConfig](./SortingConfig.md) \| true|_(Optional)_ 排序|
|[striped?](./RichTableProps.md)||boolean|_(Optional)_ 斑马纹|
|[style?](./RichTableProps.md)||Record&lt;string, string \| number&gt;|_(Optional)_ 容器样式|
|[tableBodyStyle?](./RichTableProps.md)||Record&lt;string, string&gt;|_(Optional)_ 表体样式|
|[textAlign?](./RichTableProps.md)||[Align](../types/Align.md)|_(Optional)_ 全局文本对齐（列的 align 优先级更高）|
|[virtualScroll?](./RichTableProps.md)||[VirtualScrollConfig](./VirtualScrollConfig.md) \| true|_(Optional)_ 虚拟滚动（仅固定行高，非动态测量）。 ⚠️ 约束：开启后每行高度恒等于 rowHeight，单元格换行会撑高行导致定位错位。 因此所有可能超长换行的列必须配 `ellipsis: true`<!-- -->（或 `$truncate` 插槽）保持单行。|
|[width?](./RichTableProps.md)||number \| string|_(Optional)_ 容器宽度|

---

## 属性详情

### border

# RichTableProps.border property

边框：true = 全边框，object = 精细控制

## Signature

```typescript
border?: boolean | BorderConfig;
```

### classname

# RichTableProps.className property

容器类名

## Signature

```typescript
className?: string;
```

### clipboard

# RichTableProps.clipboard property

剪贴板（粘贴/剪切）

## Signature

```typescript
clipboard?: ClipboardConfig | true;
```

### columnresize

# RichTableProps.columnResize property

列宽拖拽

## Signature

```typescript
columnResize?: ColumnResizeConfig | true;
```

### columns

# RichTableProps.columns property

列定义

## Signature

```typescript
columns: ColumnDefOrGroup < T > [];
```

### customheader

# RichTableProps.customHeader property

自定义表头（列可见性）

## Signature

```typescript
customHeader?: CustomHeaderConfig;
```

### data

# RichTableProps.data property

行数据

## Signature

```typescript
data: T[];
```

### dragsort

# RichTableProps.dragSort property

拖拽排序

## Signature

```typescript
dragSort?: DragSortConfig | true;
```

### editing

# RichTableProps.editing property

单元格编辑

## Signature

```typescript
editing?: EditingConfig;
```

### emptytext

# RichTableProps.emptyText property

空数据提示文本，默认 "暂无数据"

## Signature

```typescript
emptyText?: string;
```

### filtering

# RichTableProps.filtering property

筛选

## Signature

```typescript
filtering?: FilteringConfig | true;
```

### fixedcolumns

# RichTableProps.fixedColumns property

固定列

## Signature

```typescript
fixedColumns?: FixedColumnConfig;
```

### fixedheader

# RichTableProps.fixedHeader property

是否固定表头，默认 true

## Signature

```typescript
fixedHeader?: boolean;
```

### headheight

# RichTableProps.headHeight property

表头高度，默认 32

## Signature

```typescript
headHeight?: number;
```

### height

# RichTableProps.height property

容器高度

## Signature

```typescript
height?: number | string;
```

### keyboard

# RichTableProps.keyboard property

键盘导航

## Signature

```typescript
keyboard?: KeyboardConfig | true;
```

### loading

# RichTableProps.loading property

加载中状态

## Signature

```typescript
loading?: boolean;
```

### onallchecked

# RichTableProps.onAllChecked property

全选/取消全选通知

## Signature

```typescript
onAllChecked?: (info: { data: T[]; checked: boolean }) => void;
```

### oncellclick

# RichTableProps.onCellClick property

单元格点击

## Signature

```typescript
onCellClick?: (info: CellClickInfo<T>) => void;
```

### oncheckchange

# RichTableProps.onCheckChange property

勾选变更通知

## Signature

```typescript
onCheckChange?: (info: { checkedRows: T[]; checkedKeys: string[]; detail: CheckChangeDetail }) => void;
```

### oncolsizechange

# RichTableProps.onColSizeChange property

列宽变更通知

## Signature

```typescript
onColSizeChange?: (info: { colKey: string; width: number }) => void;
```

### ondatachange

# RichTableProps.onDataChange property

数据变更通知

## Signature

```typescript
onDataChange?: (info: { data: T[]; changedRow?: T; type?: DataChangeType }) => void;
```

### ondragmoveend

# RichTableProps.onDragMoveEnd property

拖拽排序结束通知

## Signature

```typescript
onDragMoveEnd?: (info: { fromIndices: number | number[]; toIndex: number; currentIndices: number | number[] }) => void;
```

### oneditcommit

# RichTableProps.onEditCommit property

编辑提交通知

## Signature

```typescript
onEditCommit?: (info: { row: T; colKey: string; value: any; oldValue: any }) => void;
```

### oneditstatechange

# RichTableProps.onEditStateChange property

编辑状态变更通知

## Signature

```typescript
onEditStateChange?: (cell: CellCoord | null) => void;
```

### onerror

# RichTableProps.onError property

错误回调

## Signature

```typescript
onError?: (info: { message: string }) => void;
```

### onfilterchange

# RichTableProps.onFilterChange property

筛选变更通知

## Signature

```typescript
onFilterChange?: (filters: Record<string, string>) => void;
```

### onheadercontextmenu

# RichTableProps.onHeaderContextMenu property

表头右键菜单

## Signature

```typescript
onHeaderContextMenu?: (colKey: string) => void;
```

### onrowclick

# RichTableProps.onRowClick property

行单击

## Signature

```typescript
onRowClick?: (info: { row: T; index: number }) => void;
```

### onrowcontextmenu

# RichTableProps.onRowContextMenu property

行右键菜单

## Signature

```typescript
onRowContextMenu?: (info: { row: T; index: number }) => void;
```

### onrowdoubleclick

# RichTableProps.onRowDoubleClick property

行双击

## Signature

```typescript
onRowDoubleClick?: (info: { row: T; index: number }) => void;
```

### onrowmouseenter

# RichTableProps.onRowMouseEnter property

行鼠标进入

## Signature

```typescript
onRowMouseEnter?: (info: { row: T; index: number }) => void;
```

### onrowmouseleave

# RichTableProps.onRowMouseLeave property

行鼠标离开

## Signature

```typescript
onRowMouseLeave?: (info: { row: T; index: number }) => void;
```

### onselectionchange

# RichTableProps.onSelectionChange property

选择变更通知

## Signature

```typescript
onSelectionChange?: (info: { selectedKeys: string[]; selectedRows: T[] }) => void;
```

### onsortchange

# RichTableProps.onSortChange property

排序变更通知

## Signature

```typescript
onSortChange?: (sort: SortState[]) => void;
```

### rowheight

# RichTableProps.rowHeight property

行高，默认 28

## Signature

```typescript
rowHeight?: number;
```

### rowhighlightonhover

# RichTableProps.rowHighlightOnHover property

行悬浮高亮，默认 false

## Signature

```typescript
rowHighlightOnHover?: boolean;
```

### rowkey

# RichTableProps.rowKey property

行唯一标识字段或提取函数，默认 'id'

## Signature

```typescript
rowKey?: keyof T | ((row: T, index: number) => string);
```

### searchhighlight

# RichTableProps.searchHighlight property

搜索高亮词（对单元格文本大小写不敏感全匹配高亮）

## Signature

```typescript
searchHighlight?: string;
```

### selection

# RichTableProps.selection property

行选择

## Signature

```typescript
selection?: SelectionConfig | true;
```

### showheader

# RichTableProps.showHeader property

是否显示表头，默认 true

## Signature

```typescript
showHeader?: boolean;
```

### showrownumber

# RichTableProps.showRowNumber property

是否显示行号列

## Signature

```typescript
showRowNumber?: boolean;
```

### sorting

# RichTableProps.sorting property

排序

## Signature

```typescript
sorting?: SortingConfig | true;
```

### striped

# RichTableProps.striped property

斑马纹

## Signature

```typescript
striped?: boolean;
```

### style

# RichTableProps.style property

容器样式

## Signature

```typescript
style?: Record<string, string | number>;
```

### tablebodystyle

# RichTableProps.tableBodyStyle property

表体样式

## Signature

```typescript
tableBodyStyle?: Record<string, string>;
```

### textalign

# RichTableProps.textAlign property

全局文本对齐（列的 align 优先级更高）

## Signature

```typescript
textAlign?: Align;
```

### virtualscroll

# RichTableProps.virtualScroll property

虚拟滚动（仅固定行高，非动态测量）。 ⚠️ 约束：开启后每行高度恒等于 rowHeight，单元格换行会撑高行导致定位错位。 因此所有可能超长换行的列必须配 `ellipsis: true`<!-- -->（或 `$truncate` 插槽）保持单行。

## Signature

```typescript
virtualScroll?: VirtualScrollConfig | true;
```

### width

# RichTableProps.width property

容器宽度

## Signature

```typescript
width?: number | string;
```
