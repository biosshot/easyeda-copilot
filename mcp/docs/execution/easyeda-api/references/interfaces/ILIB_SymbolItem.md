# ILIB\_SymbolItem interface

Symbol property

## Signature

```typescript
interface ILIB_SymbolItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[cbbUuid?](./ILIB_SymbolItem.md)||string|_(Optional)_ UUID of the reuse block it belongs to. Only the reuse block symbol has this property|
|[classification?](./ILIB_SymbolItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_SymbolItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_SymbolItem.md)|`readonly`|[ELIB\_LibraryType.SYMBOL](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_SymbolItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_SymbolItem.md)||string|Symbol name|
|[otherProperty?](./ILIB_SymbolItem.md)||Record&lt;string, boolean \| number \| string \| undefined&gt;|_(Optional)_ 其它属性|
|[subPartNames](./ILIB_SymbolItem.md)||\[\]|Sub-part name array|
|[type](./ILIB_SymbolItem.md)||[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|Symbol type|
|[uuid](./ILIB_SymbolItem.md)||string|Symbol UUID|

---

## 属性详情

### cbbuuid

# ILIB\_SymbolItem.cbbUuid property

UUID of the reuse block it belongs to. Only the reuse block symbol has this property

## Signature

```typescript
cbbUuid?: string;
```

### classification

# ILIB\_SymbolItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_SymbolItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_SymbolItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.SYMBOL;
```

### libraryuuid

# ILIB\_SymbolItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_SymbolItem.name property

Symbol name

## Signature

```typescript
name: string;
```

### otherproperty

# ILIB\_SymbolItem.otherProperty property

其它属性

## Signature

```typescript
otherProperty?: Record<string, boolean | number | string | undefined>;
```

### subpartnames

# ILIB\_SymbolItem.subPartNames property

Sub-part name array

## Signature

```typescript
subPartNames: [];
```

### type

# ILIB\_SymbolItem.type property

Symbol type

## Signature

```typescript
type: ELIB_SymbolType;
```

### uuid

# ILIB\_SymbolItem.uuid property

Symbol UUID

## Signature

```typescript
uuid: string;
```
