# ButtonProps interface

按钮组件：可点击触发的操作按钮

## Signature

```typescript
interface ButtonProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[disabled?](./ButtonProps.md)||boolean|_(Optional)_ Whether Disable|
|[icon?](./ButtonProps.md)||[IconProps](./IconProps.md)|_(Optional)_ Button icon configuration|
|[onClick?](./ButtonProps.md)||() =&gt; void|_(Optional)_ 点击按钮时触发|
|[text?](./ButtonProps.md)||string|_(Optional)_ Button show text|
|[triggerEnter?](./ButtonProps.md)||boolean|_(Optional)_ 是否为对话框的 Enter 触发按钮（仅 Dialog 内部生效，按 Enter 会触发该按钮点击）|
|[type?](./ButtonProps.md)||'default' \| 'primary' \| 'danger' \| 'forbidden' \| 'text'|_(Optional)_ Button style type: default / primary / danger / forbidden / text|

---

## 属性详情

### disabled

# ButtonProps.disabled property

Whether Disable

## Signature

```typescript
disabled?: boolean;
```

### icon

# ButtonProps.icon property

Button icon configuration

## Signature

```typescript
icon?: IconProps;
```

### onclick

# ButtonProps.onClick property

点击按钮时触发

## Signature

```typescript
onClick?: () => void;
```

### text

# ButtonProps.text property

Button show text

## Signature

```typescript
text?: string;
```

### triggerenter

# ButtonProps.triggerEnter property

是否为对话框的 Enter 触发按钮（仅 Dialog 内部生效，按 Enter 会触发该按钮点击）

## Signature

```typescript
triggerEnter?: boolean;
```

### type

# ButtonProps.type property

Button style type: default / primary / danger / forbidden / text

## Signature

```typescript
type?: 'default' | 'primary' | 'danger' | 'forbidden' | 'text';
```
