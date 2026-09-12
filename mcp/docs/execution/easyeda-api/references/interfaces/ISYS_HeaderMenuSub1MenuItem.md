# ISYS\_HeaderMenuSub1MenuItem interface

Top-level secondary menu item

## Signature

```typescript
interface ISYS_HeaderMenuSub1MenuItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[icon?](./ISYS_HeaderMenuSub1MenuItem.md)||string|_(Optional)_ Menu item icon|
|[id](./ISYS_HeaderMenuSub1MenuItem.md)||string|Menu item ID, cannot be repeated|
|[menuItems?](./ISYS_HeaderMenuSub1MenuItem.md)||Array&lt;[ISYS\_HeaderMenuSub2MenuItem](./ISYS_HeaderMenuSub2MenuItem.md) \| null&gt;|_(Optional)_ Sub-menu item|
|[registerFn?](./ISYS_HeaderMenuSub1MenuItem.md)||string|_(Optional)_ Registration method name (the method needs to be exported in the extension entry file)|
|[title](./ISYS_HeaderMenuSub1MenuItem.md)||string|Menu item title|

---

## 属性详情

### icon

# ISYS\_HeaderMenuSub1MenuItem.icon property

Menu item icon

## Signature

```typescript
icon?: string;
```

### id

# ISYS\_HeaderMenuSub1MenuItem.id property

Menu item ID, cannot be repeated

## Signature

```typescript
id: string;
```

### menuitems

# ISYS\_HeaderMenuSub1MenuItem.menuItems property

Sub-menu item

## Signature

```typescript
menuItems?: Array<ISYS_HeaderMenuSub2MenuItem | null>;
```

### title

# ISYS\_HeaderMenuSub1MenuItem.title property

Menu item title

## Signature

```typescript
title: string;
```


---

## 方法详情

### registerfn

# ISYS\_HeaderMenuSub1MenuItem.registerFn property

Registration method name (the method needs to be exported in the extension entry file)

## Signature

```typescript
registerFn?: string;
```
