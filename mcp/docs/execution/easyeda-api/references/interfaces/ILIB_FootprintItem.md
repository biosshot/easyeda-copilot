# ILIB\_FootprintItem interface

Footprint property

## Signature

```typescript
interface ILIB_FootprintItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[classification?](./ILIB_FootprintItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_FootprintItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_FootprintItem.md)|`readonly`|[ELIB\_LibraryType.FOOTPRINT](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_FootprintItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_FootprintItem.md)||string|Footprint name|
|[otherProperty?](./ILIB_FootprintItem.md)||Record&lt;string, boolean \| number \| string \| undefined&gt;|_(Optional)_ 其它属性|
|[uuid](./ILIB_FootprintItem.md)||string|Footprint UUID|

---

## 属性详情

### classification

# ILIB\_FootprintItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_FootprintItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_FootprintItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.FOOTPRINT;
```

### libraryuuid

# ILIB\_FootprintItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_FootprintItem.name property

Footprint name

## Signature

```typescript
name: string;
```

### otherproperty

# ILIB\_FootprintItem.otherProperty property

其它属性

## Signature

```typescript
otherProperty?: Record<string, boolean | number | string | undefined>;
```

### uuid

# ILIB\_FootprintItem.uuid property

Footprint UUID

## Signature

```typescript
uuid: string;
```
