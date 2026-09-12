# ColumnResizeConfig interface

列宽拖拽配置

## Signature

```typescript
interface ColumnResizeConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[minWidth?](./ColumnResizeConfig.md)||number|_(Optional)_ 最小列宽（px），默认 25|
|[onChange?](./ColumnResizeConfig.md)||(info: { colKey: string; width: number }) =&gt; void|_(Optional)_ 列宽变更通知|
|[persist?](./ColumnResizeConfig.md)||boolean|_(Optional)_ 是否持久化列宽到 localStorage，默认 true|
|[storageKey?](./ColumnResizeConfig.md)||string|_(Optional)_ 持久化存储 key|

---

## 属性详情

### minwidth

# ColumnResizeConfig.minWidth property

最小列宽（px），默认 25

## Signature

```typescript
minWidth?: number;
```

### onchange

# ColumnResizeConfig.onChange property

列宽变更通知

## Signature

```typescript
onChange?: (info: { colKey: string; width: number }) => void;
```

### persist

# ColumnResizeConfig.persist property

是否持久化列宽到 localStorage，默认 true

## Signature

```typescript
persist?: boolean;
```

### storagekey

# ColumnResizeConfig.storageKey property

持久化存储 key

## Signature

```typescript
storageKey?: string;
```
