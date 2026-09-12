# IDMT\_EditorSplitScreenItem interface

Editor split screen property

## Signature

```typescript
interface IDMT_EditorSplitScreenItem
```

## Remarks

[tabs](./IDMT_EditorSplitScreenItem.md) and [children](./IDMT_EditorSplitScreenItem.md) do not exist at the same time. When [tabs](./IDMT_EditorSplitScreenItem.md) exists, it means there is no split screen, and [children](./IDMT_EditorSplitScreenItem.md) will be `undefined`

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[children?](./IDMT_EditorSplitScreenItem.md)||Array&lt;[IDMT\_EditorSplitScreenItem](./IDMT_EditorSplitScreenItem.md)<!-- -->&gt;|_(Optional)_ Child split screens|
|[direction?](./IDMT_EditorSplitScreenItem.md)||[EDMT\_EditorSplitScreenDirection](../enums/EDMT_EditorSplitScreenDirection.md)|_(Optional)_ Split screen direction|
|[fatherId?](./IDMT_EditorSplitScreenItem.md)||string|_(Optional)_ Parent split screen ID|
|[id](./IDMT_EditorSplitScreenItem.md)||string|Split screen ID|
|[tabs?](./IDMT_EditorSplitScreenItem.md)||Array&lt;[IDMT\_EditorTabItem](./IDMT_EditorTabItem.md)<!-- -->&gt;|_(Optional)_ Split screen in tab|

---

## 属性详情

### children

# IDMT\_EditorSplitScreenItem.children property

Child split screens

## Signature

```typescript
children?: Array<IDMT_EditorSplitScreenItem>;
```

### direction

# IDMT\_EditorSplitScreenItem.direction property

Split screen direction

## Signature

```typescript
direction?: EDMT_EditorSplitScreenDirection;
```

### fatherid

# IDMT\_EditorSplitScreenItem.fatherId property

Parent split screen ID

## Signature

```typescript
fatherId?: string;
```

### id

# IDMT\_EditorSplitScreenItem.id property

Split screen ID

## Signature

```typescript
id: string;
```

### tabs

# IDMT\_EditorSplitScreenItem.tabs property

Split screen in tab

## Signature

```typescript
tabs?: Array<IDMT_EditorTabItem>;
```
