# PCB\_PrimitivePad class

PCB &amp; footprint / pad primitive class

## Signature

```typescript
class PCB_PrimitivePad implements IPCB_PrimitiveAPI
```
**Implements:** [IPCB\_PrimitiveAPI](../interfaces/IPCB_PrimitiveAPI.md)

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[create(layer, padNumber, x, y, rotation, pad, net, hole, holeOffsetX, holeOffsetY, holeRotation, metallization, padType, specialPad, solderMaskAndPasteMaskExpansion, heatWelding, primitiveLock)](./PCB_PrimitivePad.md)||Create Pad|
|[delete(primitiveIds)](./PCB_PrimitivePad.md)||**_(BETA)_** Delete Pad|
|[get(primitiveIds)](./PCB_PrimitivePad.md)||**_(BETA)_** Get Pad|
|[get(primitiveIds)](./PCB_PrimitivePad.md)||**_(BETA)_** Get Pad|
|[getAll(layer, net, primitiveLock, padType)](./PCB_PrimitivePad.md)||**_(BETA)_** Get all Pad|
|[getAllPrimitiveId(layer, net, primitiveLock, padType)](./PCB_PrimitivePad.md)||**_(BETA)_** Get all Pad primitive IDs|
|[modify(primitiveId, property)](./PCB_PrimitivePad.md)||**_(BETA)_** Modify Pad|

---

## 方法详情

### create

# PCB\_PrimitivePad.create() method

Create Pad

## Signature

```typescript
function create(
	layer: TPCB_LayersOfPad,
	padNumber: string,
	x: number,
	y: number,
	rotation?: number,
	pad?: TPCB_PrimitivePadShape,
	net?: string,
	hole?: TPCB_PrimitivePadHole | null,
	holeOffsetX?: number,
	holeOffsetY?: number,
	holeRotation?: number,
	metallization?: boolean,
	padType?: EPCB_PrimitivePadType,
	specialPad?: TPCB_PrimitiveSpecialPadShape,
	solderMaskAndPasteMaskExpansion?: IPCB_PrimitiveSolderMaskAndPasteMaskExpansion | null,
	heatWelding?: IPCB_PrimitivePadHeatWelding | null,
	primitiveLock?: boolean,
): Promise<IPCB_PrimitivePad | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfPad](../types/TPCB_LayersOfPad.md)|Layer|
|padNumber|string|Pad number|
|x|number|X position|
|y|number|Y position|
|rotation|number|_(Optional)_ Rotation angle|
|pad|[TPCB\_PrimitivePadShape](../types/TPCB_PrimitivePadShape.md)|_(Optional)_ Pad shape. This parameter is required before the special pad shape is implemented|
|net|string|_(Optional)_ Net name|
|hole|[TPCB\_PrimitivePadHole](../types/TPCB_PrimitivePadHole.md) \| null|_(Optional)_ Hole. `null` indicates no hole|
|holeOffsetX|number|_(Optional)_ Hole offset X|
|holeOffsetY|number|_(Optional)_ Hole offset Y|
|holeRotation|number|_(Optional)_ Rotation angle of the hole relative to the pad|
|metallization|boolean|_(Optional)_ Whether the hole wall is plated|
|padType|[EPCB\_PrimitivePadType](../enums/EPCB_PrimitivePadType.md)|_(Optional)_ Pad type|
|specialPad|[TPCB\_PrimitiveSpecialPadShape](../types/TPCB_PrimitiveSpecialPadShape.md)|_(Optional)_ Special pad shape. Currently not implemented; please do not use it|
|solderMaskAndPasteMaskExpansion|[IPCB\_PrimitiveSolderMaskAndPasteMaskExpansion](../interfaces/IPCB_PrimitiveSolderMaskAndPasteMaskExpansion.md) \| null|_(Optional)_ Solder mask/paste mask expansion. `null` means following the rules|
|heatWelding|[IPCB\_PrimitivePadHeatWelding](../interfaces/IPCB_PrimitivePadHeatWelding.md) \| null|_(Optional)_ Thermal relief optimization parameters|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|

## Returns

Promise&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md) \| undefined&gt;

Pad primitive object

## Example

```javascript
// 1. 生成随机坐标，避免与画布上已有的焊盘重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层（1）创建一个 60x60 圆形贴片焊盘：外形用 ['ELLIPSE', 宽, 高]，无孔传 null
const smd = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);

// 3. 在多层（12）创建一个 80x80 通孔焊盘：圆孔直径 35mil，金属化孔壁（沉铜）
const thru = await eda.pcb_PrimitivePad.create(12, '2', x, y + 500, 0, ['ELLIPSE', 80, 80], '', ['ROUND', 35], 0, 0, 0, true, 0);

