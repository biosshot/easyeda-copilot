# ILIB\_3DModelItem interface

3D model property

## Signature

```typescript
interface ILIB_3DModelItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[classification?](./ILIB_3DModelItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_3DModelItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_3DModelItem.md)|`readonly`|[ELIB\_LibraryType.MODEL](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_3DModelItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_3DModelItem.md)||string|3D model name|
|[uuid](./ILIB_3DModelItem.md)||string|3D model UUID|

---

## 属性详情

### classification

# ILIB\_3DModelItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_3DModelItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_3DModelItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.MODEL;
```

### libraryuuid

# ILIB\_3DModelItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_3DModelItem.name property

3D model name

## Signature

```typescript
name: string;
```

### uuid

# ILIB\_3DModelItem.uuid property

3D model UUID

## Signature

```typescript
uuid: string;
```
