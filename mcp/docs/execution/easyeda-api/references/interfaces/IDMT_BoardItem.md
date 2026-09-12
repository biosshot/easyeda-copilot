# IDMT\_BoardItem interface

Board property

## Signature

```typescript
interface IDMT_BoardItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[itemType](./IDMT_BoardItem.md)|`readonly`|[EDMT\_ItemType.BOARD](../enums/EDMT_ItemType.md)|Project type|
|[name](./IDMT_BoardItem.md)||string|Board name|
|[parentProjectUuid](./IDMT_BoardItem.md)||string|UUID of the project it belongs to|
|[pcb](./IDMT_BoardItem.md)||[IDMT\_PcbItem](./IDMT_PcbItem.md)|Subordinate PCB|
|[schematic](./IDMT_BoardItem.md)||[IDMT\_SchematicItem](./IDMT_SchematicItem.md)|Subordinate schematic|

---

## 属性详情

### itemtype

# IDMT\_BoardItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.BOARD;
```

### name

# IDMT\_BoardItem.name property

Board name

## Signature

```typescript
name: string;
```

### parentprojectuuid

# IDMT\_BoardItem.parentProjectUuid property

UUID of the project it belongs to

## Signature

```typescript
parentProjectUuid: string;
```

### pcb

# IDMT\_BoardItem.pcb property

Subordinate PCB

## Signature

```typescript
pcb: IDMT_PcbItem;
```

### schematic

# IDMT\_BoardItem.schematic property

Subordinate schematic

## Signature

```typescript
schematic: IDMT_SchematicItem;
```
