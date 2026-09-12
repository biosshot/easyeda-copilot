# SCH\_Event class

Schematic &amp; symbol / event class

## Signature

```typescript
class SCH_Event
```

## Remarks

Register an event callback

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[addMouseEventListener(id, eventType, callFn, onlyOnce)](./SCH_Event.md)||Add a mouse event listener|
|[addPrimitiveEventListener(id, eventType, callFn, onlyOnce)](./SCH_Event.md)||**_(BETA)_** Add a primitive event listener|
|[addSimulationEnginePullEventListener(id, eventType, callFn)](./SCH_Event.md)||**_(BETA)_** Register a simulation engine pull event listener|
|[isEventListenerAlreadyExist(id)](./SCH_Event.md)||Query whether the event listener exists|
|[removeEventListener(id)](./SCH_Event.md)||Remove Event listener|

---

## 方法详情

### addmouseeventlistener

# SCH\_Event.addMouseEventListener() method

Add a mouse event listener

## Signature

```typescript
function addMouseEventListener(
	id: string,
	eventType: 'all' | ESCH_MouseEventType,
	callFn: (eventType: ESCH_MouseEventType) => void | Promise<void>,
	onlyOnce?: boolean,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Event ID, used to prevent duplicate event registration|
|eventType|'all' \| [ESCH\_MouseEventType](../enums/ESCH_MouseEventType.md)|Event type|
|callFn|(eventType: [ESCH\_MouseEventType](../enums/ESCH_MouseEventType.md)<!-- -->) =&gt; void \| Promise&lt;void&gt;|The callback function triggered when the event fires|
|onlyOnce|boolean|_(Optional)_ Whether to listen only once|

## Returns

void

## Remarks

Note: This API is only valid for extensions. Calling it in a standalone script environment will always `throw Error`

## Example

```javascript
const listenerId = '嘉立创示例_sch_mouse_event';

// 1. 注册鼠标事件监听，eventType 用 'all' 接收全部鼠标事件，onlyOnce 为 false 持续监听
eda.sch_Event.addMouseEventListener(
	listenerId,
	'all',
	(eventType) => {
		// 回调在用户画布操作时触发
		console.log('mouseEvent:', eventType);
	},
	false
);

// 2. 回读确认注册成功
const registered = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('registered:', registered);

// 3. 清理监听
const removed = eda.sch_Event.removeEventListener(listenerId);
console.log('removed:', removed);
```


### addprimitiveeventlistener

# SCH\_Event.addPrimitiveEventListener() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Add a primitive event listener

## Signature

```typescript
function addPrimitiveEventListener(
	id: string,
	eventType: 'all' | ESCH_PrimitiveEventType,
	callFn: (
		eventType: ESCH_PrimitiveEventType,
		props: { primitiveIds: Array<string> },
	) => void | Promise<void>,
	onlyOnce?: boolean,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Event ID, used to prevent duplicate event registration|
|eventType|'all' \| [ESCH\_PrimitiveEventType](../enums/ESCH_PrimitiveEventType.md)|Event type|
|callFn|(eventType: [ESCH\_PrimitiveEventType](../enums/ESCH_PrimitiveEventType.md)<!-- -->, props: { primitiveIds: Array&lt;string&gt; }) =&gt; void \| Promise&lt;void&gt;|The callback function triggered when the event fires|
|onlyOnce|boolean|_(Optional)_ Whether to listen only once|

## Returns

void

## Remarks

Note: This API is only valid for extensions. Calling it in a standalone script environment will always `throw Error`

## Example

```javascript
const listenerId = '嘉立创示例_sch_primitive_event';

// 1. 注册图元事件监听，eventType 用 'all' 接收全部图元事件
eda.sch_Event.addPrimitiveEventListener(
	listenerId,
	'all',
	(eventType, props) => {
		// 回调在画布图元变化时触发
		console.log('primitiveEvent:', eventType, JSON.stringify(props?.primitiveIds));
	},
	false
);

// 2. 回读确认注册成功
const registered = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('registered:', registered);

// 3. 清理监听
const removed = eda.sch_Event.removeEventListener(listenerId);
console.log('removed:', removed);
```


### addsimulationenginepulleventlistener

# SCH\_Event.addSimulationEnginePullEventListener() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Register a simulation engine pull event listener

## Signature

```typescript
function addSimulationEnginePullEventListener(
	id: string,
	eventType: 'all',
	callFn: (
		eventType:
			ESCH_DynamicSimulationEnginePullEventType | ESCH_SpiceSimulationEnginePullEventType,
		props: { [key: string]: any },
	) => void | Promise<void>,
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Event ID, used to prevent duplicate event registration|
|eventType|'all'|Event type|
|callFn|(eventType: [ESCH\_DynamicSimulationEnginePullEventType](../enums/ESCH_DynamicSimulationEnginePullEventType.md) \| [ESCH\_SpiceSimulationEnginePullEventType](../enums/ESCH_SpiceSimulationEnginePullEventType.md)<!-- -->, props: { \[key: string\]: any }) =&gt; void \| Promise&lt;void&gt;|The callback function triggered when the event fires|

## Returns

void

## Remarks

Note: This API is only valid for extensions. Calling it in a standalone script environment will always `throw Error`

## Example

```javascript
const listenerId = '嘉立创示例_sch_simulation_pull_event';

// 1. 注册仿真引擎拉取事件监听，eventType 固定传 'all'
eda.sch_Event.addSimulationEnginePullEventListener(
	listenerId,
	'all',
	(eventType, props) => {
		// 回调在仿真引擎拉取数据时触发
		console.log('pullEvent:', eventType, JSON.stringify(props));
	}
);

// 2. 回读确认注册成功
const registered = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('registered:', registered);

// 3. 清理监听
const removed = eda.sch_Event.removeEventListener(listenerId);
console.log('removed:', removed);
```


### iseventlisteneralreadyexist

# SCH\_Event.isEventListenerAlreadyExist() method

Query whether the event listener exists

## Signature

```typescript
function isEventListenerAlreadyExist(id: string): boolean;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Event ID|

## Returns

boolean

Whether the event listener exists

## Example

```javascript
const listenerId = '嘉立创示例_sch_event_exist';

// 1. 注册前查询：应为 false
const before = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('before:', before);

// 2. 注册一个鼠标事件监听使 id 生效
eda.sch_Event.addMouseEventListener(listenerId, 'all', () => {}, false);

// 3. 注册后查询：应为 true
const after = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('after:', after);

// 4. 移除后查询：应回到 false
eda.sch_Event.removeEventListener(listenerId);
const afterRemove = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('afterRemove:', afterRemove);
```


### removeeventlistener

# SCH\_Event.removeEventListener() method

Remove Event listener

## Signature

```typescript
function removeEventListener(id: string): boolean;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|id|string|Event ID|

## Returns

boolean

Whether Remove Specify event listener

## Example

```javascript
const listenerId = '嘉立创示例_sch_event_remove';

// 1. 先注册一个鼠标事件监听作为移除目标
eda.sch_Event.addMouseEventListener(listenerId, 'all', () => {}, false);
const registered = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('registered:', registered);

// 2. 移除该监听
const removed = eda.sch_Event.removeEventListener(listenerId);
console.log('removed:', removed);

// 3. 回读确认已不存在
const existAfter = eda.sch_Event.isEventListenerAlreadyExist(listenerId);
console.log('existAfter:', existAfter);

// 4. 重复移除同一 id：返回 false（本就未注册）
const removedAgain = eda.sch_Event.removeEventListener(listenerId);
console.log('removedAgain:', removedAgain);
```
