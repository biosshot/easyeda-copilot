# LIB\_PanelLibrary class

Comprehensive library / panel library class

## Signature

```typescript
class LIB_PanelLibrary
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[copy(panelLibraryUuid, libraryUuid, targetLibraryUuid, targetClassification, newPanelLibraryName)](./LIB_PanelLibrary.md)||**_(BETA)_** Copy Panel library|
|[create(libraryUuid, panelLibraryName, classification, description)](./LIB_PanelLibrary.md)||**_(BETA)_** Create Panel library|
|[delete(panelLibraryUuid, libraryUuid)](./LIB_PanelLibrary.md)||**_(BETA)_** Delete Panel library|
|[get(panelLibraryUuid, libraryUuid)](./LIB_PanelLibrary.md)||**_(BETA)_** Get all properties of the panel library|
|[modify(panelLibraryUuid, libraryUuid, panelLibraryName, classification, description)](./LIB_PanelLibrary.md)||**_(BETA)_** Modify Panel library|
|[openInEditor(panelLibraryUuid, libraryUuid, splitScreenId)](./LIB_PanelLibrary.md)||**_(BETA)_** Open in the editor document|
|[search(key, libraryUuid, classification, itemsOfPage, page)](./LIB_PanelLibrary.md)||**_(BETA)_** Search panel library|

---

## 方法详情

### copy

# LIB\_PanelLibrary.copy() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Copy Panel library

## Signature

```typescript
function copy(
	panelLibraryUuid: string,
	libraryUuid: string,
	targetLibraryUuid: string,
	targetClassification?: ILIB_ClassificationIndex | Array<string>,
	newPanelLibraryName?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|panelLibraryUuid|string|Panel library UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|targetLibraryUuid|string|Target library UUID|
|targetClassification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification in the target library|
|newPanelLibraryName|string|_(Optional)_ New panel library name. If a panel library with the same name exists in the target library, the copy will fail|

## Returns

Promise&lt;string \| undefined&gt;

UUID of the new panel library in the target library

## Example

```javascript
// 1. 搜索系统库，取一个面板库作为复制来源
const [source] = await eda.lib_PanelLibrary.search('', undefined, undefined, 1, 1);

// 2. 获取个人库 UUID
const targetLibraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 3. 从系统库复制到个人库，指定新名称避免同名冲突（分类传 [] = 不分类）
const newName = `嘉立创示例_面板库副本_${Date.now()}`;
const copiedUuid = await eda.lib_PanelLibrary.copy(
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

# LIB\_PanelLibrary.create() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Panel library

## Signature

```typescript
function create(
	libraryUuid: string,
	panelLibraryName: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	description?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|panelLibraryName|string|Panel library name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|description|string|_(Optional)_ Description|

## Returns

Promise&lt;string \| undefined&gt;

Panel library UUID

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建面板库（分类传 [] = 不分类）
const panelLibraryName = `嘉立创示例_新面板库_${Date.now()}`;
const panelLibraryUuid = await eda.lib_PanelLibrary.create(libraryUuid, panelLibraryName, [], '示例面板库描述');

// 创建类保留现场（新面板库留在个人库中供观察）

console.log('panelLibraryUuid:', panelLibraryUuid);
console.log('panelLibraryName:', panelLibraryName);
```


### delete

# LIB\_PanelLibrary.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Panel library

## Signature

```typescript
function delete(panelLibraryUuid: string, libraryUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|panelLibraryUuid|string|Panel library UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID 并新建删除对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const panelLibraryUuid = await eda.lib_PanelLibrary.create(
	libraryUuid,
	`嘉立创示例_待删除面板库_${Date.now()}`,
	[]
);

// 2. 删除该面板库
const deleted = await eda.lib_PanelLibrary.delete(panelLibraryUuid, libraryUuid);

console.log('panelLibraryUuid:', panelLibraryUuid);
console.log('deleted:', deleted);
```


### get

# LIB\_PanelLibrary.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all properties of the panel library

## Signature

```typescript
function get(
	panelLibraryUuid: string,
	libraryUuid?: string,
): Promise<ILIB_PanelLibraryItem | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|panelLibraryUuid|string|Panel library UUID|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;[ILIB\_PanelLibraryItem](../interfaces/ILIB_PanelLibraryItem.md) \| undefined&gt;

Panel library property

### modify

# LIB\_PanelLibrary.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Panel library

## Signature

```typescript
function modify(
	panelLibraryUuid: string,
	libraryUuid: string,
	panelLibraryName?: string,
	classification?: ILIB_ClassificationIndex | Array<string> | null,
	description?: string | null,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|panelLibraryUuid|string|Panel library UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|panelLibraryName|string|_(Optional)_ Panel library name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt; \| null|_(Optional)_ Classification|
|description|string \| null|_(Optional)_ Description|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

If you want to clear certain properties, set their values to `null`

## Example

```javascript
// 1. 获取个人库 UUID 并新建修改对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const panelLibraryUuid = await eda.lib_PanelLibrary.create(
	libraryUuid,
	`嘉立创示例_面板库修改前_${Date.now()}`,
	[],
	'修改前的描述'
);

// 2. 修改名称和描述（分类保持不变传 []）
const newName = `嘉立创示例_面板库修改后_${Date.now()}`;
const modified = await eda.lib_PanelLibrary.modify(panelLibraryUuid, libraryUuid, newName, [], '修改后的描述');

// 修改类保留现场

console.log('panelLibraryUuid:', panelLibraryUuid);
console.log('modified:', modified);
console.log('newName:', newName);
```


### openineditor

# LIB\_PanelLibrary.openInEditor() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Open in the editor document

## Signature

```typescript
function openInEditor(
	panelLibraryUuid: string,
	libraryUuid: string,
	splitScreenId?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|panelLibraryUuid|string|Panel library UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|splitScreenId|string|_(Optional)_ Split screen ID. If not filled in, it opens in the split screen with the last input focus by default. It can be obtained using the APIs in [DMT\_EditorControl](./DMT_EditorControl.md)|

## Returns

Promise&lt;string \| undefined&gt;

Tab ID, corresponding to [IDMT\_EditorTabItem.tabId](../interfaces/IDMT_EditorTabItem.md)<!-- -->. You can use [DMT\_EditorControl.getSplitScreenIdByTabId()](./DMT_EditorControl.md) to get the split screen ID

## Example

```javascript
// 1. 获取个人库 UUID 并新建面板库
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const panelLibraryUuid = await eda.lib_PanelLibrary.create(
	libraryUuid,
	`嘉立创示例_编辑面板库_${Date.now()}`,
	[]
);

// 2. 在编辑器中打开该面板库，返回标签页 ID（uuid@libraryUuid 格式）
const tabId = await eda.lib_PanelLibrary.openInEditor(panelLibraryUuid, libraryUuid);

// 打开后保留现场（编辑器停留在新面板库页供观察；不需要时可传 tabId 给
// dmt_EditorControl.closeDocument 关闭）

console.log('panelLibraryUuid:', panelLibraryUuid);
console.log('tabId:', tabId);
```


### search

# LIB\_PanelLibrary.search() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search panel library

## Signature

```typescript
function search(
	key: string,
	libraryUuid?: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	itemsOfPage?: number,
	page?: number,
): Promise<Array<ILIB_PanelLibrarySearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|key|string|Search keyword|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification, defaults to all|
|itemsOfPage|number|_(Optional)_ Number of search results per page|
|page|number|_(Optional)_ Page count|

## Returns

Promise&lt;Array&lt;[ILIB\_PanelLibrarySearchItem](../interfaces/ILIB_PanelLibrarySearchItem.md)<!-- -->&gt;&gt;

List of searched panel library properties

## Example

```javascript
// 1. 按空关键字列出系统库中的面板库，每页 5 条（换成 '三角' 等关键字即为按名称过滤）
const results = await eda.lib_PanelLibrary.search('', undefined, undefined, 5, 1);

// 2. 输出搜索结果
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'libraryUuid:', item.libraryUuid);
});
```
