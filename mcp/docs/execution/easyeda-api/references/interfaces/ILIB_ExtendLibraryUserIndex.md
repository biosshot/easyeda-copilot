# ILIB\_ExtendLibraryUserIndex interface

External library user index

## Signature

```typescript
interface ILIB_ExtendLibraryUserIndex
```

## Remarks

Supports external libraries using a name or the associated user UUID within the EasyEDA system as the unique ID index of the user

If you want to associate with an EasyEDA user, pass in the user's UUID. The user's name will be automatically read (if the user exists)

If you only want to display the user name, you can pass in the `name` field

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[name?](./ILIB_ExtendLibraryUserIndex.md)||string|_(Optional)_ User name|
|[uuid?](./ILIB_ExtendLibraryUserIndex.md)||string|_(Optional)_ User UUID within the EasyEDA system|

---

## 属性详情

### name

# ILIB\_ExtendLibraryUserIndex.name property

User name

## Signature

```typescript
name?: string;
```

### uuid

# ILIB\_ExtendLibraryUserIndex.uuid property

User UUID within the EasyEDA system

## Signature

```typescript
uuid?: string;
```
