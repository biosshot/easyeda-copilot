# PCB\_Layer class

PCB &amp; footprint / layer operation class

## Signature

```typescript
class PCB_Layer
```

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[addCustomLayer()](./PCB_Layer.md)||**_(BETA)_** Add a custom layer|
|[getAllLayers()](./PCB_Layer.md)||**_(BETA)_** Get the detailed properties of all layers|
|[lockLayer(layer)](./PCB_Layer.md)||**_(BETA)_** Lock the layer|
|[modifyLayer(layer, property)](./PCB_Layer.md)||**_(BETA)_** Modify Layer properties|
|[removeLayer(layer)](./PCB_Layer.md)||**_(BETA)_** Remove Layer|
|[selectLayer(layer)](./PCB_Layer.md)||Select a layer|
|[setInactiveLayerDisplayMode(displayMode)](./PCB_Layer.md)||**_(BETA)_** Set Inactive layer display mode|
|[setInactiveLayerTransparency(transparency)](./PCB_Layer.md)||**_(BETA)_** Set the inactive layer transparency|
|[setLayerColorConfiguration(colorConfiguration)](./PCB_Layer.md)||**_(BETA)_** Set the layer color configuration|
|[setLayerInvisible(layer, setOtherLayerVisible)](./PCB_Layer.md)||**_(BETA)_** Set the layer to invisible|
|[setLayerVisible(layer, setOtherLayerInvisible)](./PCB_Layer.md)||**_(BETA)_** Set the layer to visible|
|[setPcbType(pcbType)](./PCB_Layer.md)||**_(BETA)_** Set PCB type|
|[setTheNumberOfCopperLayers(numberOfLayers)](./PCB_Layer.md)||**_(BETA)_** Set Number of copper layers|
|[unlockLayer(layer)](./PCB_Layer.md)||**_(BETA)_** Unlock the layer|

---

## 方法详情

### addcustomlayer

# PCB\_Layer.addCustomLayer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Add a custom layer

## Signature

```typescript
function addCustomLayer(): Promise<TPCB_LayersOfCustom | undefined>;
```

## Returns

Promise&lt;[TPCB\_LayersOfCustom](../types/TPCB_LayersOfCustom.md) \| undefined&gt;

The layer ID of the newly added custom layer. If it is `undefined`<!-- -->, the addition failed, possibly because the number of custom layers has reached the upper limit

## Example

```javascript
// 1. 先移除历史运行遗留的自定义层，保证案例可以反复执行
const layers = await eda.pcb_Layer.getAllLayers();
for (const item of layers.filter(l => l.type === 'CUSTOM')) {
	await eda.pcb_Layer.removeLayer(item.id);
}

// 2. 新增自定义层，返回新层的图层 ID（CUSTOM_1=71 起顺延分配）
const customLayerId = await eda.pcb_Layer.addCustomLayer();

// 3. 从图层列表确认新层已存在（保留现场，可在图层面板观察）
const after = await eda.pcb_Layer.getAllLayers();
const newLayer = after.find(l => l.id === customLayerId);

console.log('customLayerId:', customLayerId);
console.log('newLayerName:', newLayer?.name);
console.log('customLayerCount:', after.filter(l => l.type === 'CUSTOM').length);
```


### getalllayers

# PCB\_Layer.getAllLayers() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the detailed properties of all layers

## Signature

```typescript
function getAllLayers(): Promise<Array<IPCB_LayerItem>>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_LayerItem](../interfaces/IPCB_LayerItem.md)<!-- -->&gt;&gt;

Detailed properties of all layers

## Example

```javascript
// 1. 一次性取回当前 PCB 的全部图层
const layers = await eda.pcb_Layer.getAllLayers();

// 2. 查看顶层（TOP=1）的典型属性
const top = layers.find(l => l.id === 1);

// 3. 统计信号层（铜箔层）数量
const copperCount = layers.filter(l => l.type === 'SIGNAL').length;

console.log('totalCount:', layers.length);
console.log('topLayerName:', top?.name);
console.log('topLayerColor:', top?.color);
console.log('topLayerLocked:', top?.locked);
console.log('copperLayerCount:', copperCount);
```


### locklayer

# PCB\_Layer.lockLayer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Lock the layer

## Signature

```typescript
function lockLayer(
	layer?: TPCB_LayersInTheSelectable | Array<TPCB_LayersInTheSelectable>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md) \| Array&lt;[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)<!-- -->&gt;|_(Optional)_ Layer. If no layer is specified, all layers are used by default|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 锁定顶层（TOP=1）与底层（BOTTOM=2），传入层数组
