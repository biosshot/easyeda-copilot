# StyleProps interface

通用样式属性：可被布局容器等组件继承的样式集合

## Signature

```typescript
interface StyleProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[backgroundColor?](./StyleProps.md)||string|_(Optional)_ Background color. Accepts any CSS color value|
|[borderColor?](./StyleProps.md)||string|_(Optional)_ Border color. Only takes effect when borderWidth &gt; 0|
|[borderWidth?](./StyleProps.md)||number|_(Optional)_ Border width (pixels). Takes effect when &gt; 0|
|[color?](./StyleProps.md)||string|_(Optional)_ Text color. Accepts any CSS color value|
|[cursor?](./StyleProps.md)||'pointer' \| 'default' \| 'none' \| 'move' \| 'text'|_(Optional)_ Cursor style when the mouse hovers|
|[display?](./StyleProps.md)||string|_(Optional)_ Override the display style|
|[height?](./StyleProps.md)||number \| '100%'|_(Optional)_ Height ( pixels) or '100%'|
|[hide?](./StyleProps.md)||boolean|_(Optional)_ Whether to hide (display: none), taking precedence over invisible|
|[invisible?](./StyleProps.md)||boolean|_(Optional)_ Whether to only hide visually (visibility: hidden), still occupying space|
|[margin?](./StyleProps.md)||number\[\]|_(Optional)_ Margin (CSS shorthand), e.g. \[top, right, bottom, left\] or \[vertical, horizontal\] or \[all\]|
|[padding?](./StyleProps.md)||number\[\]|_(Optional)_ Padding (CSS shorthand), e.g. \[top, right, bottom, left\] or \[vertical, horizontal\] or \[all\]|
|[rotate?](./StyleProps.md)||number|_(Optional)_ Rotation angle (degrees)|
|[width?](./StyleProps.md)||number \| '100%'|_(Optional)_ Width ( pixels) or '100%'|

---

## 属性详情

### backgroundcolor

# StyleProps.backgroundColor property

Background color. Accepts any CSS color value

## Signature

```typescript
backgroundColor?: string;
```

### bordercolor

# StyleProps.borderColor property

Border color. Only takes effect when borderWidth &gt; 0

## Signature

```typescript
borderColor?: string;
```

### borderwidth

# StyleProps.borderWidth property

Border width (pixels). Takes effect when &gt; 0

## Signature

```typescript
borderWidth?: number;
```

### color

# StyleProps.color property

Text color. Accepts any CSS color value

## Signature

```typescript
color?: string;
```

### cursor

# StyleProps.cursor property

Cursor style when the mouse hovers

## Signature

```typescript
cursor?: 'pointer' | 'default' | 'none' | 'move' | 'text';
```

### display

# StyleProps.display property

Override the display style

## Signature

```typescript
display?: string;
```

### height

# StyleProps.height property

Height ( pixels) or '100%'

## Signature

```typescript
height?: number | '100%';
```

### hide

# StyleProps.hide property

Whether to hide (display: none), taking precedence over invisible

## Signature

```typescript
hide?: boolean;
```

### invisible

# StyleProps.invisible property

Whether to only hide visually (visibility: hidden), still occupying space

## Signature

```typescript
invisible?: boolean;
```

### margin

# StyleProps.margin property

Margin (CSS shorthand), e.g. \[top, right, bottom, left\] or \[vertical, horizontal\] or \[all\]

## Signature

```typescript
margin?: number[];
```

### padding

# StyleProps.padding property

Padding (CSS shorthand), e.g. \[top, right, bottom, left\] or \[vertical, horizontal\] or \[all\]

## Signature

```typescript
padding?: number[];
```

### rotate

# StyleProps.rotate property

Rotation angle (degrees)

## Signature

```typescript
rotate?: number;
```

### width

# StyleProps.width property

Width ( pixels) or '100%'

## Signature

```typescript
width?: number | '100%';
```
