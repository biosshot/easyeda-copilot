# LIB\_Symbol class

Comprehensive library / symbol class

## Signature

```typescript
class LIB_Symbol
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[copy(symbolUuid, libraryUuid, targetLibraryUuid, targetClassification, newSymbolName)](./LIB_Symbol.md)||**_(BETA)_** Copy Symbol|
|[create(libraryUuid, symbolName, classification, symbolType, description, otherProperty)](./LIB_Symbol.md)||**_(BETA)_** Create Symbol|
|[delete(symbolUuid, libraryUuid)](./LIB_Symbol.md)||**_(BETA)_** Delete Symbol|
|[get(symbolUuid, libraryUuid)](./LIB_Symbol.md)||**_(BETA)_** Get all properties of the symbol|
|[getRenderImage(source)](./LIB_Symbol.md)||**_(BETA)_** Get the symbol render image|
|[modify(symbolUuid, libraryUuid, symbolName, classification, description, otherProperty)](./LIB_Symbol.md)||**_(BETA)_** Modify Symbol|
|[openInEditor(symbolUuid, libraryUuid, splitScreenId)](./LIB_Symbol.md)||**_(BETA)_** Open in the editor document|
|[search(key, libraryUuid, classification, symbolType, itemsOfPage, page)](./LIB_Symbol.md)||**_(BETA)_** Search symbol|
|[searchByProperties(properties, libraryUuid)](./LIB_Symbol.md)||**_(BETA)_** Search symbols precisely by properties|
|[updateDocumentSource(symbolUuid, libraryUuid, documentSource)](./LIB_Symbol.md)||**_(BETA)_** Update the document source code of the symbol|

---

## 方法详情

### copy

# LIB\_Symbol.copy() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Copy Symbol

## Signature

```typescript
function copy(
	symbolUuid: string,
	libraryUuid: string,
	targetLibraryUuid: string,
	targetClassification?: ILIB_ClassificationIndex | Array<string>,
	newSymbolName?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|targetLibraryUuid|string|Target library UUID|
|targetClassification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification in the target library|
|newSymbolName|string|_(Optional)_ New symbol name. If a symbol with the same name exists in the target library, the copy will fail|

## Returns

Promise&lt;string \| undefined&gt;

UUID of the new symbol in the target library

## Example

```javascript
// 1. 列出系统库符号（关键字传空 = 列出全部），取一个作为复制来源
const [source] = await eda.lib_Symbol.search('', undefined, [], undefined, 1, 1);

// 2. 获取个人库 UUID
const targetLibraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 3. 从系统库复制到个人库，指定新名称避免同名冲突（分类传 [] = 不分类）
const newName = `嘉立创示例_符号副本_${Date.now()}`;
const copiedUuid = await eda.lib_Symbol.copy(
	source.uuid,
	source.libraryUuid,
	targetLibraryUuid,
	[],
	newName
);

// 创建类保留现场（副本留在个人库中供观察）

console.log('sourceUuid:', source.uuid);
console.log('copiedUuid:', copiedUuid);
console.log('newName:', newName);
```


### create

# LIB\_Symbol.create() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Symbol

## Signature

```typescript
function create(
	libraryUuid: string,
	symbolName: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	symbolType?: ELIB_SymbolType,
	description?: string,
	otherProperty?: Record<string, boolean | number | string | undefined>,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|symbolName|string|Symbol name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|symbolType|[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|_(Optional)_ Symbol type|
|description|string|_(Optional)_ Description|
|otherProperty|Record&lt;string, boolean \| number \| string \| undefined&gt;|_(Optional)_ 其它属性|

## Returns

Promise&lt;string \| undefined&gt;

Symbol UUID

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建符号（分类传 [] = 不分类；符号类型 '1' = 原理图符号，见 ELIB_SymbolType）
const symbolName = `嘉立创示例_新符号_${Date.now()}`;
const symbolUuid = await eda.lib_Symbol.create(libraryUuid, symbolName, [], '1', '示例符号描述');

// 创建类保留现场（新符号留在个人库中供观察）

console.log('symbolUuid:', symbolUuid);
console.log('symbolName:', symbolName);
```


### delete

# LIB\_Symbol.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Symbol

## Signature

```typescript
function delete(symbolUuid: string, libraryUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID 并新建删除对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const symbolUuid = await eda.lib_Symbol.create(libraryUuid, `嘉立创示例_待删除符号_${Date.now()}`, []);

// 2. 删除该符号
const deleted = await eda.lib_Symbol.delete(symbolUuid, libraryUuid);

console.log('symbolUuid:', symbolUuid);
console.log('deleted:', deleted);
```


### get

# LIB\_Symbol.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all properties of the symbol

## Signature

```typescript
function get(symbolUuid: string, libraryUuid?: string): Promise<ILIB_SymbolItem | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;[ILIB\_SymbolItem](../interfaces/ILIB_SymbolItem.md) \| undefined&gt;

Symbol property

### getrenderimage

# LIB\_Symbol.getRenderImage() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the symbol render image

## Signature

```typescript
function getRenderImage(source: {
	symbolUuid: string;
	libraryUuid: string;
	subPartName?: string;
}): Promise<Blob | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|source|\{ symbolUuid: string; libraryUuid: string; subPartName?: string \}||

## Returns

Promise&lt;Blob \| undefined&gt;

Symbol render image

## Example

```javascript
// 1. 列出系统库符号，取一个作为渲染来源
const [source] = await eda.lib_Symbol.search('', undefined, [], undefined, 1, 1);

// 2. 获取渲染图（PNG Blob）
const blob = await eda.lib_Symbol.getRenderImage({
	symbolUuid: source.uuid,
	libraryUuid: source.libraryUuid,
});

// 3. Blob 可转成 URL 直接展示：URL.createObjectURL(blob)
console.log('sourceName:', source.name);
console.log('imageSize:', blob.size);
console.log('imageType:', blob.type);
```


### modify

# LIB\_Symbol.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Symbol

## Signature

```typescript
function modify(
	symbolUuid: string,
	libraryUuid: string,
	symbolName?: string,
	classification?: ILIB_ClassificationIndex | Array<string> | null,
	description?: string | null,
	otherProperty?: Record<string, boolean | number | string | undefined | null>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|symbolName|string|_(Optional)_ Symbol name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt; \| null|_(Optional)_ Classification|
|description|string \| null|_(Optional)_ Description|
|otherProperty|Record&lt;string, boolean \| number \| string \| undefined \| null&gt;|_(Optional)_ 其它属性，如希望清除某些属性，则将其的值设置为 `null`|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

If you want to clear certain properties, set their values to `null`

## Example

```javascript
// 1. 获取个人库 UUID 并新建修改对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const symbolUuid = await eda.lib_Symbol.create(
	libraryUuid,
	`嘉立创示例_符号修改前_${Date.now()}`,
	[],
	'1',
	'修改前的描述'
);

