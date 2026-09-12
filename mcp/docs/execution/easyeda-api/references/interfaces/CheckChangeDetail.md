# CheckChangeDetail interface

勾选变更详情

## Signature

```typescript
interface CheckChangeDetail
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[row?](./CheckChangeDetail.md)||Record&lt;string, any&gt;|_(Optional)_ 相关行数据|
|[trigger](./CheckChangeDetail.md)||'rowsUpdate' \| 'checkListUpdate' \| 'user'|变更来源|

---

## 属性详情

### row

# CheckChangeDetail.row property

相关行数据

## Signature

```typescript
row?: Record<string, any>;
```

### trigger

# CheckChangeDetail.trigger property

变更来源

## Signature

```typescript
trigger: 'rowsUpdate' | 'checkListUpdate' | 'user';
```
