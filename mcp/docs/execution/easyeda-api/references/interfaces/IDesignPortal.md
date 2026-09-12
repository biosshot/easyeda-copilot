# IDesignPortal interface

Component tree operation contract.

## Signature

```typescript
interface IDesignPortal<T extends keyof ComponentPropsMap = keyof ComponentPropsMap>
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[createComponent](./IDesignPortal.md)||(handle: string, type: T, props: [ComponentPropsMap](./ComponentPropsMap.md)<!-- -->\[T\], eventDispatcher: (ev: any) =&gt; void, parent?: string) =&gt; void||
|[detachComponent](./IDesignPortal.md)||(handle: string) =&gt; void||
|[updateComponent](./IDesignPortal.md)||(handle: string, type: T, props: [ComponentPropsMap](./ComponentPropsMap.md)<!-- -->\[T\], eventDispatcher: (ev: any) =&gt; void) =&gt; void||

---

## 属性详情

### createcomponent

# IDesignPortal.createComponent property

## Signature

```typescript
createComponent: (handle: string, type: T, props: ComponentPropsMap[T], eventDispatcher: (ev: any) => void, parent?: string) => void;
```

### detachcomponent

# IDesignPortal.detachComponent property

## Signature

```typescript
detachComponent: (handle: string) => void;
```

### updatecomponent

# IDesignPortal.updateComponent property

## Signature

```typescript
updateComponent: (handle: string, type: T, props: ComponentPropsMap[T], eventDispatcher: (ev: any) => void) => void;
```
