# PCB\_PrimitiveObject class

PCB &amp; footprint / binary embedded object primitive class

## Signature

```typescript
class PCB_PrimitiveObject implements IPCB_PrimitiveAPI
```
**Implements:** [IPCB\_PrimitiveAPI](../interfaces/IPCB_PrimitiveAPI.md)

## Remarks

Color silkscreen images are binary embedded objects. They must be created and modified using the methods of binary embedded objects

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[create(layer, topLeftX, topLeftY, binaryData, width, height, rotation, mirror, fileName, primitiveLock)](./PCB_PrimitiveObject.md)||**_(BETA)_** Create Binary embedded object|
|[delete(primitiveIds)](./PCB_PrimitiveObject.md)||**_(BETA)_** Delete Binary embedded object|
|[get(primitiveIds)](./PCB_PrimitiveObject.md)||**_(BETA)_** Get Binary embedded object|
|[get(primitiveIds)](./PCB_PrimitiveObject.md)||**_(BETA)_** Get Binary embedded object|
|[getAll(layer, primitiveLock)](./PCB_PrimitiveObject.md)||**_(BETA)_** Get all Binary embedded object|
|[getAllPrimitiveId(layer, primitiveLock)](./PCB_PrimitiveObject.md)||**_(BETA)_** Get all Binary embedded object primitive IDs|
|[modify(primitiveId, property)](./PCB_PrimitiveObject.md)||**_(BETA)_** Modify Binary embedded object|

---

## 方法详情

### create

# PCB\_PrimitiveObject.create() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Binary embedded object

## Signature

```typescript
function create(
	layer: TPCB_LayersOfObject,
	topLeftX: number,
	topLeftY: number,
	binaryData: string,
	width: number,
	height: number,
	rotation?: number,
	mirror?: boolean,
	fileName?: string,
	primitiveLock?: boolean,
): Promise<IPCB_PrimitiveObject | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfObject](../types/TPCB_LayersOfObject.md)|Layer|
|topLeftX|number|Top-left point X|
|topLeftY|number|Top-left point Y|
|binaryData|string|Binary data|
|width|number|Width|
|height|number|Height|
|rotation|number|_(Optional)_ Rotation angle|
|mirror|boolean|_(Optional)_ Whether it is horizontally mirrored|
|fileName|string|_(Optional)_ File name|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|

## Returns

Promise&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md) \| undefined&gt;

- binary embedded object primitive object

## Example

```javascript
// 1. 生成随机放置坐标，避免与画布上已有的内嵌对象重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 准备 4x4 像素 PNG 的 data URI（binaryData 必须是 data URI 格式，裸 base64 会创建失败）
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';

// 3. 在顶层丝印（3）放置图片：左上角（x, y），宽 400、高 300，不旋转、不镜像、不锁定
const obj = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo.png', false);

// 4. 创建类保留现场，不删除图元（getState_BinaryData 返回数据 hash，用长度表示）
console.log('primitiveId:', obj.getState_PrimitiveId());
console.log('primitiveType:', obj.getState_PrimitiveType());
console.log('layer:', obj.getState_Layer());
console.log('width:', obj.getState_Width(), 'height:', obj.getState_Height());
console.log('fileName:', obj.getState_FileName());
console.log('binaryData hash length:', obj.getState_BinaryData().length);
```


### delete

# PCB\_PrimitiveObject.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Binary embedded object

## Signature

```typescript
function delete(primitiveIds: string | IPCB_PrimitiveObject | Array<string> | Array<IPCB_PrimitiveObject>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|string \| [IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md) \| Array&lt;string&gt; \| Array&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md)<!-- -->&gt;|Binary embedded object primitive ID or Binary embedded object primitive object|

## Returns

Promise&lt;boolean&gt;

Delete Whether the operation is successful

## Example

```javascript
// 1. 创建两个待删除的测试内嵌对象（随机坐标避免重合），使用 4x4 像素 PNG 的 data URI
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';
const obj1 = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo1.png', false);
const obj2 = await eda.pcb_PrimitiveObject.create(3, x, y + 500, binaryData, 400, 300, 0, false, 'logo2.png', false);

// 2. 记录删除前的内嵌对象数量
const beforeCount = (await eda.pcb_PrimitiveObject.getAll()).length;

// 3. 以 ID 数组形式批量删除两个内嵌对象
const deleted = await eda.pcb_PrimitiveObject.delete([obj1.getState_PrimitiveId(), obj2.getState_PrimitiveId()]);

// 4. 删除类保留现场（图元已删除，不恢复）
const afterCount = (await eda.pcb_PrimitiveObject.getAll()).length;

console.log('deleted:', deleted);
console.log('beforeCount:', beforeCount, '→ afterCount:', afterCount);
```


### get

# PCB\_PrimitiveObject.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Binary embedded object

## Signature

```typescript
function get(primitiveIds: string): Promise<IPCB_PrimitiveObject | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|string|Binary embedded object primitive ID, which can be a string or an array of strings. If it is an array, an array is also returned|

## Returns

Promise&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md) \| undefined&gt;

Binary embedded object primitive object, `undefined` indicates that the retrieval failed

## Example

```javascript
// 1. 创建两个测试内嵌对象（随机坐标避免重合），使用 4x4 像素 PNG 的 data URI
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';
const obj1 = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo1.png', false);
const obj2 = await eda.pcb_PrimitiveObject.create(3, x, y + 500, binaryData, 200, 150, 0, false, 'logo2.png', false);

// 2. 传单个 ID 字符串，返回单个内嵌对象
const single = await eda.pcb_PrimitiveObject.get(obj1.getState_PrimitiveId());

