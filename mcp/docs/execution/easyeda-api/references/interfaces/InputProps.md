# InputProps interface

输入框组件：支持下拉、搜索、清除、前后缀等多种形态

## Signature

```typescript
interface InputProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[clearBtn?](./InputProps.md)||boolean|_(Optional)_ Whether Show clear button|
|[clickBtn?](./InputProps.md)||boolean|_(Optional)_ Whether to show the click button|
|[disabled?](./InputProps.md)||boolean|_(Optional)_ Whether Disable input|
|[dropDownList?](./InputProps.md)||[ListChildren](./ListChildren.md)<!-- -->\[\]|_(Optional)_ Dropdown list data. When provided, the input box can select from a dropdown|
|[onAddClick?](./InputProps.md)||(data: string) =&gt; void|_(Optional)_ 点击添加按钮时触发，参数为当前输入值|
|[onBlur?](./InputProps.md)||(data: string) =&gt; void|_(Optional)_ 输入框失焦时触发，参数为当前输入值|
|[onChange?](./InputProps.md)||(data: string) =&gt; void|_(Optional)_ 输入内容变化时触发，参数为最新值|
|[onClick?](./InputProps.md)||() =&gt; void|_(Optional)_ 点击输入框时触发|
|[onFilterClick?](./InputProps.md)||(data: string) =&gt; void|_(Optional)_ 点击筛选按钮时触发，参数为当前输入值|
|[onSearchClick?](./InputProps.md)||(data: string) =&gt; void|_(Optional)_ 点击搜索按钮时触发，参数为当前输入值|
|[otherAttr?](./InputProps.md)||\{ \[key: string\]: string \}|_(Optional)_ Other attributes attached to the input element (key-value pair string)|
|[placeholder?](./InputProps.md)||string|_(Optional)_ Placeholder text|
|[preText?](./InputProps.md)||string|_(Optional)_ Prefix text|
|[readonly?](./InputProps.md)||boolean|_(Optional)_ Whether it is read-only|
|[searchBtn?](./InputProps.md)||boolean|_(Optional)_ Whether Show search button|
|[testVal?](./InputProps.md)||string|_(Optional)_ Validation value for testing|
|[type](./InputProps.md)||'text' \| 'telephone' \| 'number' \| 'password' \| 'color' \| 'email'|Input box type (required)|
|[value?](./InputProps.md)||string|_(Optional)_ Current input value|

---

## 属性详情

### clearbtn

# InputProps.clearBtn property

Whether Show clear button

## Signature

```typescript
clearBtn?: boolean;
```

### clickbtn

# InputProps.clickBtn property

Whether to show the click button

## Signature

```typescript
clickBtn?: boolean;
```

### disabled

# InputProps.disabled property

Whether Disable input

## Signature

```typescript
disabled?: boolean;
```

### dropdownlist

# InputProps.dropDownList property

Dropdown list data. When provided, the input box can select from a dropdown

## Signature

```typescript
dropDownList?: ListChildren[];
```

### onaddclick

# InputProps.onAddClick property

点击添加按钮时触发，参数为当前输入值

## Signature

```typescript
onAddClick?: (data: string) => void;
```

### onblur

# InputProps.onBlur property

输入框失焦时触发，参数为当前输入值

## Signature

```typescript
onBlur?: (data: string) => void;
```

### onchange

# InputProps.onChange property

输入内容变化时触发，参数为最新值

## Signature

```typescript
onChange?: (data: string) => void;
```

### onclick

# InputProps.onClick property

点击输入框时触发

## Signature

```typescript
onClick?: () => void;
```

### onfilterclick

# InputProps.onFilterClick property

点击筛选按钮时触发，参数为当前输入值

## Signature

```typescript
onFilterClick?: (data: string) => void;
```

### onsearchclick

# InputProps.onSearchClick property

点击搜索按钮时触发，参数为当前输入值

## Signature

```typescript
onSearchClick?: (data: string) => void;
```

### otherattr

# InputProps.otherAttr property

Other attributes attached to the input element (key-value pair string)

## Signature

```typescript
otherAttr?: { [key: string]: string };
```

### placeholder

# InputProps.placeholder property

Placeholder text

## Signature

```typescript
placeholder?: string;
```

### pretext

# InputProps.preText property

Prefix text

## Signature

```typescript
preText?: string;
```

### readonly

# InputProps.readonly property

Whether it is read-only

## Signature

```typescript
readonly?: boolean;
```

### searchbtn

# InputProps.searchBtn property

Whether Show search button

## Signature

```typescript
searchBtn?: boolean;
```

### testval

# InputProps.testVal property

Validation value for testing

## Signature

```typescript
testVal?: string;
```

### type

# InputProps.type property

Input box type (required)

## Signature

```typescript
type: 'text' | 'telephone' | 'number' | 'password' | 'color' | 'email';
```

### value

# InputProps.value property

Current input value

## Signature

```typescript
value?: string;
```
