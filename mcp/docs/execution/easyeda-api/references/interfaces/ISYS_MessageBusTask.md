# ISYS\_MessageBusTask interface

Message bus task

## Signature

```typescript
interface ISYS_MessageBusTask
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[cancel](./ISYS_MessageBusTask.md)||() =&gt; void|调用以取消任务|
|[execute](./ISYS_MessageBusTask.md)||(message: any) =&gt; Promise&lt;void&gt;|任务处理|
|[running](./ISYS_MessageBusTask.md)||() =&gt; boolean|检查运行状态|

---

## 属性详情

### cancel

# ISYS\_MessageBusTask.cancel property

调用以取消任务

## Signature

```typescript
cancel: () => void;
```

### execute

# ISYS\_MessageBusTask.execute property

任务处理

## Signature

```typescript
execute: (message: any) => Promise<void>;
```

### running

# ISYS\_MessageBusTask.running property

检查运行状态

## Signature

```typescript
running: () => boolean;
```
