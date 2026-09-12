# ILIB\_SymbolSearchItem interface

Searched symbol properties

## Signature

```typescript
interface ILIB_SymbolSearchItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[ascription](./ILIB_SymbolSearchItem.md)||string|Ownership|
|[classification?](./ILIB_SymbolSearchItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_SymbolSearchItem.md)||string|_(Optional)_ Description|
|[lastModifiedBy](./ILIB_SymbolSearchItem.md)||string|Last modifier|
|[libraryUuid](./ILIB_SymbolSearchItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_SymbolSearchItem.md)||string|Symbol name|
|[ordinal](./ILIB_SymbolSearchItem.md)||number|Sorting|
|[type](./ILIB_SymbolSearchItem.md)||[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|Symbol type|
|[updateTimestamp](./ILIB_SymbolSearchItem.md)||number|Update timestamp|
|[uuid](./ILIB_SymbolSearchItem.md)||string|Symbol UUID|

---

## 属性详情

### ascription

# ILIB\_SymbolSearchItem.ascription property

Ownership

## Signature

```typescript
ascription: string;
```

### classification

# ILIB\_SymbolSearchItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_SymbolSearchItem.description property

Description

## Signature

```typescript
description?: string;
```

### lastmodifiedby

# ILIB\_SymbolSearchItem.lastModifiedBy property

Last modifier

## Signature

```typescript
lastModifiedBy: string;
```

### libraryuuid

# ILIB\_SymbolSearchItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_SymbolSearchItem.name property

Symbol name

## Signature

```typescript
name: string;
```

### ordinal

# ILIB\_SymbolSearchItem.ordinal property

Sorting

## Signature

```typescript
ordinal: number;
```

### type

# ILIB\_SymbolSearchItem.type property

Symbol type

## Signature

```typescript
type: ELIB_SymbolType;
```

### updatetimestamp

# ILIB\_SymbolSearchItem.updateTimestamp property

Update timestamp

## Signature

```typescript
updateTimestamp: number;
```

### uuid

# ILIB\_SymbolSearchItem.uuid property

Symbol UUID

## Signature

```typescript
uuid: string;
```
