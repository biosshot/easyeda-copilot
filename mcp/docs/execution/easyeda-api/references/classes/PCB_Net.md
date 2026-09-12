# PCB\_Net class

PCB &amp; footprint / net class

## Signature

```typescript
class PCB_Net
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[getAllNetName()](./PCB_Net.md)||Get the net names of all nets|
|[getAllNets()](./PCB_Net.md)||**_(BETA)_** Get all Detailed information of the net|
|[getAllNetsName()](./PCB_Net.md)||Get the net names of all nets|
|[getAllPrimitivesByNet(net, primitiveTypes)](./PCB_Net.md)||**_(BETA)_** Get all primitives associated with the specified net|
|[getNet(net)](./PCB_Net.md)||**_(BETA)_** Get Specify detailed information of the net|
|[getNetColor(net)](./PCB_Net.md)||**_(BETA)_** Get the color of the specified net|
|[getNetLength(net)](./PCB_Net.md)||Get the length of the specified net|
|[getNetlist(type)](./PCB_Net.md)||Get the netlist|
|[highlightNet(net)](./PCB_Net.md)||**_(BETA)_** Highlight the net|
|[selectNet(net)](./PCB_Net.md)||**_(BETA)_** Select net|
|[setNetColor(net, color)](./PCB_Net.md)||**_(BETA)_** Set the color of the specified net|
|[setNetlist(type, netlist)](./PCB_Net.md)||Update the netlist|
|[unhighlightAllNets()](./PCB_Net.md)||**_(BETA)_** Unhighlight all nets|
|[unhighlightNet(net)](./PCB_Net.md)||**_(BETA)_** Unhighlight the net|
|[unselectAllNets()](./PCB_Net.md)||**_(BETA)_** Unselect all nets|
|[unselectNet(net)](./PCB_Net.md)||**_(BETA)_** Unselect the net|

---

## 方法详情

### getallnetname

# PCB\_Net.getAllNetName() method

> Warning: This API is now obsolete.
>
> Please use [getAllNetsName](./PCB_Net.md) instead

Get the net names of all nets

## Signature

```typescript
function getAllNetName(): Promise<Array<string>>;
```

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Net name array

### getallnets

# PCB\_Net.getAllNets() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Detailed information of the net

## Signature

```typescript
function getAllNets(): Promise<Array<IPCB_NetInfo>>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_NetInfo](../interfaces/IPCB_NetInfo.md)<!-- -->&gt;&gt;

Detailed information of all nets

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可查询的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 一次性取回当前 PCB 的全部网络详情
const nets = await eda.pcb_Net.getAllNets();

// 3. 查看示例网络的典型属性
const target = nets.find(n => n.net === '嘉立创示例_NET1');

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('totalNetCount:', nets.length);
console.log('targetNetName:', target?.net);
console.log('targetNetColor:', target?.color);
console.log('targetNetLength:', target?.length);
```


### getallnetsname

# PCB\_Net.getAllNetsName() method

Get the net names of all nets

## Signature

```typescript
function getAllNetsName(): Promise<Array<string>>;
```

## Returns

Promise&lt;Array&lt;string&gt;&gt;

Net name array

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可查询的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 获取所有网络的名称数组
const names = await eda.pcb_Net.getAllNetsName();

// 3. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('totalNetCount:', names.length);
console.log('netNames:', names.slice(0, 5));
console.log('hasExampleNet:', names.includes('嘉立创示例_NET1'));
```


### getallprimitivesbynet

# PCB\_Net.getAllPrimitivesByNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all primitives associated with the specified net

## Signature

```typescript
function getAllPrimitivesByNet(
	net: string,
	primitiveTypes?: Array<EPCB_PrimitiveType>,
): Promise<Array<IPCB_Primitive>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|
|primitiveTypes|Array&lt;[EPCB\_PrimitiveType](../enums/EPCB_PrimitiveType.md)<!-- -->&gt;|_(Optional)_ Array of primitive types. If the specified primitive type has no net property, the returned data will always be empty|

## Returns

Promise&lt;Array&lt;[IPCB\_Primitive](../interfaces/IPCB_Primitive.md)<!-- -->&gt;&gt;

Array of primitive objects

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可查询的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 获取该网络关联的全部图元
const primitives = await eda.pcb_Net.getAllPrimitivesByNet('嘉立创示例_NET1');

// 3. 查看图元数据对象的典型字段（pcbItemPrimitiveType 为图元类型名称）
const first = primitives[0];

// 4. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('primitiveCount:', primitives.length);
console.log('firstItemPrimitiveType:', first?.pcbItemPrimitiveType);
console.log('firstNet:', first?.net);
console.log('firstCenter:', first?.center);
```


### getnet

# PCB\_Net.getNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Specify detailed information of the net

## Signature

```typescript
function getNet(net: string): Promise<IPCB_NetInfo | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;[IPCB\_NetInfo](../interfaces/IPCB_NetInfo.md) \| undefined&gt;

Detailed information of the net, `undefined` is does not exist this net

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可查询的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 查询指定网络的详细信息
const netInfo = await eda.pcb_Net.getNet('嘉立创示例_NET1');

// 3. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('netName:', netInfo?.net);
console.log('netColor:', netInfo?.color);
console.log('netLength:', netInfo?.length);
```


### getnetcolor

# PCB\_Net.getNetColor() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the color of the specified net

## Signature

```typescript
function getNetColor(net: string): Promise<IPCB_NetInfo['color'] | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;[IPCB\_NetInfo](../interfaces/IPCB_NetInfo.md)<!-- -->\['color'\] \| undefined&gt;

Net color, `undefined` is does not exist this net

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可查询的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 读取该网络当前的颜色
const color = await eda.pcb_Net.getNetColor('嘉立创示例_NET1');

// 3. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('netColor:', color);
```


