# LIB\_Classification class

Comprehensive library / library classification index class

## Signature

```typescript
class LIB_Classification
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[createPrimary(libraryUuid, libraryType, primaryClassificationName)](./LIB_Classification.md)||**_(BETA)_** Create a primary classification|
|[createSecondary(libraryUuid, libraryType, primaryClassificationUuid, secondaryClassificationName)](./LIB_Classification.md)||**_(BETA)_** Create a secondary classification|
|[deleteByIndex(classificationIndex)](./LIB_Classification.md)||**_(BETA)_** Delete the classification at the specified index|
|[deleteByUuid(libraryUuid, classificationUuid)](./LIB_Classification.md)||**_(BETA)_** Delete the classification with the specified UUID|
|[getAllClassificationTree(libraryUuid, libraryType)](./LIB_Classification.md)||**_(BETA)_** Get the tree composed of all classification information|
|[getIndexByName(libraryUuid, libraryType, primaryClassificationName, secondaryClassificationName)](./LIB_Classification.md)||**_(BETA)_** Get the classification index of the classification with the specified name|
|[getNameByIndex(classificationIndex)](./LIB_Classification.md)||**_(BETA)_** Get the name of the classification at the specified index|
|[getNameByUuid(libraryUuid, libraryType, primaryClassificationUuid, secondaryClassificationUuid)](./LIB_Classification.md)||**_(BETA)_** Get the name of the classification with the specified UUID|

---

## 方法详情

### createprimary

# LIB\_Classification.createPrimary() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Create a primary classification

## Signature

```typescript
function createPrimary(
	libraryUuid: string,
	libraryType: ELIB_LibraryType,
	primaryClassificationName: string,
): Promise<ILIB_ClassificationIndex | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|libraryType|[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|
|primaryClassificationName|string|Primary classification name|

## Returns

Promise&lt;[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| undefined&gt;

Classification index

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 在个人库的复用模块分类体系中创建一级分类（ELIB_LibraryType.CBB = '1'）
const name = `嘉立创示例_一级分类_${Date.now()}`;
const index = await eda.lib_Classification.createPrimary(libraryUuid, '1', name);

// 创建类保留现场

console.log('libraryUuid:', libraryUuid);
console.log('name:', name);
console.log('primaryClassificationUuid:', index.primaryClassificationUuid);
```


### createsecondary

# LIB\_Classification.createSecondary() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Create a secondary classification

## Signature

```typescript
function createSecondary(
	libraryUuid: string,
	libraryType: ELIB_LibraryType,
	primaryClassificationUuid: string,
	secondaryClassificationName: string,
): Promise<ILIB_ClassificationIndex | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|libraryType|[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|
|primaryClassificationUuid|string|Primary classification UUID|
|secondaryClassificationName|string|Secondary classification name|

## Returns

Promise&lt;[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| undefined&gt;

Classification index

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 先创建一级分类作为父目录（复用已有分类时可用 getIndexByName 查 UUID）
const primaryName = `嘉立创示例_二级演示一级_${Date.now()}`;
const primaryIndex = await eda.lib_Classification.createPrimary(libraryUuid, '1', primaryName);

// 3. 在该一级分类下创建二级分类
const secondaryName = `嘉立创示例_二级分类_${Date.now()}`;
const secondaryIndex = await eda.lib_Classification.createSecondary(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid,
	secondaryName
);

// 创建类保留现场

console.log('primaryName:', primaryName);
console.log('secondaryName:', secondaryName);
console.log('secondaryClassificationUuid:', secondaryIndex.secondaryClassificationUuid);
```


### deletebyindex

# LIB\_Classification.deleteByIndex() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Delete the classification at the specified index

## Signature

```typescript
function deleteByIndex(classificationIndex: ILIB_ClassificationIndex): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|classificationIndex|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md)|Classification index|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建一个测试分类作为删除对象（复用模块库，ELIB_LibraryType.CBB = '1'）
const name = `嘉立创示例_待删除分类_${Date.now()}`;
const index = await eda.lib_Classification.createPrimary(libraryUuid, '1', name);

// 3. 按索引对象删除该分类
const deleted = await eda.lib_Classification.deleteByIndex(index);

// 删除类保留现场（分类已不存在，库面板中可确认）

console.log('name:', name);
console.log('deleted:', deleted);
```


### deletebyuuid

# LIB\_Classification.deleteByUuid() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Delete the classification with the specified UUID

## Signature

```typescript
function deleteByUuid(libraryUuid: string, classificationUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|classificationUuid|string||

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建一个测试分类作为删除对象（复用模块库，ELIB_LibraryType.CBB = '1'）
const name = `嘉立创示例_待删除UUID分类_${Date.now()}`;
const index = await eda.lib_Classification.createPrimary(libraryUuid, '1', name);

// 3. 按分类 UUID 删除
const deleted = await eda.lib_Classification.deleteByUuid(
	libraryUuid,
	index.primaryClassificationUuid
);

// 删除类保留现场（分类已不存在，库面板中可确认）

console.log('name:', name);
console.log('deleted:', deleted);
```


### getallclassificationtree

# LIB\_Classification.getAllClassificationTree() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Get the tree composed of all classification information

## Signature

```typescript
function getAllClassificationTree(
	libraryUuid: string,
	libraryType: ELIB_LibraryType,
): Promise<
	Array<{
		name: string;
		uuid: string;
		children?: Array<{ name: string; uuid: string }> | undefined;
	}>
>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|libraryType|[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|

## Returns

Promise&lt;Array&lt;{ name: string; uuid: string; children?: Array&lt;{ name: string; uuid: string }&gt; \| undefined }&gt;&gt;

Tree structure data composed of classification information

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建一个测试分类，让树里有可见数据（复用模块库，ELIB_LibraryType.CBB = '1'）
const name = `嘉立创示例_树查询_${Date.now()}`;
const index = await eda.lib_Classification.createPrimary(libraryUuid, '1', name);

// 3. 读取完整分类树
const tree = await eda.lib_Classification.getAllClassificationTree(libraryUuid, '1');

// 4. 清理测试分类（查询类需要清理）
await eda.lib_Classification.deleteByUuid(libraryUuid, index.primaryClassificationUuid);

// 5. 输出树结构
console.log('total:', tree.length);
tree.forEach((node, i) => {
	console.log(`[${i}] name:`, node.name, 'uuid:', node.uuid, 'children:', (node.children || []).length);
});
```


### getindexbyname

# LIB\_Classification.getIndexByName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Get the classification index of the classification with the specified name

## Signature

```typescript
function getIndexByName(
	libraryUuid: string,
	libraryType: ELIB_LibraryType,
	primaryClassificationName: string,
	secondaryClassificationName?: string,
): Promise<ILIB_ClassificationIndex | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|libraryType|[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|
|primaryClassificationName|string|Primary classification name|
|secondaryClassificationName|string|_(Optional)_ Secondary classification name|

## Returns

Promise&lt;[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| undefined&gt;

Classification index

## Remarks

The classification index contains the UUID of the classification. For details, refer to [ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md)

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建两级测试分类（复用模块库，ELIB_LibraryType.CBB = '1'）
const tag = Date.now();
const primaryName = `嘉立创示例_按名索引一级_${tag}`;
const secondaryName = `嘉立创示例_按名索引二级_${tag}`;
const primaryIndex = await eda.lib_Classification.createPrimary(libraryUuid, '1', primaryName);
await eda.lib_Classification.createSecondary(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid,
	secondaryName
);

// 3. 只按一级名称查索引
const primaryOnly = await eda.lib_Classification.getIndexByName(libraryUuid, '1', primaryName);

// 4. 按一级 + 二级名称查索引（secondaryClassificationName 可选）
const withSecondary = await eda.lib_Classification.getIndexByName(
	libraryUuid,
	'1',
	primaryName,
	secondaryName
);

// 5. 清理测试分类（查询类需要清理）
await eda.lib_Classification.deleteByUuid(libraryUuid, primaryIndex.primaryClassificationUuid);

console.log('primaryOnly.primaryClassificationUuid:', primaryOnly.primaryClassificationUuid);
console.log('withSecondary.secondaryClassificationUuid:', withSecondary.secondaryClassificationUuid);
```


### getnamebyindex

# LIB\_Classification.getNameByIndex() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Get the name of the classification at the specified index

## Signature

```typescript
function getNameByIndex(
	classificationIndex: ILIB_ClassificationIndex,
): Promise<
	| { primaryClassificationName: string; secondaryClassificationName?: string | undefined }
	| undefined
>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|classificationIndex|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md)|Classification index|

## Returns

Promise&lt;{ primaryClassificationName: string; secondaryClassificationName?: string \| undefined } \| undefined&gt;

Name of the two-level classification

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建两级测试分类，拿到两个索引对象（复用模块库）
const tag = Date.now();
const primaryName = `嘉立创示例_按索引查名一级_${tag}`;
const secondaryName = `嘉立创示例_按索引查名二级_${tag}`;
const primaryIndex = await eda.lib_Classification.createPrimary(libraryUuid, '1', primaryName);
const secondaryIndex = await eda.lib_Classification.createSecondary(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid,
	secondaryName
);

// 3. 分别解析一级索引、二级索引的名称
const primaryNames = await eda.lib_Classification.getNameByIndex(primaryIndex);
const secondaryNames = await eda.lib_Classification.getNameByIndex(secondaryIndex);

// 4. 清理测试分类（查询类需要清理）
await eda.lib_Classification.deleteByUuid(libraryUuid, primaryIndex.primaryClassificationUuid);

console.log('primaryNames:', primaryNames);
console.log('secondaryNames:', secondaryNames);
```


### getnamebyuuid

# LIB\_Classification.getNameByUuid() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

> Warning: This API is now obsolete.
>
> since EDA v3.2; dropped EDA v3.3

Get the name of the classification with the specified UUID

## Signature

```typescript
function getNameByUuid(
	libraryUuid: string,
	libraryType: ELIB_LibraryType,
	primaryClassificationUuid: string,
	secondaryClassificationUuid?: string,
): Promise<
	| { primaryClassificationName: string; secondaryClassificationName?: string | undefined }
	| undefined
>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID|
|libraryType|[ELIB\_LibraryType](../enums/ELIB_LibraryType.md)|Library type|
|primaryClassificationUuid|string|Primary classification UUID|
|secondaryClassificationUuid|string|_(Optional)_ Secondary classification UUID. If not specified, only the primary classification information is obtained|

## Returns

Promise&lt;{ primaryClassificationName: string; secondaryClassificationName?: string \| undefined } \| undefined&gt;

Name of the two-level classification

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建两级测试分类（复用模块库，ELIB_LibraryType.CBB = '1'）
const tag = Date.now();
const primaryName = `嘉立创示例_按UUID查名一级_${tag}`;
const secondaryName = `嘉立创示例_按UUID查名二级_${tag}`;
const primaryIndex = await eda.lib_Classification.createPrimary(libraryUuid, '1', primaryName);
const secondaryIndex = await eda.lib_Classification.createSecondary(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid,
	secondaryName
);

// 3. 只传一级 UUID：返回一级名称
const primaryNames = await eda.lib_Classification.getNameByUuid(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid
);

// 4. 传一级 + 二级 UUID：两级名称都返回
const bothNames = await eda.lib_Classification.getNameByUuid(
	libraryUuid,
	'1',
	primaryIndex.primaryClassificationUuid,
	secondaryIndex.secondaryClassificationUuid
);

// 5. 清理测试分类（查询类需要清理）
await eda.lib_Classification.deleteByUuid(libraryUuid, primaryIndex.primaryClassificationUuid);

console.log('primaryNames:', primaryNames);
console.log('bothNames:', bothNames);
```
