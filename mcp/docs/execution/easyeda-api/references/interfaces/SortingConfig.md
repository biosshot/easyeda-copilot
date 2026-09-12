# SortingConfig interface

排序配置

## Signature

```typescript
interface SortingConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[defaultState?](./SortingConfig.md)||[SortState](./SortState.md)<!-- -->\[\]|_(Optional)_ 非受控：初始排序状态|
|[multiple?](./SortingConfig.md)||boolean|_(Optional)_ 是否支持多列排序，默认 false|
|[onChange?](./SortingConfig.md)||(state: [SortState](./SortState.md)<!-- -->\[\]) =&gt; void|_(Optional)_ 排序变更通知|
|[remote?](./SortingConfig.md)||boolean|_(Optional)_ 远端排序：true 时仅触发 onChange，不本地排序，默认 false|
|[state?](./SortingConfig.md)||[SortState](./SortState.md)<!-- -->\[\]|_(Optional)_ 受控：外部维护的排序状态|

---

## 属性详情

### defaultstate

# SortingConfig.defaultState property

非受控：初始排序状态

## Signature

```typescript
defaultState?: SortState[];
```

### multiple

# SortingConfig.multiple property

是否支持多列排序，默认 false

## Signature

```typescript
multiple?: boolean;
```

### onchange

# SortingConfig.onChange property

排序变更通知

## Signature

```typescript
onChange?: (state: SortState[]) => void;
```

### remote

# SortingConfig.remote property

远端排序：true 时仅触发 onChange，不本地排序，默认 false

## Signature

```typescript
remote?: boolean;
```

### state

# SortingConfig.state property

受控：外部维护的排序状态

## Signature

```typescript
state?: SortState[];
```