### getnetlength

# PCB\_Net.getNetLength() method

Get the length of the specified net

## Signature

```typescript
function getNetLength(net: string): Promise<number | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;number \| undefined&gt;

Net length. `undefined` means the net does not exist; `0` means the net has no length

## Example

```javascript
// 1. 创建带网络名的过孔和导线（导线长 1000mil，让网络有实际长度）
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);
const line = await eda.pcb_PrimitiveLine.create('嘉立创示例_NET1', 1, 2000, 2000, 3000, 2000, 10);

// 2. 获取该网络的布线总长
const netLength = await eda.pcb_Net.getNetLength('嘉立创示例_NET1');

// 3. 清理测试图元（查询类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);
await eda.pcb_PrimitiveLine.delete([line.getState_PrimitiveId()]);

console.log('netLength:', netLength);
```


### getnetlist

# PCB\_Net.getNetlist() method

Get the netlist

## Signature

```typescript
function getNetlist(type?: ESYS_NetlistType): Promise<string>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|type|[ESYS\_NetlistType](../enums/ESYS_NetlistType.md)|_(Optional)_ Netlist format|

## Returns

Promise&lt;string&gt;

Netlist data

### highlightnet

# PCB\_Net.highlightNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Highlight the net

## Signature

```typescript
function highlightNet(net: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

The return value of this API is result-oriented. If the net was already highlighted, `true` will also be returned

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可操作的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 高亮该网络（画布上此网络的图元高亮显示）
const highlighted = await eda.pcb_Net.highlightNet('嘉立创示例_NET1');

// 3. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('highlighted:', highlighted);
```


### selectnet

# PCB\_Net.selectNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Select net

## Signature

```typescript
function selectNet(net: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可操作的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 选中该网络（该网络上的全部图元进入选中状态）
const selected = await eda.pcb_Net.selectNet('嘉立创示例_NET1');

// 3. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('selected:', selected);
```


### setnetcolor

# PCB\_Net.setNetColor() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the color of the specified net

## Signature

```typescript
function setNetColor(net: string, color: IPCB_NetInfo['color']): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|
|color|[IPCB\_NetInfo](../interfaces/IPCB_NetInfo.md)<!-- -->\['color'\]|Net color|

## Returns

Promise&lt;boolean&gt;

Whether Set Successful, `false` is does not exist this net

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可操作的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 记录修改前的颜色
const before = await eda.pcb_Net.getNetColor('嘉立创示例_NET1');

// 3. 将网络设置为红色（修改类保留现场，便于在画布上观察效果）
const colorSet = await eda.pcb_Net.setNetColor('嘉立创示例_NET1', { r: 255, g: 0, b: 0, alpha: 1 });

// 4. 重新读取颜色，验证修改已生效
const after = await eda.pcb_Net.getNetColor('嘉立创示例_NET1');

console.log('colorSet:', colorSet);
console.log('before:', before);
console.log('after:', after);
```


### setnetlist

# PCB\_Net.setNetlist() method

Update the netlist

## Signature

```typescript
function setNetlist(type: ESYS_NetlistType | undefined, netlist: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|type|[ESYS\_NetlistType](../enums/ESYS_NetlistType.md) \| undefined|Netlist format|
|netlist|string|Netlist data|

## Returns

Promise&lt;boolean&gt;

### unhighlightallnets

# PCB\_Net.unhighlightAllNets() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unhighlight all nets

## Signature

```typescript
function unhighlightAllNets(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 创建带网络名的过孔并高亮，让画布存在高亮网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);
await eda.pcb_Net.highlightNet('嘉立创示例_NET1');

// 2. 取消所有网络的高亮
const cleared = await eda.pcb_Net.unhighlightAllNets();

// 3. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('allHighlightsCleared:', cleared);
```


### unhighlightnet

# PCB\_Net.unhighlightNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unhighlight the net

## Signature

```typescript
function unhighlightNet(net: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

The return value of this API is result-oriented. If the net was not highlighted before, `true` will also be returned

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可操作的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 先高亮该网络
await eda.pcb_Net.highlightNet('嘉立创示例_NET1');

// 3. 取消该网络的高亮
const unhighlighted = await eda.pcb_Net.unhighlightNet('嘉立创示例_NET1');

// 4. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('unhighlighted:', unhighlighted);
```


### unselectallnets

# PCB\_Net.unselectAllNets() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unselect all nets

## Signature

```typescript
function unselectAllNets(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

If you want to unselect all primitives, use the [PCB\_SelectControl.clearSelected()](./PCB_SelectControl.md) API

## Example

```javascript
// 1. 创建带网络名的过孔并选中，让画布存在选中的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);
await eda.pcb_Net.selectNet('嘉立创示例_NET1');

// 2. 取消所有网络的选中
const cleared = await eda.pcb_Net.unselectAllNets();

// 3. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('allSelectionsCleared:', cleared);
```


### unselectnet

# PCB\_Net.unselectNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unselect the net

## Signature

```typescript
function unselectNet(net: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|net|string|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 创建带网络名的过孔，让 PCB 中出现可操作的网络
const via = await eda.pcb_PrimitiveVia.create('嘉立创示例_NET1', 2000, 2000, 20, 40);

// 2. 先选中该网络
await eda.pcb_Net.selectNet('嘉立创示例_NET1');

// 3. 取消该网络的选中
const unselected = await eda.pcb_Net.unselectNet('嘉立创示例_NET1');

// 4. 清理测试图元（操作类需要清理）
await eda.pcb_PrimitiveVia.delete([via.getState_PrimitiveId()]);

console.log('unselected:', unselected);
```
