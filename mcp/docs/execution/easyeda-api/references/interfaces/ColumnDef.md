# ColumnDef interface

列定义

## Signature

```typescript
interface ColumnDef<T = any>
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[align?](./ColumnDef.md)||[Align](../types/Align.md)|_(Optional)_ 对齐方式|
|[editable?](./ColumnDef.md)||boolean \| [ColumnEditTrigger](./ColumnEditTrigger.md)|_(Optional)_ 是否可编辑，默认 false（不传 = 不可编辑）|
|[ellipsis?](./ColumnDef.md)||boolean|_(Optional)_ 单元格文本溢出省略号：true 时单行截断（…）+ hover 显示完整文本 tooltip。 默认 false —— 单元格默认换行完整显示，省略号需显式开启。 ⚠️ 虚拟滚动约束：本组件虚拟滚动为「固定行高」方案（非动态测量）， 换行会撑高 `<tr>` 导致可见行定位错位。因此开启 `virtualScroll` 时， 所有可能超长换行的列必须显式 `ellipsis: true`<!-- -->（或使用 `$truncate` 插槽）保证单行。|
|[filterable?](./ColumnDef.md)||boolean|_(Optional)_ 是否可筛选|
|[filterMatchMode?](./ColumnDef.md)||[FilterMatchMode](../types/FilterMatchMode.md)|_(Optional)_ 筛选匹配模式，默认由 type 推断：text=contains，其余（number/select/checkbox/date/boolean）=exact|
|[fixed?](./ColumnDef.md)||'left' \| 'right'|_(Optional)_ 固定列位置|
|[hidden?](./ColumnDef.md)||boolean|_(Optional)_ 是否隐藏|
|[key](./ColumnDef.md)||keyof T &amp; string|列 key（对应数据字段名）|
|[mergeByField?](./ColumnDef.md)||keyof T &amp; string|_(Optional)_ 按字段分组自动合并：相同值的连续行合并为一个 cell|
|[minWidth?](./ColumnDef.md)||number|_(Optional)_ 最小列宽（px），默认 50|
|[resizable?](./ColumnDef.md)||boolean|_(Optional)_ 是否可拖拽调整列宽|
|[rules?](./ColumnDef.md)||[ValidationRule](./ValidationRule.md)<!-- -->\[\]|_(Optional)_ 声明式校验规则（纯数据，可序列化）|
|[selectList?](./ColumnDef.md)||[SelectOption](./SelectOption.md)<!-- -->\[\]|_(Optional)_ 内置下拉渲染：显示选项 text 而非原始值|
|[slot?](./ColumnDef.md)||string|_(Optional)_ 单元格内置插槽名（$ 前缀），从 Main 侧内置目录解析；非 $ 前缀或未命中则回退默认渲染|
|[slotProps?](./ColumnDef.md)||[Serializable](../types/Serializable.md)|_(Optional)_ 传给插槽组件的纯数据（Serializable，可跨广播）|
|[sortable?](./ColumnDef.md)||boolean|_(Optional)_ 是否可排序|
|[sortKey?](./ColumnDef.md)||string \| string\[\]|_(Optional)_ 排序字段（默认取 key，可指定字段名或字段路径数组）|
|[sortType?](./ColumnDef.md)||'string' \| 'number' \| 'date'|_(Optional)_ 排序类型（默认由 type 推断）|
|[title](./ColumnDef.md)||string|列标题|
|[type?](./ColumnDef.md)||[ColumnType](../types/ColumnType.md)|_(Optional)_ 列数据类型，默认 'text'。决定默认排序类型（sortType）和筛选匹配模式（filterMatchMode）|
|[width?](./ColumnDef.md)||number \| string|_(Optional)_ 列宽：number = 像素值，string = CSS 值（如 "50%"、"auto"、"200px"）|

---

## 属性详情

### align

# ColumnDef.align property

对齐方式

## Signature

```typescript
align?: Align;
```

### editable

# ColumnDef.editable property

是否可编辑，默认 false（不传 = 不可编辑）

## Signature

```typescript
editable?: boolean | ColumnEditTrigger;
```

### ellipsis

# ColumnDef.ellipsis property

单元格文本溢出省略号：true 时单行截断（…）+ hover 显示完整文本 tooltip。 默认 false —— 单元格默认换行完整显示，省略号需显式开启。

⚠️ 虚拟滚动约束：本组件虚拟滚动为「固定行高」方案（非动态测量）， 换行会撑高 `<tr>` 导致可见行定位错位。因此开启 `virtualScroll` 时， 所有可能超长换行的列必须显式 `ellipsis: true`<!-- -->（或使用 `$truncate` 插槽）保证单行。

## Signature

```typescript
ellipsis?: boolean;
```

### filterable

# ColumnDef.filterable property

是否可筛选

## Signature

```typescript
filterable?: boolean;
```

### filtermatchmode

# ColumnDef.filterMatchMode property

筛选匹配模式，默认由 type 推断：text=contains，其余（number/select/checkbox/date/boolean）=exact

## Signature

```typescript
filterMatchMode?: FilterMatchMode;
```

### fixed

# ColumnDef.fixed property

固定列位置

## Signature

```typescript
fixed?: 'left' | 'right';
```

### hidden

# ColumnDef.hidden property

是否隐藏

## Signature

```typescript
hidden?: boolean;
```

### key

# ColumnDef.key property

列 key（对应数据字段名）

## Signature

```typescript
key: keyof T & string;
```

### mergebyfield

# ColumnDef.mergeByField property

按字段分组自动合并：相同值的连续行合并为一个 cell

## Signature

```typescript
mergeByField?: keyof T & string;
```

### minwidth

# ColumnDef.minWidth property

最小列宽（px），默认 50

## Signature

```typescript
minWidth?: number;
```

### resizable

# ColumnDef.resizable property

是否可拖拽调整列宽

## Signature

```typescript
resizable?: boolean;
```

### rules

# ColumnDef.rules property

声明式校验规则（纯数据，可序列化）

## Signature

```typescript
rules?: ValidationRule[];
```

### selectlist

# ColumnDef.selectList property

内置下拉渲染：显示选项 text 而非原始值

## Signature

```typescript
selectList?: SelectOption[];
```

### slot

# ColumnDef.slot property

单元格内置插槽名（$ 前缀），从 Main 侧内置目录解析；非 $ 前缀或未命中则回退默认渲染

## Signature

```typescript
slot?: string;
```

### slotprops

# ColumnDef.slotProps property

传给插槽组件的纯数据（Serializable，可跨广播）

## Signature

```typescript
slotProps?: Serializable;
```

### sortable

# ColumnDef.sortable property

是否可排序

## Signature

```typescript
sortable?: boolean;
```

### sortkey

# ColumnDef.sortKey property

排序字段（默认取 key，可指定字段名或字段路径数组）

## Signature

```typescript
sortKey?: string | string[];
```

### sorttype

# ColumnDef.sortType property

排序类型（默认由 type 推断）

## Signature

```typescript
sortType?: 'string' | 'number' | 'date';
```

### title

# ColumnDef.title property

列标题

## Signature

```typescript
title: string;
```

### type

# ColumnDef.type property

列数据类型，默认 'text'。决定默认排序类型（sortType）和筛选匹配模式（filterMatchMode）

## Signature

```typescript
type?: ColumnType;
```

### width

# ColumnDef.width property

列宽：number = 像素值，string = CSS 值（如 "50%"、"auto"、"200px"）

## Signature

```typescript
width?: number | string;
```
