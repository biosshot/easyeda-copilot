# IPCB\_PrimitiveAttribute class

Property primitive

## Signature

```typescript
class IPCB_PrimitiveAttribute implements IPCB_Primitive
```
**Implements:** [IPCB\_Primitive](../interfaces/IPCB_Primitive.md)

## Constructors

|Constructor|Modifiers|Description|
|---|---|---|
|[(constructor)(layer, x, y, key, value, keyVisible, valueVisible, fontFamily, fontSize, lineWidth, alignMode, rotation, reverse, expansion, mirror, primitiveLock, primitiveId, parentPrimitiveId)](./IPCB_PrimitiveAttribute.md)||Constructs a new instance of the `IPCB_PrimitiveAttribute` class|

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[done()](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Apply the changes to the primitives to the canvas|
|[getState\_AlignMode()](./IPCB_PrimitiveAttribute.md)||Get the property state: alignment mode|
|[getState\_Expansion()](./IPCB_PrimitiveAttribute.md)||Get the property state: inverted expansion|
|[getState\_FontFamily()](./IPCB_PrimitiveAttribute.md)||Get the property state: font|
|[getState\_FontSize()](./IPCB_PrimitiveAttribute.md)||Get the property state: font size|
|[getState\_Key()](./IPCB_PrimitiveAttribute.md)||Get the property state: Key|
|[getState\_KeyVisible()](./IPCB_PrimitiveAttribute.md)||Get the property state: Key whether it is visible|
|[getState\_Layer()](./IPCB_PrimitiveAttribute.md)||Get the property state: Layer|
|[getState\_LineWidth()](./IPCB_PrimitiveAttribute.md)||Get the property state: Line width|
|[getState\_Mirror()](./IPCB_PrimitiveAttribute.md)||Get the property state: whether it is mirrored|
|[getState\_ParentPrimitiveId()](./IPCB_PrimitiveAttribute.md)||Get the property state: associated parent primitive ID|
|[getState\_PrimitiveId()](./IPCB_PrimitiveAttribute.md)||Get the property state: primitive ID|
|[getState\_PrimitiveLock()](./IPCB_PrimitiveAttribute.md)||Get the property state: whether it is locked|
|[getState\_PrimitiveType()](./IPCB_PrimitiveAttribute.md)||Get the property state: primitive type|
|[getState\_Reverse()](./IPCB_PrimitiveAttribute.md)||Get the property state: whether it is inverted|
|[getState\_Rotation()](./IPCB_PrimitiveAttribute.md)||Get the property state: rotation angle|
|[getState\_Value()](./IPCB_PrimitiveAttribute.md)||Get the property state: Value|
|[getState\_ValueVisible()](./IPCB_PrimitiveAttribute.md)||Get the property state: Value whether it is visible|
|[getState\_X()](./IPCB_PrimitiveAttribute.md)||Get the property state: X coordinate|
|[getState\_Y()](./IPCB_PrimitiveAttribute.md)||Get the property state: Y coordinate|
|[isAsync()](./IPCB_PrimitiveAttribute.md)||Query whether the primitive is an async primitive|
|[reset()](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Reset the async primitive to the current canvas state|
|[setState\_AlignMode(alignMode)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: alignment mode|
|[setState\_Expansion(expansion)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: inverted expansion|
|[setState\_FontFamily(fontFamily)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: font|
|[setState\_FontSize(fontSize)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: font size|
|[setState\_Key(key)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Key|
|[setState\_KeyVisible(keyVisible)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Key whether it is visible|
|[setState\_Layer(layer)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Layer|
|[setState\_LineWidth(lineWidth)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Line width|
|[setState\_Mirror(mirror)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: whether it is mirrored|
|[setState\_PrimitiveLock(primitiveLock)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: whether it is locked|
|[setState\_Reverse(reverse)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: whether it is inverted|
|[setState\_Rotation(rotation)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: rotation angle|
|[setState\_Value(value)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Value|
|[setState\_ValueVisible(valueVisible)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Value whether it is visible|
|[setState\_X(x)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: X coordinate|
|[setState\_Y(y)](./IPCB_PrimitiveAttribute.md)||**_(BETA)_** Set the property state: Y coordinate|
|[toAsync()](./IPCB_PrimitiveAttribute.md)||Convert Primitive to Async primitive|
|[toSync()](./IPCB_PrimitiveAttribute.md)||Convert Primitive to Sync primitive|

---

## 构造函数详情

### _constructor_

# IPCB\_PrimitiveAttribute.(constructor)

Constructs a new instance of the `IPCB_PrimitiveAttribute` class

## Signature

```typescript
function constructor(
	layer: TPCB_LayersOfImage,
	x: number | null,
	y: number | null,
	key: string,
	value: string,
	keyVisible: boolean,
	valueVisible: boolean,
	fontFamily: string,
	fontSize: number,
	lineWidth: number,
	alignMode: EPCB_PrimitiveStringAlignMode,
	rotation: number,
	reverse: boolean,
	expansion: number,
	mirror: boolean,
	primitiveLock: boolean,
	primitiveId: string,
	parentPrimitiveId: string,
);
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfImage](../types/TPCB_LayersOfImage.md)||
|x|number \| null||
|y|number \| null||
|key|string||
|value|string||
|keyVisible|boolean||
|valueVisible|boolean||
|fontFamily|string||
|fontSize|number||
|lineWidth|number||
|alignMode|[EPCB\_PrimitiveStringAlignMode](../enums/EPCB_PrimitiveStringAlignMode.md)||
|rotation|number||
|reverse|boolean||
|expansion|number||
|mirror|boolean||
|primitiveLock|boolean||
|primitiveId|string||
|parentPrimitiveId|string||

---

## 方法详情

### done

# IPCB\_PrimitiveAttribute.done() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Apply the changes to the primitives to the canvas

## Signature

```typescript
function done(): Promise<IPCB_PrimitiveAttribute>;
```

## Returns

Promise&lt;[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)<!-- -->&gt;

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 记录修改前的字号和旋转角度
const fontSizeBefore = designator.getState_FontSize();
const rotationBefore = designator.getState_Rotation();

// 4. 批量修改两个属性，一次 done() 提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_FontSize(60);
asyncAttr.setState_Rotation(90);
await asyncAttr.done();

// 5. 从画布重新读取，确认批量修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('fontSize:', fontSizeBefore, '→', refetched.getState_FontSize());
console.log('rotation:', rotationBefore, '→', refetched.getState_Rotation());
```


### getstate_alignmode

# IPCB\_PrimitiveAttribute.getState\_AlignMode() method

Get the property state: alignment mode

## Signature

```typescript
function getState_AlignMode(): EPCB_PrimitiveStringAlignMode;
```

## Returns

[EPCB\_PrimitiveStringAlignMode](../enums/EPCB_PrimitiveStringAlignMode.md)

Alignment mode

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取文本对齐模式
const alignMode = designator.getState_AlignMode();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('alignMode:', alignMode);
```


### getstate_expansion

# IPCB\_PrimitiveAttribute.getState\_Expansion() method

Get the property state: inverted expansion

## Signature

```typescript
function getState_Expansion(): number;
```

## Returns

number

Inverted expansion

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取反相扩展值
const expansion = designator.getState_Expansion();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('expansion:', expansion);
```


### getstate_fontfamily

# IPCB\_PrimitiveAttribute.getState\_FontFamily() method

Get the property state: font

## Signature

```typescript
function getState_FontFamily(): string;
```

## Returns

string

Font

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取字体名
const fontFamily = designator.getState_FontFamily();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('fontFamily:', fontFamily);
```


### getstate_fontsize

# IPCB\_PrimitiveAttribute.getState\_FontSize() method

Get the property state: font size

## Signature

```typescript
function getState_FontSize(): number;
```

## Returns

number

Font size

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取字号
const fontSize = designator.getState_FontSize();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('fontSize:', fontSize);
```


### getstate_key

# IPCB\_PrimitiveAttribute.getState\_Key() method

Get the property state: Key

## Signature

```typescript
function getState_Key(): string;
```

## Returns

string

Key

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的全部属性图元
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);

// 3. 读取每个属性的 Key（属性名）
const keys = attrs.map(a => a.getState_Key());

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('keys:', keys.join(', '));
```


### getstate_keyvisible

# IPCB\_PrimitiveAttribute.getState\_KeyVisible() method

Get the property state: Key whether it is visible

## Signature

```typescript
function getState_KeyVisible(): boolean;
```

## Returns

boolean

Key whether it is visible

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取 Key 可见性
const keyVisible = designator.getState_KeyVisible();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('keyVisible:', keyVisible);
```


### getstate_layer

# IPCB\_PrimitiveAttribute.getState\_Layer() method

Get the property state: Layer

## Signature

```typescript
function getState_Layer(): TPCB_LayersOfImage;
```

## Returns

[TPCB\_LayersOfImage](../types/TPCB_LayersOfImage.md)

Layer

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取所在层
const layer = designator.getState_Layer();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('layer:', layer);
```


### getstate_linewidth

# IPCB\_PrimitiveAttribute.getState\_LineWidth() method

Get the property state: Line width

## Signature

```typescript
function getState_LineWidth(): number;
```

## Returns

number

Line width

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取线宽
const lineWidth = designator.getState_LineWidth();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('lineWidth:', lineWidth);
```


### getstate_mirror

# IPCB\_PrimitiveAttribute.getState\_Mirror() method

Get the property state: whether it is mirrored

## Signature

```typescript
function getState_Mirror(): boolean;
```

## Returns

boolean

Whether it is mirrored

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取镜像状态
const mirror = designator.getState_Mirror();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('mirror:', mirror);
```


### getstate_parentprimitiveid

# IPCB\_PrimitiveAttribute.getState\_ParentPrimitiveId() method

Get the property state: associated parent primitive ID

## Signature

```typescript
function getState_ParentPrimitiveId(): string;
```

## Returns

string

Associated parent primitive ID

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取父图元 ID
const parentPrimitiveId = designator.getState_ParentPrimitiveId();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('parentPrimitiveId:', parentPrimitiveId);
console.log('belongs to component:', parentPrimitiveId === compId);
```


### getstate_primitiveid

# IPCB\_PrimitiveAttribute.getState\_PrimitiveId() method

Get the property state: primitive ID

## Signature

```typescript
function getState_PrimitiveId(): string;
```

## Returns

string

Primitive ID

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取属性图元 ID
const primitiveId = designator.getState_PrimitiveId();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('primitiveId:', primitiveId);
```


### getstate_primitivelock

# IPCB\_PrimitiveAttribute.getState\_PrimitiveLock() method

Get the property state: whether it is locked

## Signature

```typescript
function getState_PrimitiveLock(): boolean;
```

## Returns

boolean

Whether it is locked

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取锁定状态
const primitiveLock = designator.getState_PrimitiveLock();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('primitiveLock:', primitiveLock);
```


### getstate_primitivetype

# IPCB\_PrimitiveAttribute.getState\_PrimitiveType() method

Get the property state: primitive type

## Signature

```typescript
function getState_PrimitiveType(): EPCB_PrimitiveType;
```

## Returns

[EPCB\_PrimitiveType](../enums/EPCB_PrimitiveType.md)

Primitive type

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取图元类型
const primitiveType = designator.getState_PrimitiveType();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('primitiveType:', primitiveType);
```


### getstate_reverse

# IPCB\_PrimitiveAttribute.getState\_Reverse() method

Get the property state: whether it is inverted

## Signature

```typescript
function getState_Reverse(): boolean;
```

## Returns

boolean

Whether it is inverted

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取反相状态
const reverse = designator.getState_Reverse();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('reverse:', reverse);
```


### getstate_rotation

# IPCB\_PrimitiveAttribute.getState\_Rotation() method

Get the property state: rotation angle

## Signature

```typescript
function getState_Rotation(): number;
```

## Returns

number

Rotation angle

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取旋转角度
const rotation = designator.getState_Rotation();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('rotation:', rotation);
```


### getstate_value

# IPCB\_PrimitiveAttribute.getState\_Value() method

Get the property state: Value

## Signature

```typescript
function getState_Value(): string;
```

## Returns

string

Value

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取属性值
const value = designator.getState_Value();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('value:', value);
```


### getstate_valuevisible

# IPCB\_PrimitiveAttribute.getState\_ValueVisible() method

Get the property state: Value whether it is visible

## Signature

```typescript
function getState_ValueVisible(): boolean;
```

## Returns

boolean

Value whether it is visible

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取 Value 可见性
const valueVisible = designator.getState_ValueVisible();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('valueVisible:', valueVisible);
```


### getstate_x

# IPCB\_PrimitiveAttribute.getState\_X() method

Get the property state: X coordinate

## Signature

```typescript
function getState_X(): number | null;
```

## Returns

number \| null

X coordinate

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取锚点 X 坐标
const x = designator.getState_X();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('x:', x);
```


### getstate_y

# IPCB\_PrimitiveAttribute.getState\_Y() method

Get the property state: Y coordinate

## Signature

```typescript
function getState_Y(): number | null;
```

## Returns

number \| null

Y coordinate

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取锚点 Y 坐标
const y = designator.getState_Y();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('y:', y);
```


### isasync

# IPCB\_PrimitiveAttribute.isAsync() method

Query whether the primitive is an async primitive

## Signature

```typescript
function isAsync(): boolean;
```

## Returns

boolean

Whether Is async primitive

## Example

```javascript
// 1. 放置一个测试器件（属性图元随器件生成，无法单独创建）
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, 5000, 5000);
const compId = comp.getState_PrimitiveId();

// 2. 取出器件的属性图元，定位 Designator（编号）属性
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(compId);
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 查询异步状态
const isAsync = designator.isAsync();

// 4. 清理测试器件（属性图元随器件一起删除）
await eda.pcb_PrimitiveComponent.delete([compId]);

console.log('isAsync:', isAsync);
```


### reset

# IPCB\_PrimitiveAttribute.reset() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Reset the async primitive to the current canvas state

## Signature

```typescript
function reset(): Promise<IPCB_PrimitiveAttribute>;
```

## Returns

Promise&lt;[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)<!-- -->&gt;

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 记录画布上的原始值
const original = designator.getState_Value();

// 4. 异步模式下改一个错误值，但不提交，直接 reset() 丢弃
const asyncAttr = designator.toAsync();
asyncAttr.setState_Value('SHOULD-DISCARD');
await asyncAttr.reset();

// 5. 从画布重新读取，确认值仍是原始值（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('value:', original, '→', refetched.getState_Value(), '(修改已丢弃)');
```


### setstate_alignmode

# IPCB\_PrimitiveAttribute.setState\_AlignMode() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: alignment mode

## Signature

```typescript
function setState_AlignMode(alignMode: EPCB_PrimitiveStringAlignMode): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|alignMode|[EPCB\_PrimitiveStringAlignMode](../enums/EPCB_PrimitiveStringAlignMode.md)|Alignment mode|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的对齐模式
const before = designator.getState_AlignMode();

// 4. 切换异步模式改为居中对齐并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_AlignMode(5);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('alignMode:', before, '→', refetched.getState_AlignMode());
```


### setstate_expansion

# IPCB\_PrimitiveAttribute.setState\_Expansion() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: inverted expansion

## Signature

```typescript
function setState_Expansion(expansion: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|expansion|number|Inverted expansion|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的反相扩展
const before = designator.getState_Expansion();

// 4. 切换异步模式加大衬底扩展并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Expansion(8);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('expansion:', before, '→', refetched.getState_Expansion());
```


### setstate_fontfamily

# IPCB\_PrimitiveAttribute.setState\_FontFamily() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: font

## Signature

```typescript
function setState_FontFamily(fontFamily: string): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fontFamily|string|Font|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的字体
const before = designator.getState_FontFamily();

// 4. 切换异步模式换成 Arial 并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_FontFamily('Arial');
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('fontFamily:', before, '→', refetched.getState_FontFamily());
```


### setstate_fontsize

# IPCB\_PrimitiveAttribute.setState\_FontSize() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: font size

## Signature

```typescript
function setState_FontSize(fontSize: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fontSize|number|Font size|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的字号
const before = designator.getState_FontSize();

// 4. 切换异步模式加大字号并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_FontSize(60);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('fontSize:', before, '→', refetched.getState_FontSize());
```


### setstate_key

# IPCB\_PrimitiveAttribute.setState\_Key() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Key

## Signature

```typescript
function setState_Key(key: string): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|key|string|Key|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的属性名
const before = designator.getState_Key();

// 4. 切换异步模式重命名属性并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Key('Ref');
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('key:', before, '→', refetched.getState_Key());
```


### setstate_keyvisible

# IPCB\_PrimitiveAttribute.setState\_KeyVisible() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Key whether it is visible

## Signature

```typescript
function setState_KeyVisible(keyVisible: boolean): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|keyVisible|boolean|Key whether it is visible|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的 Key 可见性
const before = designator.getState_KeyVisible();

// 4. 切换异步模式打开 Key 显示并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_KeyVisible(true);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('keyVisible:', before, '→', refetched.getState_KeyVisible());
```


### setstate_layer

# IPCB\_PrimitiveAttribute.setState\_Layer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Layer

## Signature

```typescript
function setState_Layer(layer: TPCB_LayersOfImage): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfImage](../types/TPCB_LayersOfImage.md)|Layer|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的层
const before = designator.getState_Layer();

// 4. 切换异步模式挪到底层丝印（4）并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Layer(4);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('layer:', before, '→', refetched.getState_Layer());
```


### setstate_linewidth

# IPCB\_PrimitiveAttribute.setState\_LineWidth() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Line width

## Signature

```typescript
function setState_LineWidth(lineWidth: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|lineWidth|number|Line width|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的线宽
const before = designator.getState_LineWidth();

// 4. 切换异步模式加粗笔画并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_LineWidth(10);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('lineWidth:', before, '→', refetched.getState_LineWidth());
```


### setstate_mirror

# IPCB\_PrimitiveAttribute.setState\_Mirror() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is mirrored

## Signature

```typescript
function setState_Mirror(mirror: boolean): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|mirror|boolean|Whether it is mirrored|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的镜像状态
const before = designator.getState_Mirror();

// 4. 切换异步模式打开镜像并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Mirror(true);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('mirror:', before, '→', refetched.getState_Mirror());
```


### setstate_primitivelock

# IPCB\_PrimitiveAttribute.setState\_PrimitiveLock() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is locked

## Signature

```typescript
function setState_PrimitiveLock(primitiveLock: boolean): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveLock|boolean|Whether it is locked|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的锁定状态
const before = designator.getState_PrimitiveLock();

// 4. 切换异步模式锁定属性并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_PrimitiveLock(true);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('primitiveLock:', before, '→', refetched.getState_PrimitiveLock());
```


### setstate_reverse

# IPCB\_PrimitiveAttribute.setState\_Reverse() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is inverted

## Signature

```typescript
function setState_Reverse(reverse: boolean): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|reverse|boolean|Whether it is inverted|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Remarks

The default font does not support inversion

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的反相状态
const before = designator.getState_Reverse();

// 4. 切换异步模式：先换 Arial 字体（default 不支持反相），再开反相并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_FontFamily('Arial');
asyncAttr.setState_Reverse(true);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('reverse:', before, '→', refetched.getState_Reverse());
```


### setstate_rotation

# IPCB\_PrimitiveAttribute.setState\_Rotation() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: rotation angle

## Signature

```typescript
function setState_Rotation(rotation: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|rotation|number|Rotation angle|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的旋转角度
const before = designator.getState_Rotation();

// 4. 切换异步模式旋转 90° 并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Rotation(90);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('rotation:', before, '→', refetched.getState_Rotation());
```


### setstate_value

# IPCB\_PrimitiveAttribute.setState\_Value() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Value

## Signature

```typescript
function setState_Value(value: string): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|value|string|Value|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的属性值
const before = designator.getState_Value();

// 4. 切换异步模式修改属性值并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Value(`${before}-MOD`);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('value:', before, '→', refetched.getState_Value());
```


### setstate_valuevisible

# IPCB\_PrimitiveAttribute.setState\_ValueVisible() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Value whether it is visible

## Signature

```typescript
function setState_ValueVisible(valueVisible: boolean): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|valueVisible|boolean|Value whether it is visible|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的 Value 可见性
const before = designator.getState_ValueVisible();

// 4. 切换异步模式隐藏编号文本并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_ValueVisible(false);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('valueVisible:', before, '→', refetched.getState_ValueVisible());
```


### setstate_x

# IPCB\_PrimitiveAttribute.setState\_X() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: X coordinate

## Signature

```typescript
function setState_X(x: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|x|number|X coordinate|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的锚点 X 坐标
const before = designator.getState_X();

// 4. 切换异步模式向右移动 300mil 并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_X(before + 300);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('x:', before, '→', refetched.getState_X());
```


### setstate_y

# IPCB\_PrimitiveAttribute.setState\_Y() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Y coordinate

## Signature

```typescript
function setState_Y(y: number): IPCB_PrimitiveAttribute;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|y|number|Y coordinate|

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的锚点 Y 坐标
const before = designator.getState_Y();

// 4. 切换异步模式向上移动 300mil 并提交
const asyncAttr = designator.toAsync();
asyncAttr.setState_Y(before + 300);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('y:', before, '→', refetched.getState_Y());
```


### toasync

# IPCB\_PrimitiveAttribute.toAsync() method

Convert Primitive to Async primitive

## Signature

```typescript
function toAsync(): IPCB_PrimitiveAttribute;
```

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 转换为异步句柄并确认其异步状态
const asyncAttr = designator.toAsync();

// 4. 通过异步句柄修改字号并提交
asyncAttr.setState_FontSize(60);
await asyncAttr.done();

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('isAsync:', asyncAttr.isAsync());
console.log('fontSize:', refetched.getState_FontSize());
```


### tosync

# IPCB\_PrimitiveAttribute.toSync() method

Convert Primitive to Sync primitive

## Signature

```typescript
function toSync(): IPCB_PrimitiveAttribute;
```

## Returns

[IPCB\_PrimitiveAttribute](./IPCB_PrimitiveAttribute.md)

Attribute primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试器件重合
const x = 20000 + Math.floor(Math.random() * 80000);
const y = 20000 + Math.floor(Math.random() * 80000);

// 2. 放置测试器件并取出 Designator（编号）属性
const devices = await eda.lib_Device.search('C0402');
const comp = await eda.pcb_PrimitiveComponent.create(devices[0], 1, x, y);
const attrIds = await eda.pcb_PrimitiveAttribute.getAllPrimitiveId(comp.getState_PrimitiveId());
const attrs = await eda.pcb_PrimitiveAttribute.get(attrIds);
const designator = attrs.find(a => a.getState_Key() === 'Designator');

// 3. 读取修改前的属性值
const before = designator.getState_Value();

// 4. 转换为同步图元后直接修改，立即生效（无需 done()）
const syncAttr = designator.toSync();
syncAttr.setState_Value(`${before}-SYNC`);

// 5. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveAttribute.get(designator.getState_PrimitiveId());

console.log('value:', before, '→', refetched.getState_Value());
```
