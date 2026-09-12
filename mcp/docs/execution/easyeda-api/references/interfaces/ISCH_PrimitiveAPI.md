# ISCH\_PrimitiveAPI interface

Schematic primitive API

## Signature

```typescript
interface ISCH_PrimitiveAPI
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[create](./ISCH_PrimitiveAPI.md)||(...args: any\[\]) =&gt; [ISCH\_Primitive](./ISCH_Primitive.md) \| undefined \| Promise&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt; \| Promise&lt;[ISCH\_Primitive](./ISCH_Primitive.md) \| undefined&gt;||
|[delete](./ISCH_PrimitiveAPI.md)||(primitiveIds: string \| any \| Array&lt;string&gt; \| Array&lt;any&gt;) =&gt; boolean \| Promise&lt;boolean&gt;||
|[get](./ISCH_PrimitiveAPI.md)||{ (primitiveIds: string): [ISCH\_Primitive](./ISCH_Primitive.md) \| undefined \| Promise&lt;[ISCH\_Primitive](./ISCH_Primitive.md) \| undefined&gt;; (primitiveIds: Array&lt;string&gt;): Array&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt; \| Promise&lt;Array&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt;&gt; }||
|[getAll](./ISCH_PrimitiveAPI.md)||(...args: any\[\]) =&gt; Array&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt; \| Promise&lt;Array&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt;&gt;||
|[getAllPrimitiveId](./ISCH_PrimitiveAPI.md)||(...args: any\[\]) =&gt; Array&lt;string&gt; \| Promise&lt;Array&lt;string&gt;&gt;||
|[modify](./ISCH_PrimitiveAPI.md)||(primitiveId: string \| any, ...args: any\[\]) =&gt; [ISCH\_Primitive](./ISCH_Primitive.md) \| undefined \| Promise&lt;[ISCH\_Primitive](./ISCH_Primitive.md)<!-- -->&gt; \| Promise&lt;[ISCH\_Primitive](./ISCH_Primitive.md) \| undefined&gt;||

---

## 属性详情

### create

# ISCH\_PrimitiveAPI.create property

## Signature

```typescript
create: (...args: any[]) =>
	ISCH_Primitive | undefined | Promise<ISCH_Primitive> | Promise<ISCH_Primitive | undefined>;
```

### delete

# ISCH\_PrimitiveAPI.delete property

## Signature

```typescript
delete: (primitiveIds: string | any | Array<string> | Array<any>) => boolean | Promise<boolean>;
```

### get

# ISCH\_PrimitiveAPI.get property

## Signature

```typescript
get: { (primitiveIds: string): ISCH_Primitive | undefined | Promise<ISCH_Primitive | undefined>; (primitiveIds: Array<string>): Array<ISCH_Primitive> | Promise<Array<ISCH_Primitive>> };
```

### getall

# ISCH\_PrimitiveAPI.getAll property

## Signature

```typescript
getAll: (...args: any[]) => Array<ISCH_Primitive> | Promise<Array<ISCH_Primitive>>;
```

### getallprimitiveid

# ISCH\_PrimitiveAPI.getAllPrimitiveId property

## Signature

```typescript
getAllPrimitiveId: (...args: any[]) => Array<string> | Promise<Array<string>>;
```

### modify

# ISCH\_PrimitiveAPI.modify property

## Signature

```typescript
modify: (primitiveId: string | any, ...args: any[]) =>
	ISCH_Primitive | undefined | Promise<ISCH_Primitive> | Promise<ISCH_Primitive | undefined>;
```
