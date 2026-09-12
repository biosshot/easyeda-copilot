# SelectEditConfig interface

## Signature

```typescript
interface SelectEditConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[disabled?](./SelectEditConfig.md)||boolean|_(Optional)_|
|[multiple?](./SelectEditConfig.md)||boolean|_(Optional)_ 是否多选|
|[onChange?](./SelectEditConfig.md)||(value: string \| number \| Array&lt;string \| number&gt;) =&gt; void|_(Optional)_|
|[options](./SelectEditConfig.md)||[SelectOption](./SelectOption.md)<!-- -->\[\]|下拉选项|
|[placeholder?](./SelectEditConfig.md)||string|_(Optional)_|
|[searchable?](./SelectEditConfig.md)||boolean|_(Optional)_ 是否可搜索过滤|
|[type](./SelectEditConfig.md)||'select'||

---

## 属性详情

### disabled

# SelectEditConfig.disabled property

## Signature

```typescript
disabled?: boolean;
```

### multiple

# SelectEditConfig.multiple property

是否多选

## Signature

```typescript
multiple?: boolean;
```

### onchange

# SelectEditConfig.onChange property

## Signature

```typescript
onChange?: (value: string | number | Array<string | number>) => void;
```

### options

# SelectEditConfig.options property

下拉选项

## Signature

```typescript
options: SelectOption[];
```

### placeholder

# SelectEditConfig.placeholder property

## Signature

```typescript
placeholder?: string;
```

### searchable

# SelectEditConfig.searchable property

是否可搜索过滤

## Signature

```typescript
searchable?: boolean;
```

### type

# SelectEditConfig.type property

## Signature

```typescript
type: 'select';
```
