# IPCB\_AutoLayoutResult interface

Auto layout result

## Signature

```typescript
interface IPCB_AutoLayoutResult
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[duration](./IPCB_AutoLayoutResult.md)||number|Auto layout duration (milliseconds)|
|[failedComponents](./IPCB_AutoLayoutResult.md)||Array&lt;string&gt;|List of device primitive IDs that failed to be laid out|
|[success](./IPCB_AutoLayoutResult.md)||boolean|Whether auto layout started successfully|
|[successComponentsCount](./IPCB_AutoLayoutResult.md)||number|Number of devices that were laid out successfully|
|[totalComponentsCount](./IPCB_AutoLayoutResult.md)||number|Total number of devices participating in auto layout|

---

## 属性详情

### duration

# IPCB\_AutoLayoutResult.duration property

Auto layout duration (milliseconds)

## Signature

```typescript
duration: number;
```

### failedcomponents

# IPCB\_AutoLayoutResult.failedComponents property

List of device primitive IDs that failed to be laid out

## Signature

```typescript
failedComponents: Array<string>;
```

### success

# IPCB\_AutoLayoutResult.success property

Whether auto layout started successfully

## Signature

```typescript
success: boolean;
```

### successcomponentscount

# IPCB\_AutoLayoutResult.successComponentsCount property

Number of devices that were laid out successfully

## Signature

```typescript
successComponentsCount: number;
```

### totalcomponentscount

# IPCB\_AutoLayoutResult.totalComponentsCount property

Total number of devices participating in auto layout

## Signature

```typescript
totalComponentsCount: number;
```
