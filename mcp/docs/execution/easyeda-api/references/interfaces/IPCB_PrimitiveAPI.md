# IPCB\_PrimitiveAPI interface

PCB primitive API

## Signature

```typescript
interface IPCB_PrimitiveAPI
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[create](./IPCB_PrimitiveAPI.md)||(...args: any\[\]) =&gt; [IPCB\_Primitive](./IPCB_Primitive.md) \| undefined \| Promise&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt; \| Promise&lt;[IPCB\_Primitive](./IPCB_Primitive.md) \| undefined&gt;||
|[delete](./IPCB_PrimitiveAPI.md)||(primitiveIds: string \| any \| Array&lt;string&gt; \| Array&lt;any&gt;) =&gt; boolean \| Promise&lt;boolean&gt;||
|[get](./IPCB_PrimitiveAPI.md)||{ (primitiveIds: string): [IPCB\_Primitive](./IPCB_Primitive.md) \| undefined \| Promise&lt;[IPCB\_Primitive](./IPCB_Primitive.md) \| undefined&gt;; (primitiveIds: Array&lt;string&gt;): Array&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt; \| Promise&lt;Array&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt;&gt; }||
|[getAll](./IPCB_PrimitiveAPI.md)||(...args: any\[\]) =&gt; Array&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt; \| Promise&lt;Array&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt;&gt;||
|[getAllPrimitiveId](./IPCB_PrimitiveAPI.md)||(...args: any\[\]) =&gt; Array&lt;string&gt; \| Promise&lt;Array&lt;string&gt;&gt;||
|[modify](./IPCB_PrimitiveAPI.md)||(primitiveId: string \| any, ...args: any\[\]) =&gt; [IPCB\_Primitive](./IPCB_Primitive.md) \| undefined \| Promise&lt;[IPCB\_Primitive](./IPCB_Primitive.md)<!-- -->&gt; \| Promise&lt;[IPCB\_Primitive](./IPCB_Primitive.md) \| undefined&gt;||

---

## 属性详情

### create

# IPCB\_PrimitiveAPI.create property

## Signature

```typescript
create: (...args: any[]) =>
	IPCB_Primitive | undefined | Promise<IPCB_Primitive> | Promise<IPCB_Primitive | undefined>;
```

### delete

# IPCB\_PrimitiveAPI.delete property

## Signature

```typescript
delete: (primitiveIds: string | any | Array<string> | Array<any>) => boolean | Promise<boolean>;
```

### get

# IPCB\_PrimitiveAPI.get property

## Signature

```typescript
get: { (primitiveIds: string): IPCB_Primitive | undefined | Promise<IPCB_Primitive | undefined>; (primitiveIds: Array<string>): Array<IPCB_Primitive> | Promise<Array<IPCB_Primitive>> };
```

### getall

# IPCB\_PrimitiveAPI.getAll property

## Signature

```typescript
getAll: (...args: any[]) => Array<IPCB_Primitive> | Promise<Array<IPCB_Primitive>>;
```

### getallprimitiveid

# IPCB\_PrimitiveAPI.getAllPrimitiveId property

## Signature

```typescript
getAllPrimitiveId: (...args: any[]) => Array<string> | Promise<Array<string>>;
```

### modify

# IPCB\_PrimitiveAPI.modify property

## Signature

```typescript
modify: (primitiveId: string | any, ...args: any[]) =>
	IPCB_Primitive | undefined | Promise<IPCB_Primitive> | Promise<IPCB_Primitive | undefined>;
```
