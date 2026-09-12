# IDMT\_SchematicItem interface

Schematic property

## Signature

```typescript
interface IDMT_SchematicItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[cbbSymbol?](./IDMT_SchematicItem.md)||[ILIB\_SymbolItem](./ILIB_SymbolItem.md)|_(Optional)_ The module symbol associated with the reuse block schematic|
|[itemType](./IDMT_SchematicItem.md)|`readonly`|[EDMT\_ItemType.SCHEMATIC](../enums/EDMT_ItemType.md) \| [EDMT\_ItemType.CBB\_SCHEMATIC](../enums/EDMT_ItemType.md)|Project type|
|[name](./IDMT_SchematicItem.md)||string|Schematic name|
|[page](./IDMT_SchematicItem.md)||Array&lt;[IDMT\_SchematicPageItem](./IDMT_SchematicPageItem.md)<!-- -->&gt;|Subordinate schematic sheet|
|[parentBoardName?](./IDMT_SchematicItem.md)||string|_(Optional)_ Name of the board it belongs to|
|[parentProjectUuid](./IDMT_SchematicItem.md)||string|UUID of the project it belongs to|
|[uuid](./IDMT_SchematicItem.md)||string|Schematic UUID|

---

## 属性详情

### cbbsymbol

# IDMT\_SchematicItem.cbbSymbol property

The module symbol associated with the reuse block schematic

## Signature

```typescript
cbbSymbol?: ILIB_SymbolItem;
```

### itemtype

# IDMT\_SchematicItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.SCHEMATIC | EDMT_ItemType.CBB_SCHEMATIC;
```

### name

# IDMT\_SchematicItem.name property

Schematic name

## Signature

```typescript
name: string;
```

### page

# IDMT\_SchematicItem.page property

Subordinate schematic sheet

## Signature

```typescript
page: Array<IDMT_SchematicPageItem>;
```

### parentboardname

# IDMT\_SchematicItem.parentBoardName property

Name of the board it belongs to

## Signature

```typescript
parentBoardName?: string;
```

### parentprojectuuid

# IDMT\_SchematicItem.parentProjectUuid property

UUID of the project it belongs to

## Signature

```typescript
parentProjectUuid: string;
```

### uuid

# IDMT\_SchematicItem.uuid property

Schematic UUID

## Signature

```typescript
uuid: string;
```
