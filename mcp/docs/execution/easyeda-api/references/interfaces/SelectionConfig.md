# SelectionConfig interface

选择配置

## Signature

```typescript
interface SelectionConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[align?](./SelectionConfig.md)||[Align](../types/Align.md)|_(Optional)_ 勾选框列对齐，默认 'left'|
|[checkboxColumnWidth?](./SelectionConfig.md)||number|_(Optional)_ 勾选框列宽度，默认 30|
|[ctrlSelect?](./SelectionConfig.md)||boolean|_(Optional)_ 是否支持 Ctrl 多选，默认 true|
|[defaultSelectedKeys?](./SelectionConfig.md)||string\[\]|_(Optional)_ 非受控：初始选中行 key 列表|
|[disabledCheckboxKeys?](./SelectionConfig.md)||string\[\]|_(Optional)_ 禁用勾选框的行 key 列表|
|[disabledSelectKeys?](./SelectionConfig.md)||string\[\]|_(Optional)_ 不可选的行 key 列表|
|[onChange?](./SelectionConfig.md)||(info: { selectedKeys: string\[\]; selectedRows: [RichTableRow](../types/RichTableRow.md)<!-- -->\[\]; detail: { action: 'select' \| 'unselect' \| 'selectAll' \| 'clear'; row?: [RichTableRow](../types/RichTableRow.md)<!-- -->; triggerFromCheck?: boolean } }) =&gt; void|_(Optional)_ 选择变更通知（受控模式必传）|
|[rangeSelect?](./SelectionConfig.md)||boolean|_(Optional)_ 是否启用 Ctrl/Shift 范围选择，默认 false（type=multiple 时可开启）|
|[selectedKeys?](./SelectionConfig.md)||string\[\]|_(Optional)_ 受控：外部维护的选中行 key 列表|
|[selectOnRowClick?](./SelectionConfig.md)||boolean|_(Optional)_ 单击行时是否触发选中（type=single 时默认 true）|
|[shiftSelect?](./SelectionConfig.md)||boolean|_(Optional)_ 是否支持 Shift 范围选，默认 true|
|[type](./SelectionConfig.md)||'single' \| 'multiple' \| 'checkbox'|选择模式： - single：单击单选一行 - multiple：单击 + Ctrl/Shift 多选 - checkbox：勾选框列（勾选仅通过 checkbox，行点击不改变勾选）|

---

## 属性详情

### align

# SelectionConfig.align property

勾选框列对齐，默认 'left'

## Signature

```typescript
align?: Align;
```

### checkboxcolumnwidth

# SelectionConfig.checkboxColumnWidth property

勾选框列宽度，默认 30

## Signature

```typescript
checkboxColumnWidth?: number;
```

### ctrlselect

# SelectionConfig.ctrlSelect property

是否支持 Ctrl 多选，默认 true

## Signature

```typescript
ctrlSelect?: boolean;
```

### defaultselectedkeys

# SelectionConfig.defaultSelectedKeys property

非受控：初始选中行 key 列表

## Signature

```typescript
defaultSelectedKeys?: string[];
```

### disabledcheckboxkeys

# SelectionConfig.disabledCheckboxKeys property

禁用勾选框的行 key 列表

## Signature

```typescript
disabledCheckboxKeys?: string[];
```

### disabledselectkeys

# SelectionConfig.disabledSelectKeys property

不可选的行 key 列表

## Signature

```typescript
disabledSelectKeys?: string[];
```

### onchange

# SelectionConfig.onChange property

选择变更通知（受控模式必传）

## Signature

```typescript
onChange?: (info: { selectedKeys: string[]; selectedRows: RichTableRow[]; detail: { action: 'select' | 'unselect' | 'selectAll' | 'clear'; row?: RichTableRow; triggerFromCheck?: boolean } }) => void;
```

### rangeselect

# SelectionConfig.rangeSelect property

是否启用 Ctrl/Shift 范围选择，默认 false（type=multiple 时可开启）

## Signature

```typescript
rangeSelect?: boolean;
```

### selectedkeys

# SelectionConfig.selectedKeys property

受控：外部维护的选中行 key 列表

## Signature

```typescript
selectedKeys?: string[];
```

### selectonrowclick

# SelectionConfig.selectOnRowClick property

单击行时是否触发选中（type=single 时默认 true）

## Signature

```typescript
selectOnRowClick?: boolean;
```

### shiftselect

# SelectionConfig.shiftSelect property

是否支持 Shift 范围选，默认 true

## Signature

```typescript
shiftSelect?: boolean;
```

### type

# SelectionConfig.type property

选择模式： - single：单击单选一行 - multiple：单击 + Ctrl/Shift 多选 - checkbox：勾选框列（勾选仅通过 checkbox，行点击不改变勾选）

## Signature

```typescript
type: 'single' | 'multiple' | 'checkbox';
```
