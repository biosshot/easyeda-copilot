# DragSortConfig interface

拖拽排序配置

## Signature

```typescript
interface DragSortConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[handle?](./DragSortConfig.md)||'drag-column' \| 'row'|_(Optional)_ 拖拽手柄形式：独立拖拽列 / 整行拖拽，默认 'drag-column'|
|[onDragEnd?](./DragSortConfig.md)||(info: { fromIndices: number \| number\[\]; toIndex: number; currentIndices: number \| number\[\] }) =&gt; void|_(Optional)_ 拖拽排序结束通知|
|[showDragIcon?](./DragSortConfig.md)||boolean|_(Optional)_ 是否显示拖拽图标，默认 true|

---

## 属性详情

### handle

# DragSortConfig.handle property

拖拽手柄形式：独立拖拽列 / 整行拖拽，默认 'drag-column'

## Signature

```typescript
handle?: 'drag-column' | 'row';
```

### ondragend

# DragSortConfig.onDragEnd property

拖拽排序结束通知

## Signature

```typescript
onDragEnd?: (info: { fromIndices: number | number[]; toIndex: number; currentIndices: number | number[] }) => void;
```

### showdragicon

# DragSortConfig.showDragIcon property

是否显示拖拽图标，默认 true

## Signature

```typescript
showDragIcon?: boolean;
```
