# EditingConfig interface

编辑配置

## Signature

```typescript
interface EditingConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[columns?](./EditingConfig.md)||Record&lt;string, [ColumnEditConfig](../types/ColumnEditConfig.md)<!-- -->&gt;|_(Optional)_ 列级编辑器配置（key 为 colKey，未配置的列按 ColumnType 推断默认编辑器）|
|[editingRowIndices?](./EditingConfig.md)||number\[\]|_(Optional)_ 受控：正在编辑的行索引|
|[onChange?](./EditingConfig.md)||(info: { rowKey: string; colKey: string; value: any }) =&gt; void|_(Optional)_ 编辑值变更通知|
|[onConfirm?](./EditingConfig.md)||(info: { rowKey: string; colKey: string; value: any }) =&gt; void|_(Optional)_ 编辑确认通知|
|[setEditingRowIndex?](./EditingConfig.md)||(index: number) =&gt; void|_(Optional)_ 受控：设置编辑行索引|
|[trigger?](./EditingConfig.md)||'click' \| 'doubleClick'|_(Optional)_ 进入编辑态的触发方式，默认 'doubleClick'|

---

## 属性详情

### columns

# EditingConfig.columns property

列级编辑器配置（key 为 colKey，未配置的列按 ColumnType 推断默认编辑器）

## Signature

```typescript
columns?: Record<string, ColumnEditConfig>;
```

### editingrowindices

# EditingConfig.editingRowIndices property

受控：正在编辑的行索引

## Signature

```typescript
editingRowIndices?: number[];
```

### onchange

# EditingConfig.onChange property

编辑值变更通知

## Signature

```typescript
onChange?: (info: { rowKey: string; colKey: string; value: any }) => void;
```

### onconfirm

# EditingConfig.onConfirm property

编辑确认通知

## Signature

```typescript
onConfirm?: (info: { rowKey: string; colKey: string; value: any }) => void;
```

### seteditingrowindex

# EditingConfig.setEditingRowIndex property

受控：设置编辑行索引

## Signature

```typescript
setEditingRowIndex?: (index: number) => void;
```

### trigger

# EditingConfig.trigger property

进入编辑态的触发方式，默认 'doubleClick'

## Signature

```typescript
trigger?: 'click' | 'doubleClick';
```
