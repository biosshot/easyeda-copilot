# ISYS\_RightClickMenuItem interface

Right-click menu item

## Signature

```typescript
interface ISYS_RightClickMenuItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[icon?](./ISYS_RightClickMenuItem.md)||string|_(Optional)_ Menu item icon|
|[id](./ISYS_RightClickMenuItem.md)||string|Menu item ID, cannot be repeated|
|[menuItems?](./ISYS_RightClickMenuItem.md)||Array&lt;[ISYS\_RightClickMenuItem](./ISYS_RightClickMenuItem.md) \| null&gt;|_(Optional)_ Sub-menu item|
|[registerFn?](./ISYS_RightClickMenuItem.md)||string|_(Optional)_ Registration method name (the method needs to be exported in the extension entry file)|
|[title?](./ISYS_RightClickMenuItem.md)||string|_(Optional)_ Menu item title|

---

## 属性详情

### icon

# ISYS\_RightClickMenuItem.icon property

Menu item icon

## Signature

```typescript
icon?: string;
```

### id

# ISYS\_RightClickMenuItem.id property

Menu item ID, cannot be repeated

## Signature

```typescript
id: string;
```

### menuitems

# ISYS\_RightClickMenuItem.menuItems property

Sub-menu item

## Signature

```typescript
menuItems?: Array<ISYS_RightClickMenuItem | null>;
```

### title

# ISYS\_RightClickMenuItem.title property

Menu item title

## Signature

```typescript
title?: string;
```


---

## 方法详情

### registerfn

# ISYS\_RightClickMenuItem.registerFn property

Registration method name (the method needs to be exported in the extension entry file)

## Signature

```typescript
registerFn?: string;
```
