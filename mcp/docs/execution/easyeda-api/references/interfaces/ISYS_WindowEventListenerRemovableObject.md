# ISYS\_WindowEventListenerRemovableObject interface

Window event listener can remove object

## Signature

```typescript
interface ISYS_WindowEventListenerRemovableObject
```

## Remarks

This object is obtained from [addEventListener](../classes/SYS_Window.md) and can be used to remove the created event listener by simply passing it to [removeEventListener](../classes/SYS_Window.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[listener](./ISYS_WindowEventListenerRemovableObject.md)||(ev: any) =&gt; any||
|[options?](./ISYS_WindowEventListenerRemovableObject.md)||\{ capture?: boolean \}|_(Optional)_|
|[type](./ISYS_WindowEventListenerRemovableObject.md)||[ESYS\_WindowEventType](../enums/ESYS_WindowEventType.md)||

---

## 属性详情

### listener

# ISYS\_WindowEventListenerRemovableObject.listener property

## Signature

```typescript
listener: (ev: any) => any;
```

### options

# ISYS\_WindowEventListenerRemovableObject.options property

## Signature

```typescript
options?: { capture?: boolean };
```

### type

# ISYS\_WindowEventListenerRemovableObject.type property

## Signature

```typescript
type: ESYS_WindowEventType;
```
