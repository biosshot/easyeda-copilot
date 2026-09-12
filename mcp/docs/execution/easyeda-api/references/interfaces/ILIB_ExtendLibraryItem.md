# ILIB\_ExtendLibraryItem interface

External library item

## Signature

```typescript
interface ILIB_ExtendLibraryItem extends ILIB_ExtendLibraryItemIndex
```
**Extends:** [ILIB\_ExtendLibraryItemIndex](./ILIB_ExtendLibraryItemIndex.md)

## Remarks

Here the `url` or `data` field needs to be passed. If both are passed, the data of `data` is used and the `url` field is ignored

If only the `url` field is passed in, a request will be made to it to try to obtain its library file

The data of `data` can be in Blob or DataURL format

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[data?](./ILIB_ExtendLibraryItem.md)||string \| Blob|_(Optional)_ Library file data|
|[url?](./ILIB_ExtendLibraryItem.md)||string|_(Optional)_ Library file URL|

---

## 属性详情

### data

# ILIB\_ExtendLibraryItem.data property

Library file data

## Signature

```typescript
data?: string | Blob;
```

### url

# ILIB\_ExtendLibraryItem.url property

Library file URL

## Signature

```typescript
url?: string;
```
