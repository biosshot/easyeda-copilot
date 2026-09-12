# ISYS\_HeaderMenuSub2MenuItem interface

Top-level tertiary menu item

## Signature

```typescript
interface ISYS_HeaderMenuSub2MenuItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[icon?](./ISYS_HeaderMenuSub2MenuItem.md)||string|_(Optional)_ Menu item icon|
|[id](./ISYS_HeaderMenuSub2MenuItem.md)||string|Menu item ID, cannot be repeated|
|[registerFn?](./ISYS_HeaderMenuSub2MenuItem.md)||string|_(Optional)_ Registration method name (the method needs to be exported in the extension entry file)|
|[title](./ISYS_HeaderMenuSub2MenuItem.md)||string|Menu item title|

---

## 属性详情

### icon

# ISYS\_HeaderMenuSub2MenuItem.icon property

Menu item icon

## Signature

```typescript
icon?: string;
```

### id

# ISYS\_HeaderMenuSub2MenuItem.id property

Menu item ID, cannot be repeated

## Signature

```typescript
id: string;
```

### title

# ISYS\_HeaderMenuSub2MenuItem.title property

Menu item title

## Signature

```typescript
title: string;
```


---

## 方法详情

### registerfn

# ISYS\_HeaderMenuSub2MenuItem.registerFn property

Registration method name (the method needs to be exported in the extension entry file)

## Signature

```typescript
registerFn?: string;
```