// 2. 修改名称和描述（分类保持不变传 []）
const newName = `嘉立创示例_符号修改后_${Date.now()}`;
const modified = await eda.lib_Symbol.modify(symbolUuid, libraryUuid, newName, [], '修改后的描述');

// 修改类保留现场

console.log('symbolUuid:', symbolUuid);
console.log('modified:', modified);
console.log('newName:', newName);
```


### openineditor

# LIB\_Symbol.openInEditor() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Open in the editor document

## Signature

```typescript
function openInEditor(
	symbolUuid: string,
	libraryUuid: string,
	splitScreenId?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|splitScreenId|string|_(Optional)_ Split screen ID. If not filled in, it opens in the split screen with the last input focus by default. It can be obtained using the APIs in [DMT\_EditorControl](./DMT_EditorControl.md)|

## Returns

Promise&lt;string \| undefined&gt;

Tab ID, corresponding to [IDMT\_EditorTabItem.tabId](../interfaces/IDMT_EditorTabItem.md)<!-- -->. You can use [DMT\_EditorControl.getSplitScreenIdByTabId()](./DMT_EditorControl.md) to get the split screen ID

## Example

```javascript
// 1. 获取个人库 UUID，从系统库复制一个符号作为编辑对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const [source] = await eda.lib_Symbol.search('', undefined, [], undefined, 1, 1);
const symbolUuid = await eda.lib_Symbol.copy(
	source.uuid,
	source.libraryUuid,
	libraryUuid,
	[],
	`嘉立创示例_编辑符号_${Date.now()}`
);

// 2. 在编辑器中打开该符号，返回标签页 ID（uuid@libraryUuid 格式）
const tabId = await eda.lib_Symbol.openInEditor(symbolUuid, libraryUuid);

// 打开后保留现场（编辑器停留在新符号页供观察；不需要时可传 tabId 给
// dmt_EditorControl.closeDocument 关闭）

console.log('symbolUuid:', symbolUuid);
console.log('tabId:', tabId);
```


### search

# LIB\_Symbol.search() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search symbol

## Signature

```typescript
function search(
	key: string,
	libraryUuid?: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	symbolType?: ELIB_SymbolType,
	itemsOfPage?: number,
	page?: number,
): Promise<Array<ILIB_SymbolSearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|key|string|Search keyword|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification, defaults to all|
|symbolType|[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|_(Optional)_ Symbol type, defaults to all|
|itemsOfPage|number|_(Optional)_ Number of search results per page|
|page|number|_(Optional)_ Page count|

## Returns

Promise&lt;Array&lt;[ILIB\_SymbolSearchItem](../interfaces/ILIB_SymbolSearchItem.md)<!-- -->&gt;&gt;

List of searched symbol properties

## Example

```javascript
// 1. 尝试按关键字搜索（当前版本非空关键字会抛错，如实展示）
try {
	const keywordResults = await eda.lib_Symbol.search('0402');
	console.log('关键字搜索返回', keywordResults.length, '条');
}
catch (e) {
	// 剥掉错误类型前缀；注意：正则写法尾部会产生星号+斜杠序列，会闭掉 tsdoc 注释，故用 split
	console.log('关键字搜索当前版本抛错：', String(e.message).split('Error: ').pop());
}

// 2. 改用空关键字列出系统库符号，每页 5 条
const results = await eda.lib_Symbol.search('', undefined, [], undefined, 5, 1);

// 3. 输出搜索结果（需要过滤时可按 item.name 自行筛选）
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'libraryUuid:', item.libraryUuid);
});
```


### searchbyproperties

# LIB\_Symbol.searchByProperties() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search symbols precisely by properties

## Signature

```typescript
function searchByProperties(
	properties: ILIB_SymbolPropertiesForSearch,
	libraryUuid?: string,
): Promise<Array<ILIB_SymbolSearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|properties|[ILIB\_SymbolPropertiesForSearch](../interfaces/ILIB_SymbolPropertiesForSearch.md)|Property|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;Array&lt;[ILIB\_SymbolSearchItem](../interfaces/ILIB_SymbolSearchItem.md)<!-- -->&gt;&gt;