const lockResult = await eda.pcb_Layer.lockLayer([1, 2]);

// 2. 从图层列表确认锁定状态
const layers = await eda.pcb_Layer.getAllLayers();
const top = layers.find(l => l.id === 1);

// 3. 恢复现场：解锁这两层，避免影响后续编辑
const restoreResult = await eda.pcb_Layer.unlockLayer([1, 2]);

console.log('lockResult:', lockResult);
console.log('topLockedNow:', top?.locked);
console.log('restoreResult:', restoreResult);
```


### modifylayer

# PCB\_Layer.modifyLayer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Layer properties

## Signature

```typescript
function modifyLayer(
	layer: TPCB_LayersInTheSelectable,
	property: {
		name?: string;
		type?: TPCB_LayerTypesOfInnerLayer;
		color?: string;
		transparency?: number;
	},
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)|Layer|
|property|{ name?: string; type?: [TPCB\_LayerTypesOfInnerLayer](../types/TPCB_LayerTypesOfInnerLayer.md)<!-- -->; color?: string; transparency?: number }|Property|

## Returns

Promise&lt;boolean&gt;

The modified layer properties. If it is `undefined`<!-- -->, the modification failed or the layer does not exist

## Remarks

Only inner layers and custom layers can have their names modified; only inner layers can have their types modified. Transparency only supports values between 0-100

## Example

```javascript
// 1. 新增一个自定义层作为修改对象
const customLayerId = await eda.pcb_Layer.addCustomLayer();

// 2. 读取修改前的名称与颜色
const before = (await eda.pcb_Layer.getAllLayers()).find(l => l.id === customLayerId);

// 3. 修改名称、颜色与透明度（保留现场供观察）
const modifyResult = await eda.pcb_Layer.modifyLayer(customLayerId, {
	name: '嘉立创示例_工艺说明',
	color: '#FF6600',
	transparency: 30,
});

// 4. 重新读取图层列表确认修改生效
const after = (await eda.pcb_Layer.getAllLayers()).find(l => l.id === customLayerId);

console.log('modifyResult:', modifyResult);
console.log('nameBefore:', before?.name, '→ nameAfter:', after?.name);
console.log('colorBefore:', before?.color, '→ colorAfter:', after?.color);
```


### removelayer

# PCB\_Layer.removeLayer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Remove Layer

## Signature

```typescript
function removeLayer(layer: TPCB_LayersOfCustom): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfCustom](../types/TPCB_LayersOfCustom.md)|Layer|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

Currently only custom layers can be removed

## Example

```javascript
// 1. 新增一个自定义层作为移除对象
const customLayerId = await eda.pcb_Layer.addCustomLayer();

// 2. 移除该自定义层，返回操作是否成功
const removeResult = await eda.pcb_Layer.removeLayer(customLayerId);

// 3. 确认该层已从图层列表消失
const rest = (await eda.pcb_Layer.getAllLayers()).filter(l => l.type === 'CUSTOM');

console.log('removeResult:', removeResult);
console.log('removedLayerId:', customLayerId);
console.log('customLayerLeft:', rest.length);
```


### selectlayer

# PCB\_Layer.selectLayer() method

Select a layer

## Signature

```typescript
function selectLayer(layer: TPCB_LayersInTheSelectable): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)|Layer|

## Returns

Promise&lt;boolean&gt;

Whether the operation was successful. `false` is returned if the specified layer does not exist

## Example

```javascript
// 1. 切换当前工作层到底层（BOTTOM=2）
const selectResult = await eda.pcb_Layer.selectLayer(2);

// 2. 再切回顶层（TOP=1），恢复常用工作层
const restoreResult = await eda.pcb_Layer.selectLayer(1);

console.log('selectResult:', selectResult);
console.log('restoreResult:', restoreResult);
```


### setinactivelayerdisplaymode

# PCB\_Layer.setInactiveLayerDisplayMode() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set Inactive layer display mode

## Signature

