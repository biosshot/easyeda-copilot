# ColumnGroupDef interface

列分组：多级表头

## Signature

```typescript
interface ColumnGroupDef<T = any>
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[align?](./ColumnGroupDef.md)||[Align](../types/Align.md)|_(Optional)_ 分组对齐（子列未指定时继承）|
|[children](./ColumnGroupDef.md)||[ColumnDef](./ColumnDef.md)<!-- -->&lt;T&gt;\[\]|子列|
|[fixed?](./ColumnGroupDef.md)||'left' \| 'right'|_(Optional)_ 分组固定列位置（子列未指定时继承）|
|[key](./ColumnGroupDef.md)||string|分组标识（表头渲染用）|
|[title](./ColumnGroupDef.md)||string|分组标题|
|[type](./ColumnGroupDef.md)||'group'||

---

## 属性详情

### align

# ColumnGroupDef.align property

分组对齐（子列未指定时继承）

## Signature

```typescript
align?: Align;
```

### children

# ColumnGroupDef.children property

子列

## Signature

```typescript
children: ColumnDef < T > [];
```

### fixed

# ColumnGroupDef.fixed property

分组固定列位置（子列未指定时继承）

## Signature

```typescript
fixed?: 'left' | 'right';
```

### key

# ColumnGroupDef.key property

分组标识（表头渲染用）

## Signature

```typescript
key: string;
```

### title

# ColumnGroupDef.title property

分组标题

## Signature

```typescript
title: string;
```

### type

# ColumnGroupDef.type property

## Signature

```typescript
type: 'group';
```
