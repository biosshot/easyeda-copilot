# IPCB\_AutoRoutingResult interface

Auto routing result

## Signature

```typescript
interface IPCB_AutoRoutingResult
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[duration](./IPCB_AutoRoutingResult.md)||number|Auto routing duration (milliseconds)|
|[failedNets](./IPCB_AutoRoutingResult.md)||Array&lt;string&gt;|List of net names that failed to be routed|
|[success](./IPCB_AutoRoutingResult.md)||boolean|Whether auto routing started successfully|
|[successNetsCount](./IPCB_AutoRoutingResult.md)||number|Number of nets that were routed successfully|
|[totalNetsCount](./IPCB_AutoRoutingResult.md)||number|Total number of nets participating in auto routing|

---

## 属性详情

### duration

# IPCB\_AutoRoutingResult.duration property

Auto routing duration (milliseconds)

## Signature

```typescript
duration: number;
```

### failednets

# IPCB\_AutoRoutingResult.failedNets property

List of net names that failed to be routed

## Signature

```typescript
failedNets: Array<string>;
```

### success

# IPCB\_AutoRoutingResult.success property

Whether auto routing started successfully

## Signature

```typescript
success: boolean;
```

### successnetscount

# IPCB\_AutoRoutingResult.successNetsCount property

Number of nets that were routed successfully

## Signature

```typescript
successNetsCount: number;
```

### totalnetscount

# IPCB\_AutoRoutingResult.totalNetsCount property

Total number of nets participating in auto routing

## Signature

```typescript
totalNetsCount: number;
```