// 4. 创建类保留现场，不删除图元
console.log('smd padId:', smd.getState_PrimitiveId());
console.log('smd layer:', smd.getState_Layer());
console.log('thru padId:', thru.getState_PrimitiveId());
console.log('thru layer:', thru.getState_Layer());
```


### delete

# PCB\_PrimitivePad.delete() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Pad

## Signature

```typescript
function delete(primitiveIds: string | IPCB_PrimitivePad | Array<string> | Array<IPCB_PrimitivePad>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|string \| [IPCB\_PrimitivePad](./IPCB_PrimitivePad.md) \| Array&lt;string&gt; \| Array&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md)<!-- -->&gt;|Pad primitive ID or Pad primitive object|

## Returns

Promise&lt;boolean&gt;

Delete Whether the operation is successful

## Example

```javascript
// 1. 创建两个待删除的测试焊盘（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const pad1 = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);
const pad2 = await eda.pcb_PrimitivePad.create(1, '2', x, y + 500, 0, ['OVAL', 80, 50], '', null, 0, 0, 0, false, 0);

// 2. 记录删除前的焊盘数量
const beforeCount = (await eda.pcb_PrimitivePad.getAll()).length;

// 3. 以 ID 数组形式批量删除两个焊盘
const deleted = await eda.pcb_PrimitivePad.delete([pad1.getState_PrimitiveId(), pad2.getState_PrimitiveId()]);

// 4. 删除类保留现场（图元已删除，不恢复）
const afterCount = (await eda.pcb_PrimitivePad.getAll()).length;

console.log('deleted:', deleted);
console.log('beforeCount:', beforeCount, '→ afterCount:', afterCount);
```


### get

# PCB\_PrimitivePad.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Pad

## Signature

```typescript
function get(primitiveIds: string): Promise<IPCB_PrimitivePad | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|string|Pad primitive ID, which can be a string or an array of strings. If it is an array, an array is also returned|

## Returns

Promise&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md) \| undefined&gt;

Pad primitive object, `undefined` indicates that the retrieval failed

## Example

```javascript
// 1. 创建两个测试焊盘（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const pad1 = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);
const pad2 = await eda.pcb_PrimitivePad.create(1, '2', x, y + 500, 0, ['RECT', 80, 40, 0], '', null, 0, 0, 0, false, 0);

// 2. 传单个 ID 字符串，返回单个焊盘对象
const single = await eda.pcb_PrimitivePad.get(pad1.getState_PrimitiveId());

// 3. 传 ID 数组，返回焊盘对象数组（任一 ID 未匹配不影响其它项返回）
const arr = await eda.pcb_PrimitivePad.get([pad1.getState_PrimitiveId(), pad2.getState_PrimitiveId()]);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitivePad.delete([pad1.getState_PrimitiveId(), pad2.getState_PrimitiveId()]);

console.log('single padNumber:', single.getState_PadNumber());
console.log('array length:', arr.length);
console.log('pad2 layer:', arr[1].getState_Layer());
```


### get_1

# PCB\_PrimitivePad.get() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Pad

## Signature

```typescript
function get(primitiveIds: Array<string>): Promise<Array<IPCB_PrimitivePad>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveIds|Array&lt;string&gt;|Pad primitive ID, which can be a string or an array of strings. If it is an array, an array is also returned|

## Returns

Promise&lt;Array&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md)<!-- -->&gt;&gt;

Pad primitive object; an empty array indicates that the retrieval failed

## Remarks

If multiple primitive IDs are passed in, a primitive ID that is not matched will not affect the return of other primitives; that is, fewer primitive objects than the number of primitive IDs passed in may be returned.

### getall

# PCB\_PrimitivePad.getAll() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Pad

## Signature

```typescript
function getAll(
	layer?: TPCB_LayersOfPad,
	net?: string,
	primitiveLock?: boolean,
	padType?: EPCB_PrimitivePadType,
): Promise<Array<IPCB_PrimitivePad>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfPad](../types/TPCB_LayersOfPad.md)|_(Optional)_ Layer|
|net|string|_(Optional)_ Net name|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|
|padType|[EPCB\_PrimitivePadType](../enums/EPCB_PrimitivePadType.md)|_(Optional)_|

## Returns

Promise&lt;Array&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md)<!-- -->&gt;&gt;

Array of Pad primitive objects

## Example

```javascript
// 1. 创建一个顶层测试焊盘作为过滤目标（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const pad = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);
const padId = pad.getState_PrimitiveId();

// 2. 不带参数：获取 PCB 上全部焊盘
const all = await eda.pcb_PrimitivePad.getAll();

// 3. 按层过滤：只取顶层（1）的焊盘
const topLayer = await eda.pcb_PrimitivePad.getAll(1);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitivePad.delete([padId]);

