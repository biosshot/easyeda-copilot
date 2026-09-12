# ListChildren interface

列表项：支持多级嵌套分组

## Signature

```typescript
interface ListChildren
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[children?](./ListChildren.md)||[ListChildren](./ListChildren.md)<!-- -->\[\]|_(Optional)_ Child list items, used for multi-level nesting|
|[clearBtn?](./ListChildren.md)||boolean|_(Optional)_ Whether Show clear button|
|[icons?](./ListChildren.md)||[IconProps](./IconProps.md)<!-- -->\[\]|_(Optional)_ List of list item icons|
|[id?](./ListChildren.md)||string|_(Optional)_ Unique ID of the list item|
|[selected?](./ListChildren.md)||boolean|_(Optional)_ Whether Select|
|[title](./ListChildren.md)||string|List item title (required)|
|[value?](./ListChildren.md)||string|_(Optional)_ Associated value of the list item|

---

## 属性详情

### children

# ListChildren.children property

Child list items, used for multi-level nesting

## Signature

```typescript
children?: ListChildren[];
```

### clearbtn

# ListChildren.clearBtn property

Whether Show clear button

## Signature

```typescript
clearBtn?: boolean;
```

### icons

# ListChildren.icons property

List of list item icons

## Signature

```typescript
icons?: IconProps[];
```

### id

# ListChildren.id property

Unique ID of the list item

## Signature

```typescript
id?: string;
```

### selected

# ListChildren.selected property

Whether Select

## Signature

```typescript
selected?: boolean;
```

### title

# ListChildren.title property

List item title (required)

## Signature

```typescript
title: string;
```

### value

# ListChildren.value property

Associated value of the list item

## Signature

```typescript
value?: string;
```