// 3. 传 ID 数组，返回内嵌对象数组（混入未匹配的 ID 不影响其它图元返回）
const arr = await eda.pcb_PrimitiveObject.get([obj1.getState_PrimitiveId(), obj2.getState_PrimitiveId()]);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveObject.delete([obj1.getState_PrimitiveId(), obj2.getState_PrimitiveId()]);

console.log('single width:', single.getState_Width());
console.log('array length:', arr.length);
console.log('obj2 fileName:', arr[1].getState_FileName());
```


### get_1

# PCB\_PrimitiveObject.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Binary embedded object

## Signature

```typescript
function get(primitiveIds: Array<string>): Promise<Array<IPCB_PrimitiveObject>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|Array&lt;string&gt;|Binary embedded object primitive ID, which can be a string or an array of strings. If it is an array, an array is also returned|

## Returns

Promise&lt;Array&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md)<!-- -->&gt;&gt;

Binary embedded object primitive object; an empty array indicates that the retrieval failed

## Remarks

If multiple primitive IDs are passed in, a primitive ID that is not matched will not affect the return of other primitives; that is, fewer primitive objects than the number of primitive IDs passed in may be returned.

### getall

# PCB\_PrimitiveObject.getAll() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Binary embedded object

## Signature

```typescript
function getAll(
	layer?: TPCB_LayersOfObject,
	primitiveLock?: boolean,
): Promise<Array<IPCB_PrimitiveObject>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfObject](../types/TPCB_LayersOfObject.md)|_(Optional)_ Layer|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|

## Returns

Promise&lt;Array&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md)<!-- -->&gt;&gt;

Array of Binary embedded object primitive objects

## Example

```javascript
// 1. 创建一个顶层丝印（3）测试对象作为过滤目标（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';
const obj = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo.png', false);
const objId = obj.getState_PrimitiveId();

// 2. 不带参数：获取 PCB 上全部内嵌对象
const all = await eda.pcb_PrimitiveObject.getAll();

// 3. 按层过滤：只取顶层丝印（3）的内嵌对象
const topSilk = await eda.pcb_PrimitiveObject.getAll(3);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveObject.delete([objId]);

console.log('total objects:', all.length);
console.log('top silkscreen objects:', topSilk.length);
console.log('marker found in top silkscreen:', topSilk.some(o => o.getState_PrimitiveId() === objId));
```


### getallprimitiveid

# PCB\_PrimitiveObject.getAllPrimitiveId() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Binary embedded object primitive IDs

## Signature

```typescript
function getAllPrimitiveId(
	layer?: TPCB_LayersOfObject,
	primitiveLock?: boolean,
): Promise<Array<string>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfObject](../types/TPCB_LayersOfObject.md)|_(Optional)_ Layer|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Array of Binary embedded object primitive IDs

## Example

```javascript
// 1. 创建一个顶层丝印（3）测试对象作为查找目标（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';
const obj = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo.png', false);
const objId = obj.getState_PrimitiveId();

// 2. 获取全部内嵌对象的图元 ID
const allIds = await eda.pcb_PrimitiveObject.getAllPrimitiveId();

// 3. 按层过滤：只取顶层丝印（3）内嵌对象的图元 ID
const topSilkIds = await eda.pcb_PrimitiveObject.getAllPrimitiveId(3);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveObject.delete([objId]);

console.log('total object ids:', allIds.length);
console.log('top silkscreen object ids:', topSilkIds.length);
console.log('marker id in top silkscreen list:', topSilkIds.includes(objId));
```


### modify

# PCB\_PrimitiveObject.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Binary embedded object

## Signature

```typescript
function modify(
	primitiveId: string | IPCB_PrimitiveObject,
	property: {
		layer?: TPCB_LayersOfObject;
		topLeftX?: number;
		topLeftY?: number;
		binaryData?: string;
		width?: number;
		height?: number;
		rotation?: number;
		mirror?: boolean;
		fileName?: string;
		primitiveLock?: boolean;
	},
): Promise<IPCB_PrimitiveObject | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveId|string \| [IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md)|Primitive ID|
|property|{ layer?: [TPCB\_LayersOfObject](../types/TPCB_LayersOfObject.md)<!-- -->; topLeftX?: number; topLeftY?: number; binaryData?: string; width?: number; height?: number; rotation?: number; mirror?: boolean; fileName?: string; primitiveLock?: boolean }|Modify Parameter|

## Returns

Promise&lt;[IPCB\_PrimitiveObject](./IPCB_PrimitiveObject.md) \| undefined&gt;

Binary embedded object primitive object, `undefined` indicates that the modification failed

## Example

```javascript
// 1. 创建待修改的测试内嵌对象（随机坐标避免重合），使用 4x4 像素 PNG 的 data URI
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const binaryData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg==';
const obj = await eda.pcb_PrimitiveObject.create(3, x, y, binaryData, 400, 300, 0, false, 'logo.png', false);
const objId = obj.getState_PrimitiveId();

// 2. 读取修改前的宽与旋转角
const beforeWidth = obj.getState_Width();
const beforeRotation = obj.getState_Rotation();

// 3. 批量修改：宽 400 → 500，旋转 0 → 90 度
await eda.pcb_PrimitiveObject.modify(objId, { width: 500, rotation: 90 });

// 4. modify 返回后需要重新 get() 才能读到画布上的最新值
const refreshed = await eda.pcb_PrimitiveObject.get(objId);

// 5. 修改类保留现场，供观察修改结果
console.log('primitiveId:', objId);
console.log('width:', beforeWidth, '→', refreshed.getState_Width());
console.log('rotation:', beforeRotation, '→', refreshed.getState_Rotation());
```
