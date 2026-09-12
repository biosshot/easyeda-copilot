# IPCB\_PrimitiveString class

Text primitive

## Signature

```typescript
class IPCB_PrimitiveString implements IPCB_Primitive
```
**Implements:** [IPCB\_Primitive](../interfaces/IPCB_Primitive.md)

## Constructors

|Constructor|Modifiers|Description|
|---|---|---|
|[(constructor)(layer, x, y, text, fontFamily, fontSize, lineWidth, alignMode, rotation, reverse, expansion, mirror, primitiveLock, primitiveId)](./IPCB_PrimitiveString.md)||Constructs a new instance of the `IPCB_PrimitiveString` class|

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[done()](./IPCB_PrimitiveString.md)||**_(BETA)_** Apply the changes to the primitives to the canvas|
|[getState\_AlignMode()](./IPCB_PrimitiveString.md)||Get the property state: alignment mode|
|[getState\_Expansion()](./IPCB_PrimitiveString.md)||Get the property state: inverted expansion|
|[getState\_FontFamily()](./IPCB_PrimitiveString.md)||Get the property state: font|
|[getState\_FontSize()](./IPCB_PrimitiveString.md)||Get the property state: font size|
|[getState\_Layer()](./IPCB_PrimitiveString.md)||Get the property state: Layer|
|[getState\_LineWidth()](./IPCB_PrimitiveString.md)||Get the property state: Line width|
|[getState\_Mirror()](./IPCB_PrimitiveString.md)||Get the property state: whether it is mirrored|
|[getState\_PrimitiveId()](./IPCB_PrimitiveString.md)||Get the property state: primitive ID|
|[getState\_PrimitiveLock()](./IPCB_PrimitiveString.md)||Get the property state: whether it is locked|
|[getState\_PrimitiveType()](./IPCB_PrimitiveString.md)||Get the property state: primitive type|
|[getState\_Reverse()](./IPCB_PrimitiveString.md)||Get the property state: whether it is inverted|
|[getState\_Rotation()](./IPCB_PrimitiveString.md)||Get the property state: rotation angle|
|[getState\_Text()](./IPCB_PrimitiveString.md)||Get the property state: text content|
|[getState\_X()](./IPCB_PrimitiveString.md)||Get the property state: X coordinate|
|[getState\_Y()](./IPCB_PrimitiveString.md)||Get the property state: Y coordinate|
|[isAsync()](./IPCB_PrimitiveString.md)||Query whether the primitive is an async primitive|
|[reset()](./IPCB_PrimitiveString.md)||**_(BETA)_** Reset the async primitive to the current canvas state|
|[setState\_AlignMode(alignMode)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: alignment mode|
|[setState\_Expansion(expansion)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: inverted expansion|
|[setState\_FontFamily(fontFamily)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: font|
|[setState\_FontSize(fontSize)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: font size|
|[setState\_Layer(layer)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: Layer|
|[setState\_LineWidth(lineWidth)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: Line width|
|[setState\_Mirror(mirror)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: whether it is mirrored|
|[setState\_PrimitiveLock(primitiveLock)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: whether it is locked|
|[setState\_Reverse(reverse)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: whether it is inverted|
|[setState\_Rotation(rotation)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: rotation angle|
|[setState\_Text(text)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: text content|
|[setState\_X(x)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: X coordinate|
|[setState\_Y(y)](./IPCB_PrimitiveString.md)||**_(BETA)_** Set the property state: Y coordinate|
|[toAsync()](./IPCB_PrimitiveString.md)||Convert Primitive to Async primitive|
|[toSync()](./IPCB_PrimitiveString.md)||Convert Primitive to Sync primitive|

---

## 构造函数详情

### _constructor_

# IPCB\_PrimitiveString.(constructor)

Constructs a new instance of the `IPCB_PrimitiveString` class

## Signature

```typescript
function constructor(
	layer: TPCB_LayersOfImage,
	x: number,
	y: number,
	text: string,
	fontFamily?: string,
	fontSize?: number,
	lineWidth?: number,
	alignMode?: EPCB_PrimitiveStringAlignMode,
	rotation?: number,
	reverse?: boolean,
	expansion?: number,
	mirror?: boolean,
	primitiveLock?: boolean,
	primitiveId?: string,
);
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfImage](../types/TPCB_LayersOfImage.md)||
|x|number||
|y|number||
|text|string||
|fontFamily|string|_(Optional)_|
|fontSize|number|_(Optional)_|
|lineWidth|number|_(Optional)_|
|alignMode|[EPCB\_PrimitiveStringAlignMode](../enums/EPCB_PrimitiveStringAlignMode.md)|_(Optional)_|
|rotation|number|_(Optional)_|
|reverse|boolean|_(Optional)_|
|expansion|number|_(Optional)_|
|mirror|boolean|_(Optional)_|
|primitiveLock|boolean|_(Optional)_|
|primitiveId|string|_(Optional)_|

---

## 方法详情

### done

# IPCB\_PrimitiveString.done() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Apply the changes to the primitives to the canvas

## Signature

```typescript
function done(): Promise<IPCB_PrimitiveString>;
```

## Returns

Promise&lt;[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)<!-- -->&gt;

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Text();

// 3. 异步模式下批量改两个字段（此时画布还没变）
const asyncStr = str.toAsync();
asyncStr.setState_Text('嘉立创示例_DONE');
asyncStr.setState_Rotation(90);
await asyncStr.done();

// 4. 从画布重新读取，确认修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('text:', before, '→', refetched.getState_Text());
console.log('rotation:', refetched.getState_Rotation());
```


### getstate_alignmode

# IPCB\_PrimitiveString.getState\_AlignMode() method

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
// 1. 在顶层丝印（3）放置一行左下（3）对齐的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取对齐模式（1-9：3=左下、5=居中）
const alignMode = str.getState_AlignMode();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('alignMode:', alignMode);
```


### getstate_expansion

# IPCB\_PrimitiveString.getState\_Expansion() method

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
// 1. 在顶层丝印（3）放置一行文本（反相扩展默认 0）
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取反相扩展值
const expansion = str.getState_Expansion();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('expansion:', expansion);
```


### getstate_fontfamily

# IPCB\_PrimitiveString.getState\_FontFamily() method

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
// 1. 在顶层丝印（3）放置一行默认字体的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取字体名
const fontFamily = str.getState_FontFamily();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('fontFamily:', fontFamily);
```


### getstate_fontsize

# IPCB\_PrimitiveString.getState\_FontSize() method

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
// 1. 在顶层丝印（3）放置一行 45mil 字号的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取字号
const fontSize = str.getState_FontSize();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('fontSize:', fontSize);
```


### getstate_layer

# IPCB\_PrimitiveString.getState\_Layer() method

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
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取所在层
const layer = str.getState_Layer();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('layer:', layer);
```


### getstate_linewidth

# IPCB\_PrimitiveString.getState\_LineWidth() method

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
// 1. 在顶层丝印（3）放置一行笔画 6mil 的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取笔画线宽
const lineWidth = str.getState_LineWidth();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('lineWidth:', lineWidth);
```


### getstate_mirror

# IPCB\_PrimitiveString.getState\_Mirror() method

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
// 1. 在顶层丝印（3）放置一行不镜像的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取镜像状态
const mirror = str.getState_Mirror();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('mirror:', mirror);
```


### getstate_primitiveid

# IPCB\_PrimitiveString.getState\_PrimitiveId() method

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
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取图元 ID
const primitiveId = str.getState_PrimitiveId();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([primitiveId]);

console.log('primitiveId:', primitiveId);
```


### getstate_primitivelock

# IPCB\_PrimitiveString.getState\_PrimitiveLock() method

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
// 1. 在顶层丝印（3）放置一行未锁定的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取锁定状态
const primitiveLock = str.getState_PrimitiveLock();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('primitiveLock:', primitiveLock);
```


### getstate_primitivetype

# IPCB\_PrimitiveString.getState\_PrimitiveType() method

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
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取图元类型
const primitiveType = str.getState_PrimitiveType();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('primitiveType:', primitiveType);
```


### getstate_reverse

# IPCB\_PrimitiveString.getState\_Reverse() method

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
// 1. 在顶层丝印（3）放置一行不反相的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取反相状态
const reverse = str.getState_Reverse();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('reverse:', reverse);
```


### getstate_rotation

# IPCB\_PrimitiveString.getState\_Rotation() method

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
// 1. 在顶层丝印（3）放置一行不旋转（0°）的文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取旋转角度
const rotation = str.getState_Rotation();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('rotation:', rotation);
```


### getstate_text

# IPCB\_PrimitiveString.getState\_Text() method

Get the property state: text content

## Signature

```typescript
function getState_Text(): string;
```

## Returns

string

Text content

## Example

```javascript
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取文本内容
const text = str.getState_Text();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('text:', text);
```


### getstate_x

# IPCB\_PrimitiveString.getState\_X() method

Get the property state: X coordinate

## Signature

```typescript
function getState_X(): number;
```

## Returns

number

X coordinate

## Example

```javascript
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取锚点 X 坐标
const anchorX = str.getState_X();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('x:', anchorX);
```


### getstate_y

# IPCB\_PrimitiveString.getState\_Y() method

Get the property state: Y coordinate

## Signature

```typescript
function getState_Y(): number;
```

## Returns

number

Y coordinate

## Example

```javascript
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 读取锚点 Y 坐标
const anchorY = str.getState_Y();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('y:', anchorY);
```


### isasync

# IPCB\_PrimitiveString.isAsync() method

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
// 1. 在顶层丝印（3）放置一行文本
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 2. 查询异步模式
const isAsync = str.isAsync();

// 3. 清理测试图元（查询类案例不留测试对象）
await eda.pcb_PrimitiveString.delete([str.getState_PrimitiveId()]);

console.log('isAsync:', isAsync);
```


### reset

# IPCB\_PrimitiveString.reset() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Reset the async primitive to the current canvas state

## Signature

```typescript
function reset(): Promise<IPCB_PrimitiveString>;
```

## Returns

Promise&lt;[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)<!-- -->&gt;

This primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行不旋转的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Rotation();

// 3. 异步模式下把文本旋转 90°，随后反悔（不调 done()）
const asyncStr = str.toAsync();
asyncStr.setState_Rotation(90);

// 4. reset 丢弃未提交的修改（保留现场供观察）
await asyncStr.reset();

// 5. 从画布重新读取，确认旋转角度没有变
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('rotation:', before, '→', refetched.getState_Rotation());
```


### setstate_alignmode

# IPCB\_PrimitiveString.setState\_AlignMode() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: alignment mode

## Signature

```typescript
function setState_AlignMode(alignMode: EPCB_PrimitiveStringAlignMode): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|alignMode|[EPCB\_PrimitiveStringAlignMode](../enums/EPCB_PrimitiveStringAlignMode.md)|Alignment mode|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行左下（3）对齐的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_AlignMode();

// 3. 异步模式把对齐模式改为居中（5）
const asyncStr = str.toAsync();
asyncStr.setState_AlignMode(5);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('alignMode:', before, '→', refetched.getState_AlignMode());
```


### setstate_expansion

# IPCB\_PrimitiveString.setState\_Expansion() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: inverted expansion

## Signature

```typescript
function setState_Expansion(expansion: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|expansion|number|Inverted expansion|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行反相扩展为 0 的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Expansion();

// 3. 异步模式把反相扩展加大到 10
const asyncStr = str.toAsync();
asyncStr.setState_Expansion(10);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('expansion:', before, '→', refetched.getState_Expansion());
```


### setstate_fontfamily

# IPCB\_PrimitiveString.setState\_FontFamily() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: font

## Signature

```typescript
function setState_FontFamily(fontFamily: string): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fontFamily|string|Font|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行默认字体的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_FontFamily();

// 3. 异步模式把字体换成 Arial
const asyncStr = str.toAsync();
asyncStr.setState_FontFamily('Arial');
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('fontFamily:', before, '→', refetched.getState_FontFamily());
```


### setstate_fontsize

# IPCB\_PrimitiveString.setState\_FontSize() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: font size

## Signature

```typescript
function setState_FontSize(fontSize: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fontSize|number|Font size|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行 45mil 字号的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_FontSize();

// 3. 异步模式把字号加大到 60
const asyncStr = str.toAsync();
asyncStr.setState_FontSize(60);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('fontSize:', before, '→', refetched.getState_FontSize());
```


### setstate_layer

# IPCB\_PrimitiveString.setState\_Layer() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Layer

## Signature

```typescript
function setState_Layer(layer: TPCB_LayersOfImage): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|layer|[TPCB\_LayersOfImage](../types/TPCB_LayersOfImage.md)|Layer|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Layer();

// 3. 异步模式把文本挪到底层丝印（4）
const asyncStr = str.toAsync();
asyncStr.setState_Layer(4);
await asyncStr.done();

// 4. 从画布重新读取，确认层已切换（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('layer:', before, '→', refetched.getState_Layer());
```


### setstate_linewidth

# IPCB\_PrimitiveString.setState\_LineWidth() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Line width

## Signature

```typescript
function setState_LineWidth(lineWidth: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|lineWidth|number|Line width|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行笔画 6mil 的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_LineWidth();

// 3. 异步模式把笔画加粗到 10
const asyncStr = str.toAsync();
asyncStr.setState_LineWidth(10);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('lineWidth:', before, '→', refetched.getState_LineWidth());
```


### setstate_mirror

# IPCB\_PrimitiveString.setState\_Mirror() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is mirrored

## Signature

```typescript
function setState_Mirror(mirror: boolean): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|mirror|boolean|Whether it is mirrored|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行不镜像的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Mirror();

// 3. 异步模式开启镜像
const asyncStr = str.toAsync();
asyncStr.setState_Mirror(true);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('mirror:', before, '→', refetched.getState_Mirror());
```


### setstate_primitivelock

# IPCB\_PrimitiveString.setState\_PrimitiveLock() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is locked

## Signature

```typescript
function setState_PrimitiveLock(primitiveLock: boolean): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|primitiveLock|boolean|Whether it is locked|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行未锁定的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_PrimitiveLock();

// 3. 异步模式锁定文本
const asyncStr = str.toAsync();
asyncStr.setState_PrimitiveLock(true);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('primitiveLock:', before, '→', refetched.getState_PrimitiveLock());
```


### setstate_reverse

# IPCB\_PrimitiveString.setState\_Reverse() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is inverted

## Signature

```typescript
function setState_Reverse(reverse: boolean): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|reverse|boolean|Whether it is inverted|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Remarks

The default font does not support inversion

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行默认字体的文本（默认字体不支持反相）
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Reverse();

// 3. 异步模式先换 Arial 字体再开启反相，一次 done() 同时提交两个修改
const asyncStr = str.toAsync();
asyncStr.setState_FontFamily('Arial');
asyncStr.setState_Reverse(true);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('reverse:', before, '→', refetched.getState_Reverse());
console.log('fontFamily:', refetched.getState_FontFamily());
```


### setstate_rotation

# IPCB\_PrimitiveString.setState\_Rotation() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: rotation angle

## Signature

```typescript
function setState_Rotation(rotation: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|rotation|number|Rotation angle|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行不旋转（0°）的文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Rotation();

// 3. 异步模式把文本旋转 90°（竖排）
const asyncStr = str.toAsync();
asyncStr.setState_Rotation(90);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('rotation:', before, '→', refetched.getState_Rotation());
```


### setstate_text

# IPCB\_PrimitiveString.setState\_Text() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: text content

## Signature

```typescript
function setState_Text(text: string): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|text|string|Text content|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_V1.0', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Text();

// 3. 异步模式把内容改为新版本号
const asyncStr = str.toAsync();
asyncStr.setState_Text('嘉立创示例_V2.0');
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('text:', before, '→', refetched.getState_Text());
```


### setstate_x

# IPCB\_PrimitiveString.setState\_X() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: X coordinate

## Signature

```typescript
function setState_X(x: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|x|number|X coordinate|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_X();

// 3. 异步模式把锚点向右平移 500mil
const asyncStr = str.toAsync();
asyncStr.setState_X(before + 500);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('x:', before, '→', refetched.getState_X());
```


### setstate_y

# IPCB\_PrimitiveString.setState\_Y() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: Y coordinate

## Signature

```typescript
function setState_Y(y: number): IPCB_PrimitiveString;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|y|number|Y coordinate|

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.getState_Y();

// 3. 异步模式把锚点向上平移 500mil
const asyncStr = str.toAsync();
asyncStr.setState_Y(before + 500);
await asyncStr.done();

// 4. 从画布重新读取，确认修改生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('y:', before, '→', refetched.getState_Y());
```


### toasync

# IPCB\_PrimitiveString.toAsync() method

Convert Primitive to Async primitive

## Signature

```typescript
function toAsync(): IPCB_PrimitiveString;
```

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);

// 3. 切换异步模式后批量修改：改内容 + 加大字号
const asyncStr = str.toAsync();
asyncStr.setState_Text('嘉立创示例_批量');
asyncStr.setState_FontSize(60);
await asyncStr.done();

// 4. 从画布重新读取，确认批量修改已生效（保留现场供观察）
const refetched = await eda.pcb_PrimitiveString.get(str.getState_PrimitiveId());

console.log('text:', refetched.getState_Text());
console.log('fontSize:', refetched.getState_FontSize());
```


### tosync

# IPCB\_PrimitiveString.toSync() method

Convert Primitive to Sync primitive

## Signature

```typescript
function toSync(): IPCB_PrimitiveString;
```

## Returns

[IPCB\_PrimitiveString](./IPCB_PrimitiveString.md)

Text primitive object

## Example

```javascript
// 1. 生成本次运行专用的坐标，避免与之前保留的测试图元重合
const x = 2000 + Math.floor(Math.random() * 100000);
const y = 2000 + Math.floor(Math.random() * 100000);

// 2. 在顶层丝印（3）放置一行文本
const str = await eda.pcb_PrimitiveString.create(3, x, y, '嘉立创示例_TEXT', 'default', 45, 6, 3, 0, false, 0, false, false);
const before = str.isAsync();

// 3. 转换为同步图元（保留现场供观察）
const syncStr = str.toSync();
const after = syncStr.isAsync();

// 4. 同步图元直接读取属性，无需提交
console.log('isAsync:', before, '→', after);
console.log('primitiveType:', syncStr.getState_PrimitiveType());
console.log('layer:', syncStr.getState_Layer());
```
