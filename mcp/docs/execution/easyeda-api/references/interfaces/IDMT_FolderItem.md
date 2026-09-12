# IDMT\_FolderItem interface

Folder property

## Signature

```typescript
interface IDMT_FolderItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[childrenFoldersUuid?](./IDMT_FolderItem.md)||Array&lt;string&gt;|_(Optional)_ List of child folder UUIDs|
|[description?](./IDMT_FolderItem.md)||string|_(Optional)_ Folder description|
|[itemType](./IDMT_FolderItem.md)|`readonly`|[EDMT\_ItemType.FOLDER](../enums/EDMT_ItemType.md)|Project type|
|[name](./IDMT_FolderItem.md)||string|Folder name|
|[parentFolderUuid](./IDMT_FolderItem.md)||string|Parent folder UUID|
|[teamUuid](./IDMT_FolderItem.md)||string|UUID of the team it belongs to|
|[uuid](./IDMT_FolderItem.md)||string|Folder UUID|

---

## 属性详情

### childrenfoldersuuid

# IDMT\_FolderItem.childrenFoldersUuid property

List of child folder UUIDs

## Signature

```typescript
childrenFoldersUuid?: Array<string>;
```

### description

# IDMT\_FolderItem.description property

Folder description

## Signature

```typescript
description?: string;
```

### itemtype

# IDMT\_FolderItem.itemType property

Project type

## Signature

```typescript
readonly itemType: EDMT_ItemType.FOLDER;
```

### name

# IDMT\_FolderItem.name property

Folder name

## Signature

```typescript
name: string;
```

### parentfolderuuid

# IDMT\_FolderItem.parentFolderUuid property

Parent folder UUID

## Signature

```typescript
parentFolderUuid: string;
```

### teamuuid

# IDMT\_FolderItem.teamUuid property

UUID of the team it belongs to

## Signature

```typescript
teamUuid: string;
```

### uuid

# IDMT\_FolderItem.uuid property

Folder UUID

## Signature

```typescript
uuid: string;
```
