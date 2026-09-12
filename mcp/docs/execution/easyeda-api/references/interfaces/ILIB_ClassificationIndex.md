# ILIB\_ClassificationIndex interface

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Classification index

## Signature

```typescript
interface ILIB_ClassificationIndex
```

## Remarks

This classification index is used to index the classifications in the specified library. The library UUID and library type are only used for identification purposes of this index, to prevent indexes in different libraries from referencing each other and causing errors

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[libraryType](./ILIB_ClassificationIndex.md)||[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_ClassificationIndex.md)||string|Library UUID|
|[primaryClassificationUuid](./ILIB_ClassificationIndex.md)||string|Primary classification UUID|
|[secondaryClassificationUuid?](./ILIB_ClassificationIndex.md)||string|_(Optional)_ Secondary classification UUID|

---

## 属性详情

### librarytype

# ILIB\_ClassificationIndex.libraryType property

Library type

## Signature

```typescript
libraryType: ELIB_LibraryType;
```

### libraryuuid

# ILIB\_ClassificationIndex.libraryUuid property

Library UUID

## Signature

```typescript
libraryUuid: string;
```

### primaryclassificationuuid

# ILIB\_ClassificationIndex.primaryClassificationUuid property

Primary classification UUID

## Signature

```typescript
primaryClassificationUuid: string;
```

### secondaryclassificationuuid

# ILIB\_ClassificationIndex.secondaryClassificationUuid property

Secondary classification UUID

## Signature

```typescript
secondaryClassificationUuid?: string;
```
