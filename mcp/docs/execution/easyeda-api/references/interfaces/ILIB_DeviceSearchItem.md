# ILIB\_DeviceSearchItem interface

Searched device properties

## Signature

```typescript
interface ILIB_DeviceSearchItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[classification?](./ILIB_DeviceSearchItem.md)||[ILIB\_ClassificationIndex](./ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Device classification|
|[description?](./ILIB_DeviceSearchItem.md)||string|_(Optional)_ Description|
|[footprint?](./ILIB_DeviceSearchItem.md)||\{ name: string; uuid: string; libraryUuid: string \}|_(Optional)_ Associate footprint|
|[footprintName?](./ILIB_DeviceSearchItem.md)||string|_(Optional)_ 关联封装名称|
|[footprintUuid](./ILIB_DeviceSearchItem.md)||string|关联封装 UUID|
|[imageUuid?](./ILIB_DeviceSearchItem.md)||string \| string\[\]|_(Optional)_ Associate image UUID|
|[libraryUuid](./ILIB_DeviceSearchItem.md)||string|UUID of the library it belongs to|
|[model3D?](./ILIB_DeviceSearchItem.md)||\{ name: string; uuid: string; libraryUuid: string \}|_(Optional)_ Associate 3D model|
|[model3DName?](./ILIB_DeviceSearchItem.md)||string|_(Optional)_ 关联 3D 模型名称|
|[model3DUuid](./ILIB_DeviceSearchItem.md)||string|关联 3D 模型 UUID|
|[name](./ILIB_DeviceSearchItem.md)||string|Device name|
|[ordinal](./ILIB_DeviceSearchItem.md)||number|Sorting|
|[otherProperty?](./ILIB_DeviceSearchItem.md)||\{ \[key: string\]: boolean \| number \| string \| undefined \}|_(Optional)_ Other property|
|[symbol](./ILIB_DeviceSearchItem.md)||\{ name: string; uuid: string; libraryUuid: string \}|Associated symbol|
|[symbolName](./ILIB_DeviceSearchItem.md)||string|关联符号名称|
|[symbolUuid](./ILIB_DeviceSearchItem.md)||string|关联符号 UUID|
|[uuid](./ILIB_DeviceSearchItem.md)||string|Device UUID|

---

## 属性详情

### classification

# ILIB\_DeviceSearchItem.classification property

Device classification

## Signature

```typescript
classification?: ILIB_ClassificationIndex | Array<string>;
```

### description

# ILIB\_DeviceSearchItem.description property

Description

## Signature

```typescript
description?: string;
```

### footprint

# ILIB\_DeviceSearchItem.footprint property

Associate footprint

## Signature

```typescript
footprint?: { name: string; uuid: string; libraryUuid: string };
```

### footprintname

# ILIB\_DeviceSearchItem.footprintName property

> Warning: This API is now obsolete.
>
> 请使用 [footprint](./ILIB_DeviceSearchItem.md) 替代

关联封装名称

## Signature

```typescript
footprintName?: string;
```

### footprintuuid

# ILIB\_DeviceSearchItem.footprintUuid property

> Warning: This API is now obsolete.
>
> 请使用 [footprint](./ILIB_DeviceSearchItem.md) 替代

关联封装 UUID

## Signature

```typescript
footprintUuid: string;
```

### imageuuid

# ILIB\_DeviceSearchItem.imageUuid property

Associate image UUID

## Signature

```typescript
imageUuid?: string | string[];
```

### libraryuuid

# ILIB\_DeviceSearchItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### model3d

# ILIB\_DeviceSearchItem.model3D property

Associate 3D model

## Signature

```typescript
model3D?: { name: string; uuid: string; libraryUuid: string };
```

### model3dname

# ILIB\_DeviceSearchItem.model3DName property

> Warning: This API is now obsolete.
>
> 请使用 [model3D](./ILIB_DeviceSearchItem.md) 替代

关联 3D 模型名称

## Signature

```typescript
model3DName?: string;
```

### model3duuid

# ILIB\_DeviceSearchItem.model3DUuid property

> Warning: This API is now obsolete.
>
> 请使用 [model3D](./ILIB_DeviceSearchItem.md) 替代

关联 3D 模型 UUID

## Signature

```typescript
model3DUuid: string;
```

### name

# ILIB\_DeviceSearchItem.name property

Device name

## Signature

```typescript
name: string;
```

### ordinal

# ILIB\_DeviceSearchItem.ordinal property

Sorting

## Signature

```typescript
ordinal: number;
```

### otherproperty

# ILIB\_DeviceSearchItem.otherProperty property

Other property

## Signature

```typescript
otherProperty?: { [key: string]: boolean | number | string | undefined };
```

### symbol

# ILIB\_DeviceSearchItem.symbol property

Associated symbol

## Signature

```typescript
symbol: {
	name: string;
	uuid: string;
	libraryUuid: string;
}
```

### symbolname

# ILIB\_DeviceSearchItem.symbolName property

> Warning: This API is now obsolete.
>
> 请使用 [symbol](./ILIB_DeviceSearchItem.md) 替代

关联符号名称

## Signature

```typescript
symbolName: string;
```

### symboluuid

# ILIB\_DeviceSearchItem.symbolUuid property

> Warning: This API is now obsolete.
>
> 请使用 [symbol](./ILIB_DeviceSearchItem.md) 替代

关联符号 UUID

## Signature

```typescript
symbolUuid: string;
```

### uuid

# ILIB\_DeviceSearchItem.uuid property

Device UUID

## Signature

```typescript
uuid: string;
```
