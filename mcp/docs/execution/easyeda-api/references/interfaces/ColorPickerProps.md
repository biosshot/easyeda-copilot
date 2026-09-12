# ColorPickerProps interface

颜色拾取组件：复用 Input color 类型，点击弹出内置固定色板，支持预览/应用/手输/清除/默认/关闭

## Signature

```typescript
interface ColorPickerProps
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[disabled?](./ColorPickerProps.md)||boolean|_(Optional)_ 是否禁用：不可点击、不弹层、无交互|
|[onChange?](./ColorPickerProps.md)||(color: string) =&gt; void|_(Optional)_ 颜色值落定时触发：点色块 / √ 确认合法 hex / 清除；预览/关闭/取消不触发。载荷为统一大写的 `#RRGGBB`<!-- -->，清除为 `''`|
|[onDefault?](./ColorPickerProps.md)||() =&gt; void|_(Optional)_ 点击「默认」按钮时触发（纯自定义回调，无内置默认色回退），触发后关闭弹层，无参|
|[readonly?](./ColorPickerProps.md)||boolean|_(Optional)_ 是否只读：不可手输 hex，但可打开色板选色（选色仍触发 onChange）|
|[value?](./ColorPickerProps.md)||string|_(Optional)_ 当前颜色值（受控），合法形式 `#RGB` / `#RRGGBB`<!-- -->；空串/无 = 无颜色|

---

## 属性详情

### disabled

# ColorPickerProps.disabled property

是否禁用：不可点击、不弹层、无交互

## Signature

```typescript
disabled?: boolean;
```

### onchange

# ColorPickerProps.onChange property

颜色值落定时触发：点色块 / √ 确认合法 hex / 清除；预览/关闭/取消不触发。载荷为统一大写的 `#RRGGBB`<!-- -->，清除为 `''`

## Signature

```typescript
onChange?: (color: string) => void;
```

### ondefault

# ColorPickerProps.onDefault property

点击「默认」按钮时触发（纯自定义回调，无内置默认色回退），触发后关闭弹层，无参

## Signature

```typescript
onDefault?: () => void;
```

### readonly

# ColorPickerProps.readonly property

是否只读：不可手输 hex，但可打开色板选色（选色仍触发 onChange）

## Signature

```typescript
readonly?: boolean;
```

### value

# ColorPickerProps.value property

当前颜色值（受控），合法形式 `#RGB` / `#RRGGBB`<!-- -->；空串/无 = 无颜色

## Signature

```typescript
value?: string;
```
