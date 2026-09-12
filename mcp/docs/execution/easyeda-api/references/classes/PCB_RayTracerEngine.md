# PCB\_RayTracerEngine class

PCB &amp; footprint / ray tracer engine class

## Signature

```typescript
class PCB_RayTracerEngine
```

## Remarks

Controls the docking and interaction of the ray tracer engine

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[dispose()](./PCB_RayTracerEngine.md)||**_(BETA)_** Stop the ray tracer engine|
|[getLightConfigurations(lightName)](./PCB_RayTracerEngine.md)||**_(BETA)_** Get the ray tracer light configurations|
|[getRenderConfigurations()](./PCB_RayTracerEngine.md)||**_(BETA)_** Get the ray tracer render configurations|
|[init()](./PCB_RayTracerEngine.md)||**_(BETA)_** Initialize the ray tracer engine|
|[setRenderConfigurations(configurations)](./PCB_RayTracerEngine.md)||**_(BETA)_** Set the ray tracer render configurations|

---

## 方法详情

### dispose

# PCB\_RayTracerEngine.dispose() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Stop the ray tracer engine

## Signature

```typescript
function dispose(): Promise<void>;
```

## Returns

Promise&lt;void&gt;

## Remarks

ADD since EDA v4

### getlightconfigurations

# PCB\_RayTracerEngine.getLightConfigurations() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the ray tracer light configurations

## Signature

```typescript
function getLightConfigurations(lightName: string): Promise<any>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|lightName|string||

## Returns

Promise&lt;any&gt;

Light configuration

## Remarks

The [get ray tracer render configurations](./PCB_RayTracerEngine.md) API contains a light configuration. This API is used to get different light configurations

The configuration definition of this API is still in progress ADD since EDA v4

### getrenderconfigurations

# PCB\_RayTracerEngine.getRenderConfigurations() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the ray tracer render configurations

## Signature

```typescript
function getRenderConfigurations(): Promise<any>;
```

## Returns

Promise&lt;any&gt;

Render configuration

## Remarks

The configuration definition of this API is still in progress ADD since EDA v4

### init

# PCB\_RayTracerEngine.init() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Initialize the ray tracer engine

## Signature

```typescript
function init(): Promise<void>;
```

## Returns

Promise&lt;void&gt;

## Remarks

ADD since EDA v4

### setrenderconfigurations

# PCB\_RayTracerEngine.setRenderConfigurations() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set the ray tracer render configurations

## Signature

```typescript
function setRenderConfigurations(configurations: any): Promise<void>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|configurations|any|Render configuration|

## Returns

Promise&lt;void&gt;

## Remarks

The configuration definition of this API is still in progress ADD since EDA v4
