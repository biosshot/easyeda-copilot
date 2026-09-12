# SelectProps interface

下拉选择器：基于输入框的下拉选择控件

## Signature

```typescript
interface SelectProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[disabled?](./SelectProps.md)||boolean|_(Optional)_ Whether Disable|
|[dropDownList?](./SelectProps.md)||[SelectListItem](./SelectListItem.md)<!-- -->\[\]|_(Optional)_ Dropdown option list|
|[onChange?](./SelectProps.md)||(value: string) =&gt; void|_(Optional)_ 选中值变化时触发，参数为选中项的值|
|[readonly?](./SelectProps.md)||boolean|_(Optional)_ Whether it is read-only|
|[value?](./SelectProps.md)||string|_(Optional)_ Current select value|

---

## 属性详情

### disabled

# SelectProps.disabled property

Whether Disable

## Signature

```typescript
disabled?: boolean;
```

### dropdownlist

# SelectProps.dropDownList property

Dropdown option list

## Signature

```typescript
dropDownList?: SelectListItem[];
```

### onchange

# SelectProps.onChange property

选中值变化时触发，参数为选中项的值

## Signature

```typescript
onChange?: (value: string) => void;
```

### readonly

# SelectProps.readonly property

Whether it is read-only

## Signature

```typescript
readonly?: boolean;
```

### value

# SelectProps.value property

Current select value

## Signature

```typescript
value?: string;
```