console.log('total pads:', all.length);
console.log('top layer pads:', topLayer.length);
console.log('marker pad found in top layer:', topLayer.some(p => p.getState_PrimitiveId() === padId));
```


### getallprimitiveid

# PCB\_PrimitivePad.getAllPrimitiveId() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Pad primitive IDs

## Signature

```typescript
function getAllPrimitiveId(
	layer?: TPCB_LayersOfPad,
	net?: string,
	primitiveLock?: boolean,
	padType?: EPCB_PrimitivePadType,
): Promise<Array<string>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfPad](../types/TPCB_LayersOfPad.md)|_(Optional)_ Layer|
|net|string|_(Optional)_ Net name|
|primitiveLock|boolean|_(Optional)_ Whether it is locked|
|padType|[EPCB\_PrimitivePadType](../enums/EPCB_PrimitivePadType.md)|_(Optional)_|

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Array of Pad primitive IDs

## Example

```javascript
// 1. 创建一个顶层测试焊盘作为查找目标（随机坐标避免重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const pad = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);
const padId = pad.getState_PrimitiveId();

// 2. 获取全部焊盘的图元 ID
const allIds = await eda.pcb_PrimitivePad.getAllPrimitiveId();

// 3. 按层过滤：只取顶层（1）焊盘的图元 ID
const topLayerIds = await eda.pcb_PrimitivePad.getAllPrimitiveId(1);

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitivePad.delete([padId]);

console.log('total pad ids:', allIds.length);
console.log('top layer pad ids:', topLayerIds.length);
console.log('marker id in top layer list:', topLayerIds.includes(padId));
```


### modify

# PCB\_PrimitivePad.modify() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Pad

## Signature

```typescript
function modify(
	primitiveId: string | IPCB_PrimitivePad,
	property: {
		layer?: TPCB_LayersOfPad;
		padNumber?: string;
		x?: number;
		y?: number;
		rotation?: number;
		pad?: TPCB_PrimitivePadShape;
		net?: string;
		hole?: TPCB_PrimitivePadHole | null;
		holeOffsetX?: number;
		holeOffsetY?: number;
		holeRotation?: number;
		metallization?: boolean;
		specialPad?: TPCB_PrimitiveSpecialPadShape;
		solderMaskAndPasteMaskExpansion?: IPCB_PrimitiveSolderMaskAndPasteMaskExpansion | null;
		heatWelding?: IPCB_PrimitivePadHeatWelding | null;
		primitiveLock?: boolean;
	},
): Promise<IPCB_PrimitivePad | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveId|string \| [IPCB\_PrimitivePad](./IPCB_PrimitivePad.md)|Primitive ID|
|property|{ layer?: [TPCB\_LayersOfPad](../types/TPCB_LayersOfPad.md)<!-- -->; padNumber?: string; x?: number; y?: number; rotation?: number; pad?: [TPCB\_PrimitivePadShape](../types/TPCB_PrimitivePadShape.md)<!-- -->; net?: string; hole?: [TPCB\_PrimitivePadHole](../types/TPCB_PrimitivePadHole.md) \| null; holeOffsetX?: number; holeOffsetY?: number; holeRotation?: number; metallization?: boolean; specialPad?: [TPCB\_PrimitiveSpecialPadShape](../types/TPCB_PrimitiveSpecialPadShape.md)<!-- -->; solderMaskAndPasteMaskExpansion?: [IPCB\_PrimitiveSolderMaskAndPasteMaskExpansion](../interfaces/IPCB_PrimitiveSolderMaskAndPasteMaskExpansion.md) \| null; heatWelding?: [IPCB\_PrimitivePadHeatWelding](../interfaces/IPCB_PrimitivePadHeatWelding.md) \| null; primitiveLock?: boolean }|Modify Parameter|

## Returns

Promise&lt;[IPCB\_PrimitivePad](./IPCB_PrimitivePad.md) \| undefined&gt;

Pad primitive object

## Example

```javascript
// 1. 创建待修改的测试焊盘（随机坐标避免与画布已有焊盘重合）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const pad = await eda.pcb_PrimitivePad.create(1, '1', x, y, 0, ['ELLIPSE', 60, 60], '', null, 0, 0, 0, false, 0);
const padId = pad.getState_PrimitiveId();

// 2. 读取修改前的编号与旋转
const beforeNumber = pad.getState_PadNumber();
const beforeRotation = pad.getState_Rotation();

// 3. 批量修改：编号 '1' → 'A1'，旋转 0 → 45 度
await eda.pcb_PrimitivePad.modify(padId, { padNumber: 'A1', rotation: 45 });

// 4. modify 返回后需要重新 get() 才能读到画布上的最新值
const refreshed = await eda.pcb_PrimitivePad.get(padId);

// 5. 修改类保留现场，供观察修改结果
console.log('primitiveId:', padId);
console.log('padNumber:', beforeNumber, '→', refreshed.getState_PadNumber());
console.log('rotation:', beforeRotation, '→', refreshed.getState_Rotation());
```
