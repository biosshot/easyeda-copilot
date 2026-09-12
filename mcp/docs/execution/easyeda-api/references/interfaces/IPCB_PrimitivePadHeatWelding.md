# IPCB\_PrimitivePadHeatWelding interface

Pad thermal relief optimization parameters

## Signature

```typescript
interface IPCB_PrimitivePadHeatWelding
```

## Remarks

When the connection method ([connectionMethod](./IPCB_PrimitivePadHeatWelding.md)<!-- -->) is direct connection ([DIRECT\_CONNECTED](../enums/EPCB_PrimitivePadHeatWeldingConnectionMethod.md)<!-- -->) or no connection ([NON\_CONNECTED](../enums/EPCB_PrimitivePadHeatWeldingConnectionMethod.md)<!-- -->), the settings of divergence spacing, divergence line width, and divergence angle will be ignored

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[connectionMethod](./IPCB_PrimitivePadHeatWelding.md)||[EPCB\_PrimitivePadHeatWeldingConnectionMethod](../enums/EPCB_PrimitivePadHeatWeldingConnectionMethod.md)|Connection method|
|[divergenceAngle?](./IPCB_PrimitivePadHeatWelding.md)||number|_(Optional)_ Divergence angle|
|[divergenceLineWidth?](./IPCB_PrimitivePadHeatWelding.md)||number|_(Optional)_ Divergence line width|
|[divergenceSpacing?](./IPCB_PrimitivePadHeatWelding.md)||number|_(Optional)_ Divergence spacing|

---

## 属性详情

### divergenceangle

# IPCB\_PrimitivePadHeatWelding.divergenceAngle property

Divergence angle

## Signature

```typescript
divergenceAngle?: number;
```

### divergencelinewidth

# IPCB\_PrimitivePadHeatWelding.divergenceLineWidth property

Divergence line width

## Signature

```typescript
divergenceLineWidth?: number;
```

### divergencespacing

# IPCB\_PrimitivePadHeatWelding.divergenceSpacing property

Divergence spacing

## Signature

```typescript
divergenceSpacing?: number;
```


---

## 方法详情

### connectionmethod

# IPCB\_PrimitivePadHeatWelding.connectionMethod property

Connection method

## Signature

```typescript
connectionMethod: EPCB_PrimitivePadHeatWeldingConnectionMethod;
```
