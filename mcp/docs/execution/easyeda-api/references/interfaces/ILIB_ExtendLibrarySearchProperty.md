# ILIB\_ExtendLibrarySearchProperty interface

External library search property

## Signature

```typescript
interface ILIB_ExtendLibrarySearchProperty<T>
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[page?](./ILIB_ExtendLibrarySearchProperty.md)||number|_(Optional)_ Page count|
|[pageSize?](./ILIB_ExtendLibrarySearchProperty.md)||number|_(Optional)_ Number of entries per page|
|[query](./ILIB_ExtendLibrarySearchProperty.md)||T &amp; { wd?: string; listByTitles?: Array&lt;string&gt;; classification?: [ILIB\_ExtendLibraryClassificationIndex](./ILIB_ExtendLibraryClassificationIndex.md) \| Array&lt;string&gt; }|Query parameter|

---

## 属性详情

### page

# ILIB\_ExtendLibrarySearchProperty.page property

Page count

## Signature

```typescript
page?: number;
```

### pagesize

# ILIB\_ExtendLibrarySearchProperty.pageSize property

Number of entries per page

## Signature

```typescript
pageSize?: number;
```

### query

# ILIB\_ExtendLibrarySearchProperty.query property

Query parameter

## Signature

```typescript
query: T & { wd?: string; listByTitles?: Array<string>; classification?: ILIB_ExtendLibraryClassificationIndex | Array<string> };
```
