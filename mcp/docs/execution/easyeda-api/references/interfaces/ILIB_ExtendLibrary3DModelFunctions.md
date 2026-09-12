# ILIB\_ExtendLibrary3DModelFunctions interface

External library 3D model functions

## Signature

```typescript
interface ILIB_ExtendLibrary3DModelFunctions extends ILIB_ExtendLibraryFunctions
```
**Extends:** [ILIB\_ExtendLibraryFunctions](./ILIB_ExtendLibraryFunctions.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[getList](./ILIB_ExtendLibrary3DModelFunctions.md)||(props: [ILIB\_ExtendLibrarySearchProperty](./ILIB_ExtendLibrarySearchProperty.md)<!-- -->&lt;{ }&gt;) =&gt; Promise&lt;[ILIB\_ExtendLibrarySearchResult](./ILIB_ExtendLibrarySearchResult.md)<!-- -->&lt;[ILIB\_ExtendLibraryItemIndex](./ILIB_ExtendLibraryItemIndex.md) &amp; [ILIB\_ExtendLibrarySearchResultDataLine](./ILIB_ExtendLibrarySearchResultDataLine.md) &amp; { modelType: 'step' }&gt;&gt;||

---

## 属性详情

### getlist

# ILIB\_ExtendLibrary3DModelFunctions.getList property

## Signature

```typescript
getList: (props: ILIB_ExtendLibrarySearchProperty<{}>) =>
	Promise<
		ILIB_ExtendLibrarySearchResult<
			ILIB_ExtendLibraryItemIndex
			& ILIB_ExtendLibrarySearchResultDataLine & { modelType: 'step' }
		>
	>;
```
