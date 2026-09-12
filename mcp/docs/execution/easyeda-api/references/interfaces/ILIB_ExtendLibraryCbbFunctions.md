# ILIB\_ExtendLibraryCbbFunctions interface

External library reuse block functions

## Signature

```typescript
interface ILIB_ExtendLibraryCbbFunctions extends ILIB_ExtendLibraryFunctions
```
**Extends:** [ILIB\_ExtendLibraryFunctions](./ILIB_ExtendLibraryFunctions.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[getList](./ILIB_ExtendLibraryCbbFunctions.md)||(props: any) =&gt; Promise&lt;[ILIB\_ExtendLibrarySearchResult](./ILIB_ExtendLibrarySearchResult.md)<!-- -->&lt;[ILIB\_ExtendLibraryItem](./ILIB_ExtendLibraryItem.md) &amp; [ILIB\_ExtendLibrarySearchResultDataLine](./ILIB_ExtendLibrarySearchResultDataLine.md) &amp; { schematics?: Array&lt;{ uuid: string; name: string; updateTime: string; description?: string }&gt;; pcbs?: Array&lt;{ uuid: string; name: string; updateTime: number; thumb?: string; createTime?: number; creator?: [ILIB\_ExtendLibraryUserIndex](./ILIB_ExtendLibraryUserIndex.md)<!-- -->; modifier?: [ILIB\_ExtendLibraryUserIndex](./ILIB_ExtendLibraryUserIndex.md)<!-- -->; description?: string }&gt;; boards?: Array&lt;{ pcbUuid: string; schUuid: string; name: string }&gt;; sheets?: Array&lt;{ uuid: string; name: string; belongSchematicUuid: string; updateTime: number; thumb?: string; createTime?: number; creator?: [ILIB\_ExtendLibraryUserIndex](./ILIB_ExtendLibraryUserIndex.md)<!-- -->; modifier?: [ILIB\_ExtendLibraryUserIndex](./ILIB_ExtendLibraryUserIndex.md)<!-- -->; description?: string }&gt; }&gt;&gt;||

---

## 属性详情

### getlist

# ILIB\_ExtendLibraryCbbFunctions.getList property

## Signature

```typescript
getList: (props: any) =>
	Promise<
		ILIB_ExtendLibrarySearchResult<
			ILIB_ExtendLibraryItem
			& ILIB_ExtendLibrarySearchResultDataLine & {
				schematics?: Array<{
					uuid: string;
					name: string;
					updateTime: string;
					description?: string;
				}>;
				pcbs?: Array<{
					uuid: string;
					name: string;
					updateTime: number;
					thumb?: string;
					createTime?: number;
					creator?: ILIB_ExtendLibraryUserIndex;
					modifier?: ILIB_ExtendLibraryUserIndex;
					description?: string;
				}>;
				boards?: Array<{ pcbUuid: string; schUuid: string; name: string }>;
				sheets?: Array<{
					uuid: string;
					name: string;
					belongSchematicUuid: string;
					updateTime: number;
					thumb?: string;
					createTime?: number;
					creator?: ILIB_ExtendLibraryUserIndex;
					modifier?: ILIB_ExtendLibraryUserIndex;
					description?: string;
				}>;
			}
		>
	>;
```
