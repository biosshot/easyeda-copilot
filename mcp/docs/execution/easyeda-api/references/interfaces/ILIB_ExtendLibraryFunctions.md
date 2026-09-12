# ILIB\_ExtendLibraryFunctions interface

External library functions

## Signature

```typescript
interface ILIB_ExtendLibraryFunctions
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[getClassificationTree](./ILIB_ExtendLibraryFunctions.md)||() =&gt; Promise&lt;Array&lt;{ name: string; uuid?: string; children?: Array&lt;{ name: string; uuid?: string }&gt; \| undefined }&gt;&gt;|获取分类树|
|[getDetail](./ILIB_ExtendLibraryFunctions.md)||(uuid: string) =&gt; Promise&lt;any&gt;|获取详细信息|
|[getList](./ILIB_ExtendLibraryFunctions.md)||(props: [ILIB\_ExtendLibrarySearchProperty](./ILIB_ExtendLibrarySearchProperty.md)<!-- -->&lt;any&gt;) =&gt; Promise&lt;[ILIB\_ExtendLibrarySearchResult](./ILIB_ExtendLibrarySearchResult.md)<!-- -->&lt;any&gt;&gt;|获取列表|

---

## 属性详情

### getclassificationtree

# ILIB\_ExtendLibraryFunctions.getClassificationTree property

获取分类树

## Signature

```typescript
getClassificationTree: () =>
	Promise<
		Array<{
			name: string;
			uuid?: string;
			children?: Array<{ name: string; uuid?: string }> | undefined;
		}>
	>;
```

### getdetail

# ILIB\_ExtendLibraryFunctions.getDetail property

获取详细信息

## Signature

```typescript
getDetail: (uuid: string) => Promise<any>;
```

### getlist

# ILIB\_ExtendLibraryFunctions.getList property

获取列表

## Signature

```typescript
getList: (props: ILIB_ExtendLibrarySearchProperty<any>) =>
	Promise<ILIB_ExtendLibrarySearchResult<any>>;
```
