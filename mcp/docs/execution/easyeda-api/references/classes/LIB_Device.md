# LIB\_Device class

Comprehensive library / device class

## Signature

```typescript
class LIB_Device
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[copy(deviceUuid, libraryUuid, targetLibraryUuid, targetClassification, newDeviceName)](./LIB_Device.md)||**_(BETA)_** Copy Device|
|[create(libraryUuid, deviceName, classification, association, description, property)](./LIB_Device.md)||**_(BETA)_** Create Device|
|[delete(deviceUuid, libraryUuid)](./LIB_Device.md)||**_(BETA)_** Delete Device|
|[get(deviceUuid, libraryUuid)](./LIB_Device.md)||**_(BETA)_** Get all properties of the device|
|[getByLcscIds(lcscIds, libraryUuid, allowMultiMatch)](./LIB_Device.md)||**_(BETA)_** Get a device using an LCSC C number|
|[getByLcscIds(lcscIds, libraryUuid, allowMultiMatch)](./LIB_Device.md)||**_(BETA)_** Batch get devices using LCSC C numbers|
|[modify(deviceUuid, libraryUuid, deviceName, classification, association, description, property)](./LIB_Device.md)||**_(BETA)_** Modify Device|
|[search(key, libraryUuid, classification, symbolType, itemsOfPage, page)](./LIB_Device.md)||**_(BETA)_** Search device|
|[searchByProperties(properties, libraryUuid, classification, symbolType, itemsOfPage, page)](./LIB_Device.md)||**_(BETA)_** Search devices precisely by properties|

---

## 方法详情

### copy

# LIB\_Device.copy() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Copy Device

## Signature

```typescript
function copy(
	deviceUuid: string,
	libraryUuid: string,
	targetLibraryUuid: string,
	targetClassification?: ILIB_ClassificationIndex | Array<string>,
	newDeviceName?: string,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|deviceUuid|string|Device UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|targetLibraryUuid|string|Target library UUID|
|targetClassification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification in the target library|
|newDeviceName|string|_(Optional)_ New device name. If a device with the same name exists in the target library, the copy will fail|

## Returns

Promise&lt;string \| undefined&gt;

UUID of the new device in the target library

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 新建一个轻量器件作为复制来源
const sourceName = `嘉立创示例_复制源_${Date.now()}`;
const sourceUuid = await eda.lib_Device.create(libraryUuid, sourceName, [], { symbolType: 2 });

// 3. 复制到同一库，指定新名称避免同名冲突（分类传 [] = 不分类）
const newName = `嘉立创示例_复制品_${Date.now()}`;
const copiedUuid = await eda.lib_Device.copy(sourceUuid, libraryUuid, libraryUuid, [], newName);

// 创建类保留现场（原件与复制品都留在个人库中供观察）

console.log('sourceUuid:', sourceUuid);
console.log('copiedUuid:', copiedUuid);
console.log('newName:', newName);
```


### create

# LIB\_Device.create() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Device

## Signature

```typescript
function create(
	libraryUuid: string,
	deviceName: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	association?: {
		symbolType?: ELIB_SymbolType;
		symbolUuid?: string;
		symbol?: { uuid: string; libraryUuid: string };
		footprintUuid?: string;
		footprint?: { uuid: string; libraryUuid: string };
		model3D?: { uuid: string; libraryUuid: string };
		imageData?: File | Blob;
	},
	description?: string,
	property?: ILIB_DeviceExtendPropertyItem,
): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|deviceName|string|Device name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt;|_(Optional)_ Classification|
|association|{ symbolType?: [ELIB\_SymbolType](../enums/ELIB_SymbolType.md)<!-- -->; symbolUuid?: string; symbol?: { uuid: string; libraryUuid: string }; footprintUuid?: string; footprint?: { uuid: string; libraryUuid: string }; model3D?: { uuid: string; libraryUuid: string }; imageData?: File \| Blob }|_(Optional)_ Associate a symbol, footprint, and image. Specifying `symbolType` creates a new symbol; if no new symbol is needed, `symbolType` does not need to be specified. However, note that if no new symbol is created and no symbol association information is specified, the device cannot be created|
|description|string|_(Optional)_ Description|
|property|[ILIB\_DeviceExtendPropertyItem](../interfaces/ILIB_DeviceExtendPropertyItem.md)|_(Optional)_ Other property, only `designator`<!-- -->, `addIntoBom`<!-- -->, `addIntoPcb` exists default value|

## Returns

Promise&lt;string \| undefined&gt;

Device UUID

## Example

```javascript
// 1. 获取个人库 UUID
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();

// 2. 创建器件：新建元件符号（symbolType: 2）并设置默认属性
const deviceName = `嘉立创示例_新器件_${Date.now()}`;
const deviceUuid = await eda.lib_Device.create(
	libraryUuid,
	deviceName,
	[],
	{ symbolType: 2 },
	'示例器件描述',
	{ designator: 'R', addIntoBom: true, addIntoPcb: true }
);

// 创建类保留现场（新器件留在个人库中供观察）

console.log('deviceUuid:', deviceUuid);
console.log('deviceName:', deviceName);
```


### delete

# LIB\_Device.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Device

## Signature

```typescript
function delete(deviceUuid: string, libraryUuid: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|deviceUuid|string|Device UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 获取个人库 UUID 并新建删除对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const deviceUuid = await eda.lib_Device.create(
	libraryUuid,
	`嘉立创示例_待删除_${Date.now()}`,
	[],
	{ symbolType: 2 }
);

// 2. 删除该器件
const deleted = await eda.lib_Device.delete(deviceUuid, libraryUuid);

console.log('deviceUuid:', deviceUuid);
console.log('deleted:', deleted);
```


### get

# LIB\_Device.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all properties of the device

## Signature

```typescript
function get(deviceUuid: string, libraryUuid?: string): Promise<ILIB_DeviceItem | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|deviceUuid|string|Device UUID|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|

## Returns

Promise&lt;[ILIB\_DeviceItem](../interfaces/ILIB_DeviceItem.md) \| undefined&gt;

Device property

### getbylcscids

# LIB\_Device.getByLcscIds() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get a device using an LCSC C number

## Signature

```typescript
function getByLcscIds<T extends boolean>(
	lcscIds: string,
	libraryUuid?: string,
	allowMultiMatch?: T,
): Promise<T extends true ? ILIB_DeviceSearchItem | undefined : Array<ILIB_DeviceSearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|lcscIds|string|LCSC C number|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|allowMultiMatch|T|_(Optional)_ Whether a single LCSC C number is allowed to match multiple results|

## Returns

Promise&lt;T extends true ? [ILIB\_DeviceSearchItem](../interfaces/ILIB_DeviceSearchItem.md) \| undefined : Array&lt;[ILIB\_DeviceSearchItem](../interfaces/ILIB_DeviceSearchItem.md)<!-- -->&gt;&gt;

Searched device properties

## Remarks

By default, if multiple devices with the same C number are matched in the same library, only the first result will be returned;

If you want to return multiple results, set `allowMultiMatch` to `true`<!-- -->;

This API is temporarily unavailable in the private deployment environment

### getbylcscids_1

# LIB\_Device.getByLcscIds() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Batch get devices using LCSC C numbers

## Signature

```typescript
function getByLcscIds(
	lcscIds: Array<string>,
	libraryUuid?: string,
	allowMultiMatch?: boolean,
): Promise<Array<ILIB_DeviceSearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|lcscIds|Array&lt;string&gt;|Array of LCSC C numbers|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|allowMultiMatch|boolean|_(Optional)_ Whether a single LCSC C number is allowed to match multiple results|

## Returns

Promise&lt;Array&lt;[ILIB\_DeviceSearchItem](../interfaces/ILIB_DeviceSearchItem.md)<!-- -->&gt;&gt;

List of searched device properties

## Remarks

By default, if multiple devices with the same C number are matched in the same library, only the first result will be returned;

If you want to return multiple results, set `allowMultiMatch` to `true`<!-- -->;

This API is temporarily unavailable in the private deployment environment

## Example

```javascript
// 1. 单个 C 编号查询（默认搜索系统库）
const one = await eda.lib_Device.getByLcscIds('C1523');
console.log('single count:', one.length);
console.log('[0] uuid:', one[0].uuid, 'supplierId:', one[0].supplierId);

// 2. 批量查询多个 C 编号
const many = await eda.lib_Device.getByLcscIds(['C1523', 'C17168']);
console.log('batch count:', many.length);
many.forEach((item, i) => {
	console.log(`[${i}] uuid:`, item.uuid, 'supplierId:', item.supplierId);
});
```


### modify

# LIB\_Device.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Device

## Signature

```typescript
function modify(
	deviceUuid: string,
	libraryUuid: string,
	deviceName?: string,
	classification?: ILIB_ClassificationIndex | Array<string> | null,
	association?: {
		symbolUuid?: string;
		symbol?: { uuid: string; libraryUuid: string };
		footprintUuid?: string | null;
		footprint?: { uuid: string; libraryUuid: string } | null;
		model3D?: { uuid: string; libraryUuid: string } | null;
		imageData?: File | Blob | null;
	},
	description?: string | null,
	property?: {
		name?: string | null;
		designator?: string;
		addIntoBom?: boolean;
		addIntoPcb?: boolean;
		net?: string;
		manufacturer?: string | null;
		manufacturerId?: string | null;
		supplier?: string | null;
		supplierId?: string | null;
		otherProperty?: { [key: string]: boolean | number | string | undefined | null };
	},
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|deviceUuid|string|Device UUID|
|libraryUuid|string|Library UUID, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|deviceName|string|_(Optional)_ Device name|
|classification|[ILIB\_ClassificationIndex](../interfaces/ILIB_ClassificationIndex.md) \| Array&lt;string&gt; \| null|_(Optional)_ Classification|
|association|\{ symbolUuid?: string; symbol?: \{ uuid: string; libraryUuid: string \}; footprintUuid?: string \| null; footprint?: \{ uuid: string; libraryUuid: string \} \| null; model3D?: \{ uuid: string; libraryUuid: string \} \| null; imageData?: File \| Blob \| null \}|_(Optional)_ Associated symbol, footprint, image|
|description|string \| null|_(Optional)_ Description|
|property|\{ name?: string \| null; designator?: string; addIntoBom?: boolean; addIntoPcb?: boolean; net?: string; manufacturer?: string \| null; manufacturerId?: string \| null; supplier?: string \| null; supplierId?: string \| null; otherProperty?: \{ \[key: string\]: boolean \| number \| string \| undefined \| null \} \}|_(Optional)_ Other property|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

If you want to clear certain properties, set their values to `null`

## Example

```javascript
// 1. 获取个人库 UUID 并新建修改对象
const libraryUuid = await eda.lib_LibrariesList.getPersonalLibraryUuid();
const deviceUuid = await eda.lib_Device.create(
	libraryUuid,
	`嘉立创示例_修改前_${Date.now()}`,
	[],
	{ symbolType: 2 },
	'修改前的描述'
);

// 2. 修改名称和描述（分类保持不变传 []）
const newName = `嘉立创示例_修改后_${Date.now()}`;
const modified = await eda.lib_Device.modify(deviceUuid, libraryUuid, newName, [], '修改后的描述');

// 3. 再补充修改扩展属性（位号、制造商）
await eda.lib_Device.modify(deviceUuid, libraryUuid, undefined, [], undefined, { designator: 'R', manufacturer: '嘉立创' });

// 修改类保留现场

console.log('deviceUuid:', deviceUuid);
console.log('modified:', modified);
console.log('newName:', newName);
```


### search

# LIB\_Device.search() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search device

## Signature

```typescript
function search(
	key: string,
	libraryUuid?: string,
	classification?: ILIB_ClassificationIndex | Array<string>,
	symbolType?: ELIB_SymbolType,
	itemsOfPage?: number,
	page?: number,
): Promise<Array<ILIB_DeviceSearchItem>>;
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

Promise&lt;Array&lt;[ILIB\_DeviceSearchItem](../interfaces/ILIB_DeviceSearchItem.md)<!-- -->&gt;&gt;

List of searched device properties

## Example

```javascript
// 1. 按关键字搜索系统库中的器件，每页 5 条
const results = await eda.lib_Device.search('0402', undefined, undefined, undefined, 5, 1);

// 2. 输出搜索结果
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'supplierId:', item.supplierId);
});
```


### searchbyproperties

# LIB\_Device.searchByProperties() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Search devices precisely by properties

## Signature

```typescript
function searchByProperties(
	properties: ILIB_DevicePropertiesForSearch,
	libraryUuid?: string,
	classification?: Array<string>,
	symbolType?: ELIB_SymbolType,
	itemsOfPage?: number,
	page?: number,
): Promise<Array<ILIB_DeviceSearchItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|properties|[ILIB\_DevicePropertiesForSearch](../interfaces/ILIB_DevicePropertiesForSearch.md)|Property|
|libraryUuid|string|_(Optional)_ Library UUID, default is system library, you can use [LIB\_LibrariesList](./LIB_LibrariesList.md) APIs in|
|classification|Array&lt;string&gt;|_(Optional)_ Classification, defaults to all ADD since EDA v4|
|symbolType|[ELIB\_SymbolType](../enums/ELIB_SymbolType.md)|_(Optional)_ Symbol type, defaults to all|
|itemsOfPage|number|_(Optional)_ Number of search results per page|
|page|number|_(Optional)_ Page count|

## Returns

Promise&lt;Array&lt;[ILIB\_DeviceSearchItem](../interfaces/ILIB_DeviceSearchItem.md)<!-- -->&gt;&gt;

List of searched device properties

## Example

```javascript
// 1. 按立创 C 编号精确搜索，每页 5 条
const results = await eda.lib_Device.searchByProperties(
	{ supplierId: 'C1523' },
	undefined,
	undefined,
	undefined,
	5,
	1
);

// 2. 输出搜索结果
console.log('count:', results.length);
results.forEach((item, i) => {
	console.log(`[${i}] name:`, item.name, 'uuid:', item.uuid, 'supplierId:', item.supplierId);
});
```
