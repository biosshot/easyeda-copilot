# SliderProps interface

滑杆组件：基于浏览器原生 range 输入

## Signature

```typescript
interface SliderProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[max?](./SliderProps.md)||number|_(Optional)_ 最大值（默认 1）|
|[min?](./SliderProps.md)||number|_(Optional)_ 最小值（默认 0）|
|[onChange?](./SliderProps.md)||(value: number) =&gt; void|_(Optional)_ 值变化时触发，参数为最新值|
|[value?](./SliderProps.md)||number|_(Optional)_ 当前值（受控）|

---

## 属性详情

### max

# SliderProps.max property

最大值（默认 1）

## Signature

```typescript
max?: number;
```

### min

# SliderProps.min property

最小值（默认 0）

## Signature

```typescript
min?: number;
```

### onchange

# SliderProps.onChange property

值变化时触发，参数为最新值

## Signature

```typescript
onChange?: (value: number) => void;
```

### value

# SliderProps.value property

当前值（受控）

## Signature

```typescript
value?: number;
```
