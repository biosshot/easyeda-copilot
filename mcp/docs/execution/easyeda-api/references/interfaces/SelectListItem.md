# SelectListItem interface

下拉选项：支持多级嵌套分组

## Signature

```typescript
interface SelectListItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[children?](./SelectListItem.md)||[SelectListItem](./SelectListItem.md)<!-- -->\[\]|_(Optional)_ Child options, used for multi-level nesting|
|[selected?](./SelectListItem.md)||boolean|_(Optional)_ Whether Select|
|[title](./SelectListItem.md)||string|Option title (required)|
|[value?](./SelectListItem.md)||string|_(Optional)_ Associated value of the option|

---

## 属性详情

### children

# SelectListItem.children property

Child options, used for multi-level nesting

## Signature

```typescript
children?: SelectListItem[];
```

### selected

# SelectListItem.selected property

Whether Select

## Signature

```typescript
selected?: boolean;
```

### title

# SelectListItem.title property

Option title (required)

## Signature

```typescript
title: string;
```

### value

# SelectListItem.value property

Associated value of the option

## Signature

```typescript
value?: string;
```
