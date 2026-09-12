# RadioGroupProps interface

单选组组件：一组互斥的单选选项

## Signature

```typescript
interface RadioGroupProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[gap?](./RadioGroupProps.md)||number|_(Optional)_ Option gap (pixels)|
|[group](./RadioGroupProps.md)||[RadioItem](./RadioItem.md)<!-- -->\[\]|Option list (required)|
|[lineBreak?](./RadioGroupProps.md)||boolean|_(Optional)_ Whether to arrange in line breaks|
|[onChange?](./RadioGroupProps.md)||(value: string) =&gt; void|_(Optional)_ 选中值变化时触发，参数为选中项的值|
|[onlyChangeByBox?](./RadioGroupProps.md)||boolean|_(Optional)_ Whether the state can only be changed by clicking the radio button itself|
|[selectedValue?](./RadioGroupProps.md)||string|_(Optional)_ Currently selected value|

---

## 属性详情

### gap

# RadioGroupProps.gap property

Option gap (pixels)

## Signature

```typescript
gap?: number;
```

### group

# RadioGroupProps.group property

Option list (required)

## Signature

```typescript
group: RadioItem[];
```

### linebreak

# RadioGroupProps.lineBreak property

Whether to arrange in line breaks

## Signature

```typescript
lineBreak?: boolean;
```

### onchange

# RadioGroupProps.onChange property

选中值变化时触发，参数为选中项的值

## Signature

```typescript
onChange?: (value: string) => void;
```

### onlychangebybox

# RadioGroupProps.onlyChangeByBox property

Whether the state can only be changed by clicking the radio button itself

## Signature

```typescript
onlyChangeByBox?: boolean;
```

### selectedvalue

# RadioGroupProps.selectedValue property

Currently selected value

## Signature

```typescript
selectedValue?: string;
```
