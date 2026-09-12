# ILIB\_ExtendLibrarySymbolFunctions interface

External library symbol functions

## Signature

```typescript
interface ILIB_ExtendLibrarySymbolFunctions extends ILIB_ExtendLibraryFunctions
```
**Extends:** [ILIB\_ExtendLibraryFunctions](./ILIB_ExtendLibraryFunctions.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[getList](./ILIB_ExtendLibrarySymbolFunctions.md)||(props: [ILIB\_ExtendLibrarySearchProperty](./ILIB_ExtendLibrarySearchProperty.md)<!-- -->&lt;{ symbolType?: [ELIB\_SymbolType](../enums/ELIB_SymbolType.md) }&gt;) =&gt; Promise&lt;[ILIB\_ExtendLibrarySearchResult](./ILIB_ExtendLibrarySearchResult.md)<!-- -->&lt;[ILIB\_ExtendLibraryItem](./ILIB_ExtendLibraryItem.md) &amp; [ILIB\_ExtendLibrarySearchResultDataLine](./ILIB_ExtendLibrarySearchResultDataLine.md) &amp; { symbolType: [ELIB\_SymbolType](../enums/ELIB_SymbolType.md) }&gt;&gt;||
|[getSupportedSymbolTypes](./ILIB_ExtendLibrarySymbolFunctions.md)||() =&gt; Promise&lt;Array&lt;[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)<!-- -->&gt;&gt;|获取支持的符号类型|

---

## 属性详情

### getlist

# ILIB\_ExtendLibrarySymbolFunctions.getList property

## Signature

```typescript
getList: (props: ILIB_ExtendLibrarySearchProperty<{ symbolType?: ELIB_SymbolType }>) =>
	Promise<
		ILIB_ExtendLibrarySearchResult<
			ILIB_ExtendLibraryItem
			& ILIB_ExtendLibrarySearchResultDataLine & { symbolType: ELIB_SymbolType }
		>
	>;
```

### getsupportedsymboltypes

# ILIB\_ExtendLibrarySymbolFunctions.getSupportedSymbolTypes property

获取支持的符号类型

## Signature

```typescript
getSupportedSymbolTypes: () => Promise<Array<ELIB_SymbolType>>;
```
