# ListProps interface

列表组件：支持多级嵌套、图标、展开的列表

## Signature

```typescript
interface ListProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[border?](./ListProps.md)||boolean|_(Optional)_ Whether to show the border|
|[expandEnable?](./ListProps.md)||boolean|_(Optional)_ Whether nested child items are allowed to expand|
|[itemHeight?](./ListProps.md)||number|_(Optional)_ List item height (pixels)|
|[list](./ListProps.md)||[ListChildren](./ListChildren.md)<!-- -->\[\]|List data ( required)|
|[maxHeight?](./ListProps.md)||number|_(Optional)_ 列表最大高度（像素）。提供时列表视口高度取 min(内容高度, 该值)，用于如下拉菜单等父容器无定值高度的场景，使虚拟列表可正常滚动|
|[onItemClick?](./ListProps.md)||(id: string, item: [ListChildren](./ListChildren.md)<!-- -->) =&gt; void|_(Optional)_ 点击列表项时触发，参数为 id 与列表项|
|[onItemContextmenu?](./ListProps.md)||(id: string) =&gt; void|_(Optional)_ 右键点击列表项时触发，参数为 id|
|[onItemDblclick?](./ListProps.md)||(id: string) =&gt; void|_(Optional)_ 双击列表项时触发，参数为 id|

---

## 属性详情

### border

# ListProps.border property

Whether to show the border

## Signature

```typescript
border?: boolean;
```

### expandenable

# ListProps.expandEnable property

Whether nested child items are allowed to expand

## Signature

```typescript
expandEnable?: boolean;
```

### itemheight

# ListProps.itemHeight property

List item height (pixels)

## Signature

```typescript
itemHeight?: number;
```

### list

# ListProps.list property

List data ( required)

## Signature

```typescript
list: ListChildren[];
```

### maxheight

# ListProps.maxHeight property

列表最大高度（像素）。提供时列表视口高度取 min(内容高度, 该值)，用于如下拉菜单等父容器无定值高度的场景，使虚拟列表可正常滚动

## Signature

```typescript
maxHeight?: number;
```

### onitemclick

# ListProps.onItemClick property

点击列表项时触发，参数为 id 与列表项

## Signature

```typescript
onItemClick?: (id: string, item: ListChildren) => void;
```

### onitemcontextmenu

# ListProps.onItemContextmenu property

右键点击列表项时触发，参数为 id

## Signature

```typescript
onItemContextmenu?: (id: string) => void;
```

### onitemdblclick

# ListProps.onItemDblclick property

双击列表项时触发，参数为 id

## Signature

```typescript
onItemDblclick?: (id: string) => void;
```
