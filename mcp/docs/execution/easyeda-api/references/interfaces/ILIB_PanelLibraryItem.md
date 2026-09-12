# ILIB\_PanelLibraryItem interface

Panel library property

## Signature

```typescript
interface ILIB_PanelLibraryItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[classification?](./ILIB_PanelLibraryItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_PanelLibraryItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_PanelLibraryItem.md)|`readonly`|[ELIB\_LibraryType.PANEL\_LIBRARY](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_PanelLibraryItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_PanelLibraryItem.md)||string|Panel library name|
|[uuid](./ILIB_PanelLibraryItem.md)||string|Panel library UUID|

---

## 属性详情

### classification

# ILIB\_PanelLibraryItem.classification property

Classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_PanelLibraryItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_PanelLibraryItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.PANEL_LIBRARY;
```

### libraryuuid

# ILIB\_PanelLibraryItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_PanelLibraryItem.name property

Panel library name

## Signature

```typescript
name: string;
```

### uuid

# ILIB\_PanelLibraryItem.uuid property

Panel library UUID

## Signature

```typescript
uuid: string;
```
