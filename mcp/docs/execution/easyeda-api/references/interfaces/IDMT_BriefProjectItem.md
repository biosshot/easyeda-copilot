# IDMT\_BriefProjectItem interface

Brief project properties

## Signature

```typescript
interface IDMT_BriefProjectItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[folderUuid?](./IDMT_BriefProjectItem.md)||string|_(Optional)_ UUID of the folder it belongs to|
|[friendlyName](./IDMT_BriefProjectItem.md)||string|Project friendly name|
|[itemType](./IDMT_BriefProjectItem.md)|`readonly`|[EDMT\_ItemType.PROJECT](../enums/EDMT_ItemType.md) \| [EDMT\_ItemType.CBB\_PROJECT](../enums/EDMT_ItemType.md)|Project type|
|[teamUuid](./IDMT_BriefProjectItem.md)||string|UUID of the team it belongs to|
|[uuid](./IDMT_BriefProjectItem.md)||string|Project UUID|

---

## 属性详情

### folderuuid

# IDMT\_BriefProjectItem.folderUuid property

UUID of the folder it belongs to

## Signature

```typescript
folderUuid?: string;
```

### friendlyname

# IDMT\_BriefProjectItem.friendlyName property

Project friendly name

## Signature

```typescript
friendlyName: string;
```

### itemtype

# IDMT\_BriefProjectItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.PROJECT | EDMT_ItemType.CBB_PROJECT;
```

### teamuuid

# IDMT\_BriefProjectItem.teamUuid property

UUID of the team it belongs to

## Signature

```typescript
teamUuid: string;
```

### uuid

# IDMT\_BriefProjectItem.uuid property

Project UUID

## Signature

```typescript
uuid: string;
```
