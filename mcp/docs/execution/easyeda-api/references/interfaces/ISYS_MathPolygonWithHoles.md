# ISYS\_MathPolygonWithHoles interface

Polygon with holes

## Signature

```typescript
interface ISYS_MathPolygonWithHoles
```

## Remarks

Contains one outer ring and zero to multiple holes (inner rings), preserving the complete topology

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[holes](./ISYS_MathPolygonWithHoles.md)||Array&lt;Array&lt;[ISYS\_MathPoint](./ISYS_MathPoint.md)<!-- -->&gt;&gt;|Array of holes (inner rings)|
|[outer](./ISYS_MathPolygonWithHoles.md)||Array&lt;[ISYS\_MathPoint](./ISYS_MathPoint.md)<!-- -->&gt;|Outer ring|

---

## 属性详情

### holes

# ISYS\_MathPolygonWithHoles.holes property

Array of holes (inner rings)

## Signature

```typescript
holes: Array<Array<ISYS_MathPoint>>;
```

### outer

# ISYS\_MathPolygonWithHoles.outer property

Outer ring

## Signature

```typescript
outer: Array<ISYS_MathPoint>;
```
