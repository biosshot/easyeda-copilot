# SCH\_Drc class

Schematic &amp; symbol / design rule check (DRC) class

## Signature

```typescript
class SCH_Drc
```

## Remarks

Check and set DRC rules

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[check(strict, userInterface, includeVerboseError)](./SCH_Drc.md)||**_(BETA)_** Check DRC|
|[check(strict, userInterface, includeVerboseError)](./SCH_Drc.md)||**_(BETA)_** Check DRC|

---

## 方法详情

### check

# SCH\_Drc.check() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Check DRC

## Signature

```typescript
function check(
	strict: boolean,
	userInterface: boolean,
	includeVerboseError: false,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|strict|boolean|Whether strict checking is enabled. The current schematic is uniformly in strict checking mode|
|userInterface|boolean|Whether to show the UI (open the bottom DRC window)|
|includeVerboseError|false|Whether to include detailed error information in the return value. If it is `true`<!-- -->, the return value will always be an array|

## Returns

Promise&lt;boolean&gt;

Whether the DRC check passed

## Example

```javascript
// 1. 创建测试原理图并打开（DRC 作用于当前激活的原理图）
const schematicUuid = await eda.dmt_Schematic.createSchematic();
await new Promise(r => setTimeout(r, 1500));
const schInfo = await eda.dmt_Schematic.getSchematicInfo(schematicUuid);
await eda.dmt_EditorControl.openDocument(schInfo.page[0].uuid);
await new Promise(r => setTimeout(r, 1000));

// 2. 详细模式：返回全部违规项，无违规则为空数组
const violations = await eda.sch_Drc.check(true, false, true);
console.log('violationCount:', violations.length);
violations.forEach((v, i) => {
	console.log(`[${i}]`, typeof v === 'string' ? v : JSON.stringify(v));
});

// 3. 布尔模式：只返回是否全部通过
const passed = await eda.sch_Drc.check(true, false, false);
console.log('allPassed:', passed);

// 4. 清理测试原理图
await new Promise(r => setTimeout(r, 1500));
await eda.dmt_Schematic.deleteSchematic(schematicUuid);
```


### check_1

# SCH\_Drc.check() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Check DRC

## Signature

```typescript
function check(
	strict: boolean,
	userInterface: boolean,
	includeVerboseError: true,
): Promise<Array<any>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|strict|boolean|Whether strict checking is enabled. The current schematic is uniformly in strict checking mode|
|userInterface|boolean|Whether to show the UI (open the bottom DRC window)|
|includeVerboseError|true|Whether to include detailed error information in the return value. If it is `true`<!-- -->, the return value will always be an array. ADD since EDA v4.2|

## Returns

Promise&lt;Array&lt;any&gt;&gt;

Detailed results of the DRC check
