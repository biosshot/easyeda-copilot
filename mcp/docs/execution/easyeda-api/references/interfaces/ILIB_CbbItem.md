# ILIB\_CbbItem interface

Reuse block property

## Signature

```typescript
interface ILIB_CbbItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[boards](./ILIB_CbbItem.md)||Array&lt;[IDMT\_BoardItem](./IDMT_BoardItem.md)<!-- -->&gt;|Subordinate boards|
|[classification?](./ILIB_CbbItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_CbbItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_CbbItem.md)|`readonly`|[ELIB\_LibraryType.CBB](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_CbbItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_CbbItem.md)||string|Reuse block name|
|[uuid](./ILIB_CbbItem.md)||string|Reuse block UUID|

---

## 属性详情

### boards

# ILIB\_CbbItem.boards property

Subordinate boards

## Signature

```typescript
boards: Array<IDMT_BoardItem>;
```

### classification

# ILIB\_CbbItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_CbbItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_CbbItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.CBB;
```

### libraryuuid

# ILIB\_CbbItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_CbbItem.name property

Reuse block name

## Signature

```typescript
name: string;
```

### uuid

# ILIB\_CbbItem.uuid property

Reuse block UUID

## Signature

```typescript
uuid: string;
```
