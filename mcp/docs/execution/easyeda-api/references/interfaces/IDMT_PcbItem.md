# IDMT\_PcbItem interface

PCB property

## Signature

```typescript
interface IDMT_PcbItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[itemType](./IDMT_PcbItem.md)|`readonly`|[EDMT\_ItemType.PCB](../enums/EDMT_ItemType.md) \| [EDMT\_ItemType.CBB\_PCB](../enums/EDMT_ItemType.md)|Project type|
|[name](./IDMT_PcbItem.md)||string|PCB name|
|[parentBoardName?](./IDMT_PcbItem.md)||string|_(Optional)_ Name of the board it belongs to|
|[parentProjectUuid](./IDMT_PcbItem.md)||string|UUID of the project it belongs to|
|[uuid](./IDMT_PcbItem.md)||string|PCB UUID|

---

## 属性详情

### itemtype

# IDMT\_PcbItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.PCB | EDMT_ItemType.CBB_PCB;
```

### name

# IDMT\_PcbItem.name property

PCB name

## Signature

```typescript
name: string;
```

### parentboardname

# IDMT\_PcbItem.parentBoardName property

Name of the board it belongs to

## Signature

```typescript
parentBoardName?: string;
```

### parentprojectuuid

# IDMT\_PcbItem.parentProjectUuid property

UUID of the project it belongs to

## Signature

```typescript
parentProjectUuid: string;
```

### uuid

# IDMT\_PcbItem.uuid property

PCB UUID

## Signature

```typescript
uuid: string;
```
