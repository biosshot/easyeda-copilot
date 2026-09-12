# ILIB\_DeviceAssociationItem interface

Device associated symbol, footprint property

## Signature

```typescript
interface ILIB_DeviceAssociationItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[footprint?](./ILIB_DeviceAssociationItem.md)||\{ uuid: string; libraryUuid: string \}|_(Optional)_ Footprint|
|[footprintUuid](./ILIB_DeviceAssociationItem.md)||string|封装 UUID|
|[images?](./ILIB_DeviceAssociationItem.md)||Array&lt;string&gt;|_(Optional)_|
|[symbol](./ILIB_DeviceAssociationItem.md)||{ type: [ELIB\_SymbolType](../enums/ELIB_SymbolType.md)<!-- -->; uuid: string; libraryUuid: string }|Symbol|
|[symbolType](./ILIB_DeviceAssociationItem.md)||[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|符号类型|
|[symbolUuid](./ILIB_DeviceAssociationItem.md)||string|符号 UUID|

---

## 属性详情

### footprint

# ILIB\_DeviceAssociationItem.footprint property

Footprint

## Signature

```typescript
footprint?: { uuid: string; libraryUuid: string };
```

### footprintuuid

# ILIB\_DeviceAssociationItem.footprintUuid property

> Warning: This API is now obsolete.
>
> 请使用 [footprint](./ILIB_DeviceSearchItem.md) 替代

封装 UUID

## Signature

```typescript
footprintUuid: string;
```

### images

# ILIB\_DeviceAssociationItem.images property

## Signature

```typescript
images?: Array<string>;
```

### symbol

# ILIB\_DeviceAssociationItem.symbol property

Symbol

## Signature

```typescript
symbol: {
	type: ELIB_SymbolType;
	uuid: string;
	libraryUuid: string;
}
```

### symboltype

# ILIB\_DeviceAssociationItem.symbolType property

> Warning: This API is now obsolete.
>
> 请使用 [symbol](./ILIB_DeviceSearchItem.md) 替代

符号类型

## Signature

```typescript
symbolType: ELIB_SymbolType;
```

### symboluuid

# ILIB\_DeviceAssociationItem.symbolUuid property

> Warning: This API is now obsolete.
>
> 请使用 [symbol](./ILIB_DeviceSearchItem.md) 替代

符号 UUID

## Signature

```typescript
symbolUuid: string;
```
