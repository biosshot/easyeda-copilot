# VirtualScrollConfig interface

虚拟滚动配置

## Signature

```typescript
interface VirtualScrollConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[onScrollToEnd?](./VirtualScrollConfig.md)||() =&gt; void|_(Optional)_ 滚动到底部通知|
|[overscan?](./VirtualScrollConfig.md)||number|_(Optional)_ 预渲染行数（上下各），默认 10|
|[scrollEndThreshold?](./VirtualScrollConfig.md)||number|_(Optional)_ 触发 onScrollToEnd 的距底阈值，默认 200|

---

## 属性详情

### onscrolltoend

# VirtualScrollConfig.onScrollToEnd property

滚动到底部通知

## Signature

```typescript
onScrollToEnd?: () => void;
```

### overscan

# VirtualScrollConfig.overscan property

预渲染行数（上下各），默认 10

## Signature

```typescript
overscan?: number;
```

### scrollendthreshold

# VirtualScrollConfig.scrollEndThreshold property

触发 onScrollToEnd 的距底阈值，默认 200

## Signature

```typescript
scrollEndThreshold?: number;
```
