# SCH\_SimulationEngine class

Schematic &amp; symbol / simulation engine class

## Signature

```typescript
class SCH_SimulationEngine
```

## Remarks

Controls the docking and interaction of the simulation engine

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[pushData(eventType, props)](./SCH_SimulationEngine.md)||Send data to the simulation kernel|

---

## 方法详情

### pushdata

# SCH\_SimulationEngine.pushData() method

Send data to the simulation kernel

## Signature

```typescript
function pushData(
	eventType: ESCH_DynamicSimulationEnginePushEventType | ESCH_SpiceSimulationEnginePushEventType,
	props: { [key: string]: any },
): void;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|eventType|[ESCH\_DynamicSimulationEnginePushEventType](../enums/ESCH_DynamicSimulationEnginePushEventType.md) \| [ESCH\_SpiceSimulationEnginePushEventType](../enums/ESCH_SpiceSimulationEnginePushEventType.md)|Event type|
|props|\{ \[key: string\]: any \}|Data|

## Returns

void

## Example

```javascript
// 1. 推送动态仿真的会话状态（SESSION_STATE：RUNNING/PAUSED/STOPPED 等）
eda.sch_SimulationEngine.pushData('SESSION_STATE', {
	state: 'RUNNING',
});

// 2. 推送动态仿真的实时数据帧（STREAM_DATA：波形点/节点电压等内部量）
eda.sch_SimulationEngine.pushData('STREAM_DATA', {
	time: 0.001,
	signals: { VOUT: 3.3, ILOAD: 0.02 },
});

// 3. 推送 SPICE 仿真的仿真结果（SIMULATION_RESULT：分析类型 + 数据点）
eda.sch_SimulationEngine.pushData('SIMULATION_RESULT', {
	analysis: 'tran',
	points: [
		{ t: 0, v: 0 },
		{ t: 0.001, v: 3.3 },
	],
});

console.log('已向仿真内核推送 3 组数据：SESSION_STATE、STREAM_DATA、SIMULATION_RESULT');
```