```typescript
function setInactiveLayerDisplayMode(displayMode?: EPCB_InactiveLayerDisplayMode): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|displayMode|[EPCB\_InactiveLayerDisplayMode](../enums/EPCB_InactiveLayerDisplayMode.md)|_(Optional)_ Display mode|

## Returns

Promise&lt;boolean&gt;

Whether Set Successful

## Example

```javascript
// 1. 将非激活层设为置灰模式（TURN_GRAY=1）
const setResult = await eda.pcb_Layer.setInactiveLayerDisplayMode(1);

// 2. 恢复为正常亮度（NORMAL_BRIGHTNESS=0），避免影响日常查看
const restoreResult = await eda.pcb_Layer.setInactiveLayerDisplayMode(0);

console.log('setResult:', setResult);
console.log('restoreResult:', restoreResult);
```


### setinactivelayertransparency

# PCB\_Layer.setInactiveLayerTransparency() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the inactive layer transparency

## Signature

```typescript
function setInactiveLayerTransparency(transparency: number): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|transparency|number|Transparency, range `0-100`|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 将非激活层透明度设为 60，让当前编辑层更突出
const setResult = await eda.pcb_Layer.setInactiveLayerTransparency(60);

// 2. 恢复为 0（不透明），避免影响日常查看
const restoreResult = await eda.pcb_Layer.setInactiveLayerTransparency(0);

