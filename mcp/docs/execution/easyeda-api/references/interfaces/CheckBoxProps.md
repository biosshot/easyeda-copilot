# CheckBoxProps interface

复选框组件：可勾选的状态控件

## Signature

```typescript
interface CheckBoxProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[checked?](./CheckBoxProps.md)||boolean|_(Optional)_ Whether Select|
|[disabled?](./CheckBoxProps.md)||boolean|_(Optional)_ Whether Disable|
|[indeterminate?](./CheckBoxProps.md)||boolean|_(Optional)_ 半选状态（全选/半选三态）|
|[name?](./CheckBoxProps.md)||string|_(Optional)_ Checkbox name (the form `name` attribute)|
|[onChange?](./CheckBoxProps.md)||(checked: boolean) =&gt; void|_(Optional)_ 选中状态变化时触发，参数为最新选中值|
|[onlyChangeByBox?](./CheckBoxProps.md)||boolean|_(Optional)_ Whether the state can only be changed by clicking the checkbox itself|
|[text?](./CheckBoxProps.md)||string|_(Optional)_ Text displayed next to the checkbox|

---

## 属性详情

### checked

# CheckBoxProps.checked property

Whether Select

## Signature

```typescript
checked?: boolean;
```

### disabled

# CheckBoxProps.disabled property

Whether Disable

## Signature

```typescript
disabled?: boolean;
```

### indeterminate

# CheckBoxProps.indeterminate property

半选状态（全选/半选三态）

## Signature

```typescript
indeterminate?: boolean;
```

### name

# CheckBoxProps.name property

Checkbox name (the form `name` attribute)

## Signature

```typescript
name?: string;
```

### onchange

# CheckBoxProps.onChange property

选中状态变化时触发，参数为最新选中值

## Signature

```typescript
onChange?: (checked: boolean) => void;
```

### onlychangebybox

# CheckBoxProps.onlyChangeByBox property

Whether the state can only be changed by clicking the checkbox itself

## Signature

```typescript
onlyChangeByBox?: boolean;
```

### text

# CheckBoxProps.text property

Text displayed next to the checkbox

## Signature

```typescript
text?: string;
```
