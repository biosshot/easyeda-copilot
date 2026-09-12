# ModalProps interface

模态弹窗：可拖拽、可调整大小的顶层弹窗

## Signature

```typescript
interface ModalProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[children?](./ModalProps.md)||any|_(Optional)_ Popup content child nodes|
|[height](./ModalProps.md)||number \| 'auto'|Height ( pixels, required)|
|[hide?](./ModalProps.md)||boolean|_(Optional)_ Whether to hide the popup|
|[left](./ModalProps.md)||number|Position from the left (pixels, required)|
|[maxDragX?](./ModalProps.md)||number|_(Optional)_ Maximum horizontal drag distance (pixels)|
|[maxDragY?](./ModalProps.md)||number|_(Optional)_ Maximum vertical drag distance ( pixels)|
|[onMoved?](./ModalProps.md)||(top: number, left: number) =&gt; void|_(Optional)_ 弹窗移动时触发，参数为新位置|
|[overlay?](./ModalProps.md)||boolean|_(Optional)_ Whether to show the mask layer|
|[resizeX?](./ModalProps.md)||boolean|_(Optional)_ Whether horizontal resizing is allowed|
|[resizeY?](./ModalProps.md)||boolean|_(Optional)_ Whether vertical resizing is allowed|
|[top](./ModalProps.md)||number|Position from the top (pixels, required)|
|[width](./ModalProps.md)||number|Width ( pixels, required)|

---

## 属性详情

### children

# ModalProps.children property

Popup content child nodes

## Signature

```typescript
children?: any;
```

### height

# ModalProps.height property

Height ( pixels, required)

## Signature

```typescript
height: number | 'auto';
```

### hide

# ModalProps.hide property

Whether to hide the popup

## Signature

```typescript
hide?: boolean;
```

### left

# ModalProps.left property

Position from the left (pixels, required)

## Signature

```typescript
left: number;
```

### maxdragx

# ModalProps.maxDragX property

Maximum horizontal drag distance (pixels)

## Signature

```typescript
maxDragX?: number;
```

### maxdragy

# ModalProps.maxDragY property

Maximum vertical drag distance ( pixels)

## Signature

```typescript
maxDragY?: number;
```

### onmoved

# ModalProps.onMoved property

弹窗移动时触发，参数为新位置

## Signature

```typescript
onMoved?: (top: number, left: number) => void;
```

### overlay

# ModalProps.overlay property

Whether to show the mask layer

## Signature

```typescript
overlay?: boolean;
```

### resizex

# ModalProps.resizeX property

Whether horizontal resizing is allowed

## Signature

```typescript
resizeX?: boolean;
```

### resizey

# ModalProps.resizeY property

Whether vertical resizing is allowed

## Signature

```typescript
resizeY?: boolean;
```

### top

# ModalProps.top property

Position from the top (pixels, required)

## Signature

```typescript
top: number;
```

### width

# ModalProps.width property

Width ( pixels, required)

## Signature

```typescript
width: number;
```
