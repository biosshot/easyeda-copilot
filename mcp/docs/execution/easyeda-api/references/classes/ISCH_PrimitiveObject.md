# ISCH\_PrimitiveObject class

Binary embedded object primitive

## Signature

```typescript
class ISCH_PrimitiveObject implements ISCH_Primitive
```
**Implements:** [ISCH\_Primitive](../interfaces/ISCH_Primitive.md)

## Remarks

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[done()](./ISCH_PrimitiveObject.md)||**_(BETA)_** Apply the changes to the primitives to the canvas|
|[getState\_Content()](./ISCH_PrimitiveObject.md)||Get the property state: object content|
|[getState\_FileName()](./ISCH_PrimitiveObject.md)||Get the property state: file name|
|[getState\_Height()](./ISCH_PrimitiveObject.md)||Get the property state: height|
|[getState\_Mirror()](./ISCH_PrimitiveObject.md)||Get the property state: whether it is mirrored|
|[getState\_PrimitiveId()](./ISCH_PrimitiveObject.md)||Get the property state: primitive ID|
|[getState\_PrimitiveType()](./ISCH_PrimitiveObject.md)||Get the property state: primitive type|
|[getState\_Rotation()](./ISCH_PrimitiveObject.md)||Get the property state: rotation angle|
|[getState\_StartX()](./ISCH_PrimitiveObject.md)||Get the property state: X coordinate|
|[getState\_StartY()](./ISCH_PrimitiveObject.md)||Get the property state: Y coordinate|
|[getState\_Width()](./ISCH_PrimitiveObject.md)||Get the property state: width|
|[isAsync()](./ISCH_PrimitiveObject.md)||Query whether the primitive is an async primitive|
|[reset()](./ISCH_PrimitiveObject.md)||**_(BETA)_** Reset the async primitive to the current canvas state|
|[setState\_Content(content)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: object content|
|[setState\_FileName(fileName)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: file name|
|[setState\_Height(height)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: height|
|[setState\_Mirror(mirror)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: whether it is mirrored|
|[setState\_Rotation(rotation)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: rotation angle|
|[setState\_StartX(startX)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: start point coordinates X|
|[setState\_StartY(startY)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: start point coordinates Y|
|[setState\_Width(width)](./ISCH_PrimitiveObject.md)||**_(BETA)_** Set the property state: width|
|[toAsync()](./ISCH_PrimitiveObject.md)||Convert Primitive to Async primitive|
|[toSync()](./ISCH_PrimitiveObject.md)||Convert Primitive to Sync primitive|

---

## 方法详情

### done

# ISCH\_PrimitiveObject.done() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Apply the changes to the primitives to the canvas

## Signature

```typescript
function done(): Promise<ISCH_PrimitiveObject>;
```

## Returns

Promise&lt;[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)<!-- -->&gt;

Binary embedded object primitive object

### getstate_content

# ISCH\_PrimitiveObject.getState\_Content() method

Get the property state: object content

## Signature

```typescript
function getState_Content(): File | string;
```

## Returns

File \| string

Object content

### getstate_filename

# ISCH\_PrimitiveObject.getState\_FileName() method

Get the property state: file name

## Signature

```typescript
function getState_FileName(): string;
```

## Returns

string

File name

### getstate_height

# ISCH\_PrimitiveObject.getState\_Height() method

Get the property state: height

## Signature

```typescript
function getState_Height(): number;
```

## Returns

number

Height

### getstate_mirror

# ISCH\_PrimitiveObject.getState\_Mirror() method

Get the property state: whether it is mirrored

## Signature

```typescript
function getState_Mirror(): boolean;
```

## Returns

boolean

Whether it is mirrored

### getstate_primitiveid

# ISCH\_PrimitiveObject.getState\_PrimitiveId() method

Get the property state: primitive ID

## Signature

```typescript
function getState_PrimitiveId(): string;
```

## Returns

string

Primitive ID

### getstate_primitivetype

# ISCH\_PrimitiveObject.getState\_PrimitiveType() method

Get the property state: primitive type

## Signature

```typescript
function getState_PrimitiveType(): ESCH_PrimitiveType;
```

## Returns

[ESCH\_PrimitiveType](../enums/ESCH_PrimitiveType.md)

Primitive type

### getstate_rotation

# ISCH\_PrimitiveObject.getState\_Rotation() method

Get the property state: rotation angle

## Signature

```typescript
function getState_Rotation(): number;
```

## Returns

number

Rotation angle

### getstate_startx

# ISCH\_PrimitiveObject.getState\_StartX() method

Get the property state: X coordinate

## Signature

```typescript
function getState_StartX(): number;
```

## Returns

number

X coordinate

### getstate_starty

# ISCH\_PrimitiveObject.getState\_StartY() method

Get the property state: Y coordinate

## Signature

```typescript
function getState_StartY(): number;
```

## Returns

number

Y coordinate

### getstate_width

# ISCH\_PrimitiveObject.getState\_Width() method

Get the property state: width

## Signature

```typescript
function getState_Width(): number;
```

## Returns

number

Width

### isasync

# ISCH\_PrimitiveObject.isAsync() method

Query whether the primitive is an async primitive

## Signature

```typescript
function isAsync(): boolean;
```

## Returns

boolean

Whether Is async primitive

### reset

# ISCH\_PrimitiveObject.reset() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Reset the async primitive to the current canvas state

## Signature

```typescript
function reset(): Promise<ISCH_PrimitiveObject>;
```

## Returns

Promise&lt;[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)<!-- -->&gt;

Binary embedded object primitive object

### setstate_content

# ISCH\_PrimitiveObject.setState\_Content() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: object content

## Signature

```typescript
function setState_Content(content: File | string): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|content|File \| string|Object content|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_filename

# ISCH\_PrimitiveObject.setState\_FileName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: file name

## Signature

```typescript
function setState_FileName(fileName: string): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|File name|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_height

# ISCH\_PrimitiveObject.setState\_Height() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: height

## Signature

```typescript
function setState_Height(height: number): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|height|number|Height|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_mirror

# ISCH\_PrimitiveObject.setState\_Mirror() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: whether it is mirrored

## Signature

```typescript
function setState_Mirror(mirror: boolean): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|mirror|boolean|Whether it is mirrored|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_rotation

# ISCH\_PrimitiveObject.setState\_Rotation() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: rotation angle

## Signature

```typescript
function setState_Rotation(rotation: number): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|rotation|number|Rotation angle|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_startx

# ISCH\_PrimitiveObject.setState\_StartX() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: start point coordinates X

## Signature

```typescript
function setState_StartX(startX: number): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|startX|number|Start point coordinates X|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_starty

# ISCH\_PrimitiveObject.setState\_StartY() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: start point coordinates Y

## Signature

```typescript
function setState_StartY(startY: number): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|startY|number|Start point coordinates Y|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### setstate_width

# ISCH\_PrimitiveObject.setState\_Width() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the property state: width

## Signature

```typescript
function setState_Width(width: number): ISCH_PrimitiveObject;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|width|number|Width|

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### toasync

# ISCH\_PrimitiveObject.toAsync() method

Convert Primitive to Async primitive

## Signature

```typescript
function toAsync(): ISCH_PrimitiveObject;
```

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object

### tosync

# ISCH\_PrimitiveObject.toSync() method

Convert Primitive to Sync primitive

## Signature

```typescript
function toSync(): ISCH_PrimitiveObject;
```

## Returns

[ISCH\_PrimitiveObject](./ISCH_PrimitiveObject.md)

Binary embedded object primitive object
