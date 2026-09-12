# IDMT\_ProjectItem interface

Project property

## Signature

```typescript
interface IDMT_ProjectItem extends IDMT_BriefProjectItem
```
**Extends:** [IDMT\_BriefProjectItem](./IDMT_BriefProjectItem.md)

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[collaborationMode?](./IDMT_ProjectItem.md)||[EDMT\_ProjectCollaborationMode](../enums/EDMT_ProjectCollaborationMode.md)|_(Optional)_ Project collaboration mode|
|[data](./IDMT_ProjectItem.md)||Array&lt;[IDMT\_BoardItem](./IDMT_BoardItem.md) \| [IDMT\_SchematicItem](./IDMT_SchematicItem.md) \| [IDMT\_PcbItem](./IDMT_PcbItem.md) \| [IDMT\_PanelItem](./IDMT_PanelItem.md)<!-- -->&gt;|Project in document data|
|[description?](./IDMT_ProjectItem.md)||string|_(Optional)_ Description|
|[name](./IDMT_ProjectItem.md)||string|Project link name|

---

## 属性详情

### collaborationmode

# IDMT\_ProjectItem.collaborationMode property

Project collaboration mode

## Signature

```typescript
collaborationMode?: EDMT_ProjectCollaborationMode;
```

### data

# IDMT\_ProjectItem.data property

Project in document data

## Signature

```typescript
data: Array<IDMT_BoardItem | IDMT_SchematicItem | IDMT_PcbItem | IDMT_PanelItem>;
```

### description

# IDMT\_ProjectItem.description property

Description

## Signature

```typescript
description?: string;
```

### name

# IDMT\_ProjectItem.name property

Project link name

## Signature

```typescript
name: string;
```