List of searched symbol properties

## Example

```javascript
// 1. 按名称精确搜索（官方属性集合目前仅支持 name）
// 当前版本该接口不稳定：可能抛错，也可能正常返回 undefined，两种都要兼容
let results;
try {
	results = await eda.lib_Symbol.searchByProperties({ name: '0402' });
}
catch (e) {
	console.log('当前版本按 name 搜索抛错：', e.message);
}
if (!Array.isArray(results))
	results = [];

// 2. 输出搜索结果
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'libraryUuid:', item.libraryUuid);
});
```


### updatedocumentsource

# LIB\_Symbol.updateDocumentSource() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Update the document source code of the symbol

## Signature

```typescript
function updateDocumentSource(
	symbolUuid: string,
	libraryUuid: string,
	documentSource: string,
): Promise<boolean | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|symbolUuid|string|Symbol UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|documentSource|string|Document source code|

## Returns

Promise&lt;boolean \| undefined&gt;

Whether the update is successful

## Example

```javascript
// 1. 获取个人库 UUID，从系统库复制一个符号（有内容，源码链路才完整）
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const [source] = await eda.lib_Symbol.search('', undefined, [], undefined, 1, 1);
const symbolUuid = await eda.lib_Symbol.copy(
	source.uuid,
	source.libraryUuid,
	libraryUuid,
	[],
	`嘉立创示例_源码符号_${Date.now()}`
);

// 2. 在编辑器中打开符号，等待文档加载完成
const tabId = await eda.lib_Symbol.openInEditor(symbolUuid, libraryUuid);
await new Promise(r => setTimeout(r, 1500));

// 3. 读取当前打开符号的文档源码
const documentSource = await eda.sys_FileManager.getDocumentSource();

// 4. 把源码写回库中的符号（此处原样写回；实际使用时可先改写 documentSource）
const updated = await eda.lib_Symbol.updateDocumentSource(symbolUuid, libraryUuid, documentSource);

// 5. 关闭编辑器标签页（符号本体保留在库中）
await eda.dmt_EditorControl.closeDocument(tabId);

// 修改类保留现场

console.log('symbolUuid:', symbolUuid);
console.log('sourceLength:', documentSource.length);
console.log('updated:', updated);
```
