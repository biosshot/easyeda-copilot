# InputEditConfig interface

## Signature

```typescript
interface InputEditConfig
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[inputType?](./InputEditConfig.md)||'text' \| 'number'|_(Optional)_ 原生 input 类型，默认 'text'|
|[maxLength?](./InputEditConfig.md)||number|_(Optional)_|
|[onChange?](./InputEditConfig.md)||(value: string) =&gt; void|_(Optional)_|
|[onConfirm?](./InputEditConfig.md)||(value: string) =&gt; void|_(Optional)_|
|[placeholder?](./InputEditConfig.md)||string|_(Optional)_|
|[type](./InputEditConfig.md)||'input'||

---

## 属性详情

### inputtype

# InputEditConfig.inputType property

原生 input 类型，默认 'text'

## Signature

```typescript
inputType?: 'text' | 'number';
```

### maxlength

# InputEditConfig.maxLength property

## Signature

```typescript
maxLength?: number;
```

### onchange

# InputEditConfig.onChange property

## Signature

```typescript
onChange?: (value: string) => void;
```

### onconfirm

# InputEditConfig.onConfirm property

## Signature

```typescript
onConfirm?: (value: string) => void;
```

### placeholder

# InputEditConfig.placeholder property

## Signature

```typescript
placeholder?: string;
```

### type

# InputEditConfig.type property

## Signature

```typescript
type: 'input';
```
