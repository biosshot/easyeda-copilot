# IDMT\_SchematicPageItem interface

Schematic sheet property

## Signature

```typescript
interface IDMT_SchematicPageItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[itemType](./IDMT_SchematicPageItem.md)|`readonly`|[EDMT\_ItemType.SCHEMATIC\_PAGE](../enums/EDMT_ItemType.md)|Project type|
|[name](./IDMT_SchematicPageItem.md)||string|Schematic sheet name|
|[parentSchematicUuid](./IDMT_SchematicPageItem.md)||string|UUID of the schematic it belongs to|
|[showTitleBlock](./IDMT_SchematicPageItem.md)||boolean|Whether to show the title block|
|[titleBlockData](./IDMT_SchematicPageItem.md)||\{ \[key: string\]: \{ showTitle: boolean; showValue: boolean; value: any \} \}|Title block data|
|[uuid](./IDMT_SchematicPageItem.md)||string|Schematic sheet UUID|

---

## 属性详情

### itemtype

# IDMT\_SchematicPageItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.SCHEMATIC_PAGE;
```

### name

# IDMT\_SchematicPageItem.name property

Schematic sheet name

## Signature

```typescript
name: string;
```

### parentschematicuuid

# IDMT\_SchematicPageItem.parentSchematicUuid property

UUID of the schematic it belongs to

## Signature

```typescript
parentSchematicUuid: string;
```

### showtitleblock

# IDMT\_SchematicPageItem.showTitleBlock property

Whether to show the title block

## Signature

```typescript
showTitleBlock: boolean;
```

### titleblockdata

# IDMT\_SchematicPageItem.titleBlockData property

Title block data

## Signature

```typescript
titleBlockData: { [key: string]: { showTitle: boolean; showValue: boolean; value: any } };
```

### uuid

# IDMT\_SchematicPageItem.uuid property

Schematic sheet UUID

## Signature

```typescript
uuid: string;
```
