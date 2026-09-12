# ILIB\_SimulationModelItem interface

Simulation model properties

## Signature

```typescript
interface ILIB_SimulationModelItem
```

## Properties

|Property|Modifiers|Type|Description|
|---|---|---|---|
|[classification?](./ILIB_SimulationModelItem.md)||Array&lt;string&gt;|_(Optional)_ Classification|
|[description?](./ILIB_SimulationModelItem.md)||string|_(Optional)_ Description|
|[libraryType](./ILIB_SimulationModelItem.md)|`readonly`|[ELIB\_LibraryType.SIMULATION\_MODEL\_NGSPICE](../enums/ELIB_LibraryType.md) \| [ELIB\_LibraryType.SIMULATION\_MODEL\_SIMULIDE](../enums/ELIB_LibraryType.md)|Library type|
|[libraryUuid](./ILIB_SimulationModelItem.md)||string|UUID of the library it belongs to|
|[modelCategory](./ILIB_SimulationModelItem.md)||string|Simulation model category|
|[modelData](./ILIB_SimulationModelItem.md)||string|Simulation model data|
|[modelPin](./ILIB_SimulationModelItem.md)||string|Simulation model pin|
|[name](./ILIB_SimulationModelItem.md)||string|Simulation model name|
|[type](./ILIB_SimulationModelItem.md)||[ELIB\_SimulationModelType](../enums/ELIB_SimulationModelType.md)|Simulation model type|
|[uuid](./ILIB_SimulationModelItem.md)||string|Simulation model UUID|

---

## 属性详情

### classification

# ILIB\_SimulationModelItem.classification property

Classification

## Signature

```typescript
classification?: Array<string>;
```

### description

# ILIB\_SimulationModelItem.description property

Description

## Signature

```typescript
description?: string;
```

### librarytype

# ILIB\_SimulationModelItem.libraryType property

Library type

## Signature

```typescript
readonly libraryType: ELIB_LibraryType.SIMULATION_MODEL_NGSPICE | ELIB_LibraryType.SIMULATION_MODEL_SIMULIDE;
```

### libraryuuid

# ILIB\_SimulationModelItem.libraryUuid property

UUID of the library it belongs to

## Signature

```typescript
libraryUuid: string;
```

### modelcategory

# ILIB\_SimulationModelItem.modelCategory property

Simulation model category

## Signature

```typescript
modelCategory: string;
```

### modeldata

# ILIB\_SimulationModelItem.modelData property

Simulation model data

## Signature

```typescript
modelData: string;
```

### modelpin

# ILIB\_SimulationModelItem.modelPin property

Simulation model pin

## Signature

```typescript
modelPin: string;
```

### name

# ILIB\_SimulationModelItem.name property

Simulation model name

## Signature

```typescript
name: string;
```

### type

# ILIB\_SimulationModelItem.type property

Simulation model type

## Signature

```typescript
type: ELIB_SimulationModelType;
```

### uuid

# ILIB\_SimulationModelItem.uuid property

Simulation model UUID

## Signature

```typescript
uuid: string;
```
