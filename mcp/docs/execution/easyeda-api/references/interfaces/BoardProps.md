# BoardProps interface

分组面板：带标题的可折叠/分组容器

## Signature

```typescript
interface BoardProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[bgColor?](./BoardProps.md)||string|_(Optional)_ Background color. Accepts any CSS color value|
|[children?](./BoardProps.md)||any|_(Optional)_ Panel content child nodes|
|[onClick?](./BoardProps.md)||() =&gt; void|_(Optional)_ 点击面板时触发|
|[padding?](./BoardProps.md)||number\[\]|_(Optional)_ Padding (CSS shorthand array)|
|[title](./BoardProps.md)||string|Title text ( required)|

---

## 属性详情

### bgcolor

# BoardProps.bgColor property

Background color. Accepts any CSS color value

## Signature

```typescript
bgColor?: string;
```

### children

# BoardProps.children property

Panel content child nodes

## Signature

```typescript
children?: any;
```

### onclick

# BoardProps.onClick property

点击面板时触发

## Signature

```typescript
onClick?: () => void;
```

### padding

# BoardProps.padding property

Padding (CSS shorthand array)

## Signature

```typescript
padding?: number[];
```

### title

# BoardProps.title property

Title text ( required)

## Signature

```typescript
title: string;
```
