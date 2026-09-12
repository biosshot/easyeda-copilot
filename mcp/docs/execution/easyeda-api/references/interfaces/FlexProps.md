# FlexProps interface

布局容器：灵活的 Flex 布局容器

## Signature

```typescript
interface FlexProps extends StyleProps
```
**Extends:** [StyleProps](./StyleProps.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[alignX?](./FlexProps.md)||'start' \| 'center' \| 'end'|_(Optional)_ Main axis alignment (horizontal)|
|[alignY?](./FlexProps.md)||'start' \| 'center' \| 'end' \| 'stretch'|_(Optional)_ Cross axis alignment (vertical)|
|[children?](./FlexProps.md)||any|_(Optional)_ Child node|
|[classes?](./FlexProps.md)||string\[\]|_(Optional)_ List of additional style class names|
|[direction?](./FlexProps.md)||'column' \| 'column-reverse' \| 'row' \| 'row-reverse'|_(Optional)_ Main axis direction: row (horizontal) / column (vertical, including reverse)|
|[gap?](./FlexProps.md)||number|_(Optional)_ Gap between child elements (pixels)|
|[onClick?](./FlexProps.md)||() =&gt; void|_(Optional)_ 点击容器时触发|

---

## 属性详情

### alignx

# FlexProps.alignX property

Main axis alignment (horizontal)

## Signature

```typescript
alignX?: 'start' | 'center' | 'end';
```

### aligny

# FlexProps.alignY property

Cross axis alignment (vertical)

## Signature

```typescript
alignY?: 'start' | 'center' | 'end' | 'stretch';
```

### children

# FlexProps.children property

Child node

## Signature

```typescript
children?: any;
```

### classes

# FlexProps.classes property

List of additional style class names

## Signature

```typescript
classes?: string[];
```

### direction

# FlexProps.direction property

Main axis direction: row (horizontal) / column (vertical, including reverse)

## Signature

```typescript
direction?: 'column' | 'column-reverse' | 'row' | 'row-reverse';
```

### gap

# FlexProps.gap property

Gap between child elements (pixels)

## Signature

```typescript
gap?: number;
```

### onclick

# FlexProps.onClick property

点击容器时触发

## Signature

```typescript
onClick?: () => void;
```
