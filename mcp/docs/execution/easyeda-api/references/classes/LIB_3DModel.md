# LIB\_3DModel class

Comprehensive library / 3D model class

## Signature

```typescript
class LIB_3DModel
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[copy(modelUuid, libraryUuid, targetLibraryUuid, targetClassification, newModelName)](./LIB_3DModel.md)||**_(BETA)_** Copy 3D model|
|[create(libraryUuid, modelFile, classification, unit)](./LIB_3DModel.md)||**_(BETA)_** Create 3D model|
|[delete(modelUuid, libraryUuid)](./LIB_3DModel.md)||**_(BETA)_** Delete 3D model|
|[get(modelUuid, libraryUuid)](./LIB_3DModel.md)||**_(BETA)_** Get all properties of the 3D model|
|[modify(modelUuid, libraryUuid, modelName, classification, description)](./LIB_3DModel.md)||**_(BETA)_** Modify 3D model|
|[search(key, libraryUuid, classification, itemsOfPage, page)](./LIB_3DModel.md)||**_(BETA)_** Search 3D model|

---

## 方法详情

### copy

# LIB\_3DModel.copy() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Copy 3D model

## Signature

```typescript
function copy(
	modelUuid: string,
	libraryUuid: string,
	targetLibraryUuid: string,
	targetClassification?: ILIB_ClassificationIndex | Array<string>,
	newModelName?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|modelUuid|string|3D model UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|targetLibraryUuid|string|Target library UUID|
|targetClassification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification in the target library|
|newModelName|string|_(Optional)_ New 3D model name. If a 3D model with the same name exists in the target library, the copy will fail|

## Returns

Promise&lt;string \| undefined&gt;

UUID of the new 3D model in the target library

## Example

```javascript
// 1. 获取个人库 UUID（复制目标库）
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 从系统库找一个 3D 模型作为复制来源
const results = await eda.lib_3DModel.search('0402', undefined, undefined, 1);
const source = results[0];

// 3. 复制到个人库，指定新名称避免同名冲突
const newName = `CopyOf_${source.name}_${Date.now()}`;
const copiedUuid = await eda.lib_3DModel.copy(
	source.uuid,
	source.libraryUuid,
	libraryUuid,
	undefined,
	newName
);

// 创建类保留现场

console.log('source:', source.name, source.uuid);
console.log('copiedUuid:', copiedUuid);
console.log('newName:', newName);
```


### create

# LIB\_3DModel.create() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create 3D model

## Signature

```typescript
function create(
	libraryUuid: string,
	modelFile: Blob,
	classification?: ILIB_ClassificationIndex | Array<string>,
	unit?:
		| ESYS_Unit.MILLIMETER
		| ESYS_Unit.CENTIMETER
		| ESYS_Unit.METER
		| ESYS_Unit.MIL
		| ESYS_Unit.INCH,
): Promise<Array<string> | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|modelFile|Blob|3D model file data|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|unit|[ESYS\_Unit.MILLIMETER](../enums/ESYS_Unit.md) \| [ESYS\_Unit.CENTIMETER](../enums/ESYS_Unit.md) \| [ESYS\_Unit.METER](../enums/ESYS_Unit.md) \| [ESYS\_Unit.MIL](../enums/ESYS_Unit.md) \| [ESYS\_Unit.INCH](../enums/ESYS_Unit.md)|_(Optional)_ Unit|

## Returns

Promise&lt;Array&lt;string&gt; \| undefined&gt;

UUIDs of all created 3D models

## Remarks

The passed-in `modelFile` can be an archive of multiple model files. EDA will automatically extract the multiple models

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 构造一个单面片的 ASCII STL 模型文件
const stl = [
	'solid example',
	'facet normal 0 0 1',
	'outer loop',
	'vertex 0 0 0',
	'vertex 10 0 0',
	'vertex 0 10 0',
	'endloop',
	'endfacet',
	'endsolid example',
].join('\n');
const blob = new Blob([stl], { type: 'model/stl' });

// 3. 导入到个人库，模型单位为毫米
const modelUuids = await eda.lib_3DModel.create(libraryUuid, blob, [], 'mm');

// 创建类保留现场

console.log('libraryUuid:', libraryUuid);
console.log('created:', modelUuids ? modelUuids.length : 0);
```


### delete

# LIB\_3DModel.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete 3D model

## Signature

```typescript
function delete(modelUuid: string, libraryUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|modelUuid|string|3D model UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 复制一个系统库模型到个人库作为删除对象
const results = await eda.lib_3DModel.search('0402', undefined, undefined, 1);
const source = results[0];
const copiedUuid = await eda.lib_3DModel.copy(
	source.uuid,
	source.libraryUuid,
	libraryUuid,
	undefined,
	`ToDelete_${Date.now()}`
);

// 3. 删除复制品
const deleted = await eda.lib_3DModel.delete(copiedUuid, libraryUuid);

console.log('copiedUuid:', copiedUuid);
console.log('deleted:', deleted);
```


### get

# LIB\_3DModel.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all properties of the 3D model

## Signature

```typescript
function get(modelUuid: string, libraryUuid?: string): Promise<ILIB_3DModelItem | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|modelUuid|string|3D model UUID|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;[ILIB\_3DModelItem](../interfaces/ILIB_3DModelItem.md) \| undefined&gt;

3D model property

### modify

# LIB\_3DModel.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify 3D model

## Signature

```typescript
function modify(
	modelUuid: string,
	libraryUuid: string,
	modelName?: string,
	classification?: ILIB_ClassificationIndex | Array<string> | null,
	description?: string | null,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|modelUuid|string|3D model UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|modelName|string|_(Optional)_ 3D model name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt; \| null|_(Optional)_ Classification|
|description|string \| null|_(Optional)_ Description|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

If you want to clear certain properties, set their values to `null`

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 复制一个系统库模型到个人库作为修改对象
const results = await eda.lib_3DModel.search('0402', undefined, undefined, 1);
const source = results[0];
const copiedUuid = await eda.lib_3DModel.copy(
	source.uuid,
	source.libraryUuid,
	libraryUuid,
	undefined,
	`ToModify_${Date.now()}`
);

// 3. 修改名称和描述（classification 保持不变传 []）
const modifiedName = `Renamed_${Date.now()}`;
const modified = await eda.lib_3DModel.modify(
	copiedUuid,
	libraryUuid,
	modifiedName,
	[],
	'3D model example'
);

// 修改类保留现场

console.log('copiedUuid:', copiedUuid);
console.log('modified:', modified);
console.log('newName:', modifiedName);
```


### search

# LIB\_3DModel.search() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search 3D model

## Signature

```typescript
function search(
	key: string,
	libraryUuid?: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	itemsOfPage?: number,
	page?: number,
): Promise<Array<ILIB_3DModelSearchItem>>;
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

Promise&lt;Array&lt;[ILIB\_3DModelSearchItem](../interfaces/ILIB_3DModelSearchItem.md)<!-- -->&gt;&gt;

List of searched 3D model properties

## Example

```javascript
// 1. 按关键字搜索系统库中的 3D 模型，每页 5 条
const results = await eda.lib_3DModel.search('0402', undefined, undefined, 5);

// 2. 输出搜索结果
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'libraryUuid:', item.libraryUuid);
});
```
