# ScrollerProps interface

滚动组件：虚拟滚动列表，仅渲染可见行

## Signature

```typescript
interface ScrollerProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[buffer?](./ScrollerProps.md)||number|_(Optional)_ Number of extra buffered rows to render|
|[children?](./ScrollerProps.md)||any|_(Optional)_ Child node|
|[itemCount](./ScrollerProps.md)||number|Total row count (required)|
|[itemHeight](./ScrollerProps.md)||number|Height of each row (pixels, required)|
|[onVisibleRowsChange?](./ScrollerProps.md)||(visibleRows: { index: number; slotName: string }\[\]) =&gt; void|_(Optional)_ 可见行变化时触发，参数为可见行索引与对应插槽名列表|

---

## 属性详情

### buffer

# ScrollerProps.buffer property

Number of extra buffered rows to render

## Signature

```typescript
buffer?: number;
```

### children

# ScrollerProps.children property

Child node

## Signature

```typescript
children?: any;
```

### itemcount

# ScrollerProps.itemCount property

Total row count (required)

## Signature

```typescript
itemCount: number;
```

### itemheight

# ScrollerProps.itemHeight property

Height of each row (pixels, required)

## Signature

```typescript
itemHeight: number;
```

### onvisiblerowschange

# ScrollerProps.onVisibleRowsChange property

可见行变化时触发，参数为可见行索引与对应插槽名列表

## Signature

```typescript
onVisibleRowsChange?: (visibleRows: { index: number; slotName: string }[]) => void;
```