console.log('setResult:', setResult);
console.log('restoreResult:', restoreResult);
```


### setlayercolorconfiguration

# PCB\_Layer.setLayerColorConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the layer color configuration

## Signature

```typescript
function setLayerColorConfiguration(
	colorConfiguration: EPCB_LayerColorConfiguration,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|colorConfiguration|[EPCB\_LayerColorConfiguration](../enums/EPCB_LayerColorConfiguration.md)|Color configuration|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 记录切换前顶层的颜色
const before = (await eda.pcb_Layer.getAllLayers()).find(l => l.id === 1);

// 2. 切换为 Altium Designer 配色（ALTIUM_DESIGNER=2）
const setResult = await eda.pcb_Layer.setLayerColorConfiguration(2);

// 3. 查看切换后顶层的颜色
const after = (await eda.pcb_Layer.getAllLayers()).find(l => l.id === 1);

// 4. 恢复嘉立创 EDA 默认配色（EASYEDA=1）
const restoreResult = await eda.pcb_Layer.setLayerColorConfiguration(1);

console.log('setResult:', setResult);
console.log('topColorBefore:', before?.color, '→ topColorAfter:', after?.color);
console.log('restoreResult:', restoreResult);
```


### setlayerinvisible

# PCB\_Layer.setLayerInvisible() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the layer to invisible

## Signature

```typescript
function setLayerInvisible(
	layer?: TPCB_LayersInTheSelectable | Array<TPCB_LayersInTheSelectable>,
	setOtherLayerVisible?: boolean,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md) \| Array&lt;[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)<!-- -->&gt;|_(Optional)_ Layer. If no layer is specified, all layers are used by default|
|setOtherLayerVisible|boolean|_(Optional)_ Whether to set other layers to visible|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 隐藏底层丝印层（BOTTOM_SILKSCREEN=4）
const hideResult = await eda.pcb_Layer.setLayerInvisible(4);

// 2. 从图层列表确认显隐状态（HIDDEN=2）
const layers = await eda.pcb_Layer.getAllLayers();
const silk = layers.find(l => l.id === 4);

// 3. 恢复可见，避免影响后续查看
const restoreResult = await eda.pcb_Layer.setLayerVisible(4);

console.log('hideResult:', hideResult);
console.log('silkLayerStatus:', silk?.layerStatus);
console.log('restoreResult:', restoreResult);
```


### setlayervisible

# PCB\_Layer.setLayerVisible() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the layer to visible

## Signature

```typescript
function setLayerVisible(
	layer?: TPCB_LayersInTheSelectable | Array<TPCB_LayersInTheSelectable>,
	setOtherLayerInvisible?: boolean,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md) \| Array&lt;[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)<!-- -->&gt;|_(Optional)_ Layer. If no layer is specified, all layers are used by default|
|setOtherLayerInvisible|boolean|_(Optional)_ Whether to set other layers to invisible|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 先隐藏底层丝印层（BOTTOM_SILKSCREEN=4）制造初始状态
await eda.pcb_Layer.setLayerInvisible(4);

// 2. 恢复底层丝印层可见
const showResult = await eda.pcb_Layer.setLayerVisible(4);

// 3. 从图层列表确认显隐状态（SHOW=1）
const layers = await eda.pcb_Layer.getAllLayers();
const silk = layers.find(l => l.id === 4);

console.log('showResult:', showResult);
console.log('silkLayerStatus:', silk?.layerStatus);
```


### setpcbtype

# PCB\_Layer.setPcbType() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set PCB type

## Signature

```typescript
function setPcbType(pcbType: EPCB_PcbPlateType): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|pcbType|[EPCB\_PcbPlateType](../enums/EPCB_PcbPlateType.md)|PCB type|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

This is mainly to support FPC flexible board design. If the PCB type is set to FPC flexible board, an FPC stiffener layer will be added.

Please note:

1. EasyEDA does not yet support FPC flexible board production with more than 2 copper layers;

2. When switching the PCB type from FPC flexible board to ordinary board, any primitives on the FPC stiffener layer must be deleted in advance; otherwise, the switch will fail and `false` will be returned.

## Example

```javascript
// 1. 记录切换前的图层总数
const before = await eda.pcb_Layer.getAllLayers();

// 2. 切换为 FPC 软板（FPC=2），自动新增补强层
const fpcResult = await eda.pcb_Layer.setPcbType(2);

// 3. 查看切换后的图层总数变化
const fpcLayers = await eda.pcb_Layer.getAllLayers();

// 4. 切回普通板材（NORMAL=1），恢复原板材类型
const restoreResult = await eda.pcb_Layer.setPcbType(1);

console.log('fpcResult:', fpcResult);
console.log('layerCountBefore:', before.length, '→ layerCountAfter:', fpcLayers.length);
console.log('restoreResult:', restoreResult);
```


### setthenumberofcopperlayers

# PCB\_Layer.setTheNumberOfCopperLayers() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set Number of copper layers

## Signature

```typescript
function setTheNumberOfCopperLayers(
	numberOfLayers: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 | 24 | 26 | 28 | 30 | 32,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|numberOfLayers|2 \| 4 \| 6 \| 8 \| 10 \| 12 \| 14 \| 16 \| 18 \| 20 \| 22 \| 24 \| 26 \| 28 \| 30 \| 32|Number of copper layers|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Remarks

A newly created PCB document has two copper layers by default

## Example

```javascript
// 1. 记录调整前的信号层（铜箔层）数量
const before = (await eda.pcb_Layer.getAllLayers()).filter(l => l.type === 'SIGNAL').length;

// 2. 将铜箔层数调整为 4 层，新增 INNER_1（15）、INNER_2（16）两个内层
const setResult = await eda.pcb_Layer.setTheNumberOfCopperLayers(4);

// 3. 确认内层已加入图层列表
const afterLayers = await eda.pcb_Layer.getAllLayers();
const after = afterLayers.filter(l => l.type === 'SIGNAL').length;
const inner1 = afterLayers.find(l => l.id === 15);

// 4. 恢复为 2 层板，移除空的内层（内层上有图元时无法减少层数）
const restoreResult = await eda.pcb_Layer.setTheNumberOfCopperLayers(2);

console.log('setResult:', setResult);
console.log('copperCountBefore:', before, '→ copperCountAfter:', after);
console.log('inner1Name:', inner1?.name);
console.log('restoreResult:', restoreResult);
```


### unlocklayer

# PCB\_Layer.unlockLayer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Unlock the layer

## Signature

```typescript
function unlockLayer(
	layer?: TPCB_LayersInTheSelectable | Array<TPCB_LayersInTheSelectable>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md) \| Array&lt;[TPCB\_LayersInTheSelectable](../types/TPCB_LayersInTheSelectable.md)<!-- -->&gt;|_(Optional)_ Layer. If no layer is specified, all layers are used by default|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 先锁定顶层（TOP=1）制造初始状态
await eda.pcb_Layer.lockLayer(1);

// 2. 解锁顶层，返回操作是否成功
const unlockResult = await eda.pcb_Layer.unlockLayer(1);

// 3. 从图层列表确认锁定已解除
const layers = await eda.pcb_Layer.getAllLayers();
const top = layers.find(l => l.id === 1);

console.log('unlockResult:', unlockResult);
console.log('topStillLocked:', top?.locked);
```
