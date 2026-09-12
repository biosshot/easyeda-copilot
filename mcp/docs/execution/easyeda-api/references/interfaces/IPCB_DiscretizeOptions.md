# IPCB\_DiscretizeOptions interface

Discretization options

## Signature

```typescript
interface IPCB_DiscretizeOptions
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[step?](./IPCB_DiscretizeOptions.md)||number|_(Optional)_ 离散步长，即相邻离散点之间的最大距离|

---

## 属性详情

### step

# IPCB\_DiscretizeOptions.step property

离散步长，即相邻离散点之间的最大距离

## Signature

```typescript
step?: number;
```

## Remarks

步长越小，离散点越密集，精度越高；步长单位与多边形坐标单位一致
