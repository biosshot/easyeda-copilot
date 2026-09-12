# FilteringConfig interface

筛选配置

## Signature

```typescript
interface FilteringConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[caseSensitive?](./FilteringConfig.md)||boolean|_(Optional)_ 是否区分大小写，默认 false|
|[debounce?](./FilteringConfig.md)||number|_(Optional)_ 输入防抖毫秒数，默认 300|
|[defaultFilters?](./FilteringConfig.md)||Record&lt;string, string&gt;|_(Optional)_ 非受控：初始筛选值|
|[filters?](./FilteringConfig.md)||Record&lt;string, string&gt;|_(Optional)_ 受控：外部维护的筛选值（key 为 colKey）|
|[onChange?](./FilteringConfig.md)||(filters: Record&lt;string, string&gt;) =&gt; void|_(Optional)_ 筛选变更通知|
|[onFilterCancel?](./FilteringConfig.md)||() =&gt; void|_(Optional)_ 筛选取消通知|
|[placeholder?](./FilteringConfig.md)||string|_(Optional)_ 筛选输入框占位符，默认 '筛选...'|
|[position?](./FilteringConfig.md)||'inline' \| 'popover'|_(Optional)_ 筛选位置：popover 弹窗 / inline 表头内联行，默认 'popover'|

---

## 属性详情

### casesensitive

# FilteringConfig.caseSensitive property

是否区分大小写，默认 false

## Signature

```typescript
caseSensitive?: boolean;
```

### debounce

# FilteringConfig.debounce property

输入防抖毫秒数，默认 300

## Signature

```typescript
debounce?: number;
```

### defaultfilters

# FilteringConfig.defaultFilters property

非受控：初始筛选值

## Signature

```typescript
defaultFilters?: Record<string, string>;
```

### filters

# FilteringConfig.filters property

受控：外部维护的筛选值（key 为 colKey）

## Signature

```typescript
filters?: Record<string, string>;
```

### onchange

# FilteringConfig.onChange property

筛选变更通知

## Signature

```typescript
onChange?: (filters: Record<string, string>) => void;
```

### onfiltercancel

# FilteringConfig.onFilterCancel property

筛选取消通知

## Signature

```typescript
onFilterCancel?: () => void;
```

### placeholder

# FilteringConfig.placeholder property

筛选输入框占位符，默认 '筛选...'

## Signature

```typescript
placeholder?: string;
```

### position

# FilteringConfig.position property

筛选位置：popover 弹窗 / inline 表头内联行，默认 'popover'

## Signature

```typescript
position?: 'inline' | 'popover';
```
