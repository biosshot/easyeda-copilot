# ILIB\_DeviceItem interface

Device property

## Signature

```typescript
interface ILIB_DeviceItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[association](./ILIB_DeviceItem.md)||[ILIB\_DeviceAssociationItem](./ILIB_DeviceAssociationItem.md)|Associate|
|[classification?](./ILIB_DeviceItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Device classification|
|[description?](./ILIB_DeviceItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_DeviceItem.md)|`readonly`|[ELIB\_LibraryType.DEVICE](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_DeviceItem.md)||string|UUID of the library it belongs to|
|[name](./ILIB_DeviceItem.md)||string|Device name|
|[property](./ILIB_DeviceItem.md)||[ILIB\_DeviceExtendPropertyItem](./ILIB_DeviceExtendPropertyItem.md)|Extension property|
|[subPartNames](./ILIB_DeviceItem.md)||\[\]|Sub-part name array|
|[uuid](./ILIB_DeviceItem.md)||string|Device UUID|

---

## 属性详情

### association

# ILIB\_DeviceItem.association property

Associate

## Signature

```typescript
association: ILIB_DeviceAssociationItem;
```

### classification

# ILIB\_DeviceItem.classification property

Device classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_DeviceItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_DeviceItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.DEVICE;
```

### libraryuuid

# ILIB\_DeviceItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### name

# ILIB\_DeviceItem.name property

Device name

## Signature

```typescript
name: string;
```

### property

# ILIB\_DeviceItem.property property

Extension property

## Signature

```typescript
property: ILIB_DeviceExtendPropertyItem;
```

### subpartnames

# ILIB\_DeviceItem.subPartNames property

Sub-part name array

## Signature

```typescript
subPartNames: [];
```

### uuid

# ILIB\_DeviceItem.uuid property

Device UUID

## Signature

```typescript
uuid: string;
```
