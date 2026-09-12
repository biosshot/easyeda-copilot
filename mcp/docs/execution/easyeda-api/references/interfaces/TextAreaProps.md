# TextAreaProps interface

多行文本输入组件

## Signature

```typescript
interface TextAreaProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[disabled?](./TextAreaProps.md)||boolean|_(Optional)_ Whether Disable input|
|[name?](./TextAreaProps.md)||string|_(Optional)_ Input box name (the form `name` attribute)|
|[onChange?](./TextAreaProps.md)||(value: string) =&gt; void|_(Optional)_ 文本变化时触发，参数为最新值|
|[placeholder?](./TextAreaProps.md)||string|_(Optional)_ Placeholder text|
|[resizable?](./TextAreaProps.md)||\{ x?: boolean; y?: boolean \}|_(Optional)_ Whether it is resizable (x horizontal / y vertical)|
|[value?](./TextAreaProps.md)||string|_(Optional)_ Current text value|

---

## 属性详情

### disabled

# TextAreaProps.disabled property

Whether Disable input

## Signature

```typescript
disabled?: boolean;
```

### name

# TextAreaProps.name property

Input box name (the form `name` attribute)

## Signature

```typescript
name?: string;
```

### onchange

# TextAreaProps.onChange property

文本变化时触发，参数为最新值

## Signature

```typescript
onChange?: (value: string) => void;
```

### placeholder

# TextAreaProps.placeholder property

Placeholder text

## Signature

```typescript
placeholder?: string;
```

### resizable

# TextAreaProps.resizable property

Whether it is resizable (x horizontal / y vertical)

## Signature

```typescript
resizable?: { x?: boolean; y?: boolean };
```

### value

# TextAreaProps.value property

Current text value

## Signature

```typescript
value?: string;
```
