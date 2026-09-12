# CustomHeaderConfig interface

自定义表头配置（列可见性管理）

## Signature

```typescript
interface CustomHeaderConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[availableColumns](./CustomHeaderConfig.md)||[ColumnDef](./ColumnDef.md)<!-- -->\[\]|全部可选列（含隐藏列）|
|[onChange](./CustomHeaderConfig.md)||(visibleKeys: string\[\]) =&gt; void|可见列变更通知|
|[persist?](./CustomHeaderConfig.md)||boolean|_(Optional)_ 是否持久化，默认 true|
|[storageKey?](./CustomHeaderConfig.md)||string|_(Optional)_ 持久化存储 key|
|[visibleKeys](./CustomHeaderConfig.md)||string\[\]|当前可见列 key 列表|

---

## 属性详情

### availablecolumns

# CustomHeaderConfig.availableColumns property

全部可选列（含隐藏列）

## Signature

```typescript
availableColumns: ColumnDef[];
```

### onchange

# CustomHeaderConfig.onChange property

可见列变更通知

## Signature

```typescript
onChange: (visibleKeys: string[]) => void;
```

### persist

# CustomHeaderConfig.persist property

是否持久化，默认 true

## Signature

```typescript
persist?: boolean;
```

### storagekey

# CustomHeaderConfig.storageKey property

持久化存储 key

## Signature

```typescript
storageKey?: string;
```

### visiblekeys

# CustomHeaderConfig.visibleKeys property

当前可见列 key 列表

## Signature

```typescript
visibleKeys: string[];
```
