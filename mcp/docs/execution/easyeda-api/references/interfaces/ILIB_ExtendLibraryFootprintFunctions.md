# ILIB\_ExtendLibraryFootprintFunctions interface

External library footprint functions

## Signature

```typescript
interface ILIB_ExtendLibraryFootprintFunctions extends ILIB_ExtendLibraryFunctions
```
**Extends:** [ILIB\_ExtendLibraryFunctions](./ILIB_ExtendLibraryFunctions.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[getList](./ILIB_ExtendLibraryFootprintFunctions.md)||(props: [ILIB\_ExtendLibrarySearchProperty](./ILIB_ExtendLibrarySearchProperty.md)<!-- -->&lt;{ }&gt;) =&gt; Promise&lt;[ILIB\_ExtendLibrarySearchResult](./ILIB_ExtendLibrarySearchResult.md)<!-- -->&lt;[ILIB\_ExtendLibraryItem](./ILIB_ExtendLibraryItem.md) &amp; [ILIB\_ExtendLibrarySearchResultDataLine](./ILIB_ExtendLibrarySearchResultDataLine.md)<!-- -->&gt;&gt;||

---

## 属性详情

### getlist

# ILIB\_ExtendLibraryFootprintFunctions.getList property

## Signature

```typescript
getList: (props: ILIB_ExtendLibrarySearchProperty<{}>) =>
	Promise<
		ILIB_ExtendLibrarySearchResult<
			ILIB_ExtendLibraryItem & ILIB_ExtendLibrarySearchResultDataLine
		>
	>;
```
