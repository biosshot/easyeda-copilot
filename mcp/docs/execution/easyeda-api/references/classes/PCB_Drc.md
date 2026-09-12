# PCB\_Drc class

PCB &amp; footprint / design rule check (DRC) class

## Signature

```typescript
class PCB_Drc
```

## Remarks

Check and set DRC rules

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[addNetToEqualLengthNetGroup(equalLengthNetGroupName, net)](./PCB_Drc.md)||**_(BETA)_** Add a net to an equal-length net group|
|[addNetToNetClass(netClassName, net)](./PCB_Drc.md)||**_(BETA)_** Will net add to net class|
|[addPadPairToPadPairGroup(padPairGroupName, padPair)](./PCB_Drc.md)||**_(BETA)_** Add a pad pair to a pad pair group|
|[check(strict, userInterface, includeVerboseError)](./PCB_Drc.md)||**_(BETA)_** Check DRC|
|[check(strict, userInterface, includeVerboseError)](./PCB_Drc.md)||**_(BETA)_** Check DRC|
|[createDifferentialPair(differentialPairName, positiveNet, negativeNet)](./PCB_Drc.md)||**_(BETA)_** Create a differential pair|
|[createEqualLengthNetGroup(equalLengthNetGroupName, nets, color)](./PCB_Drc.md)||**_(BETA)_** Create an equal-length net group|
|[createNetClass(netClassName, nets, color)](./PCB_Drc.md)||**_(BETA)_** Create Net class|
|[createPadPairGroup(padPairGroupName, padPairs)](./PCB_Drc.md)||**_(BETA)_** Create a pad pair group|
|[deleteDifferentialPair(differentialPairName)](./PCB_Drc.md)||**_(BETA)_** Delete the differential pair|
|[deleteEqualLengthNetGroup(equalLengthNetGroupName)](./PCB_Drc.md)||**_(BETA)_** Delete the equal-length net group|
|[deleteNetClass(netClassName)](./PCB_Drc.md)||**_(BETA)_** Delete Net class|
|[deletePadPairGroup(padPairGroupName)](./PCB_Drc.md)||**_(BETA)_** Delete the pad pair group|
|[deleteRuleConfiguration(configurationName)](./PCB_Drc.md)||**_(BETA)_** Delete Design rule configuration|
|[getAllDifferentialPairs()](./PCB_Drc.md)||**_(BETA)_** Get the detailed properties of all differential pairs|
|[getAllEqualLengthNetGroups()](./PCB_Drc.md)||**_(BETA)_** Get the detailed properties of all equal-length net groups|
|[getAllNetClasses()](./PCB_Drc.md)||**_(BETA)_** Get all Net class detailed properties of|
|[getAllPadPairGroups()](./PCB_Drc.md)||**_(BETA)_** Get the detailed properties of all pad pair groups|
|[getAllRuleConfigurations(includeSystem)](./PCB_Drc.md)||**_(BETA)_** Get all Design rule configuration|
|[getCurrentRuleConfiguration()](./PCB_Drc.md)||**_(BETA)_** Get Current design rule configuration|
|[getCurrentRuleConfigurationName()](./PCB_Drc.md)||Get Current design rule configuration name|
|[getDefaultRuleConfigurationName()](./PCB_Drc.md)||**_(BETA)_** Get the name of the default design rule configuration for new PCBs|
|[getNetByNetRules()](./PCB_Drc.md)||**_(BETA)_** Get Net - net rules|
|[getNetRules()](./PCB_Drc.md)||**_(BETA)_** Get Net rules|
|[getPadPairGroupMinWireLength(padPairGroupName)](./PCB_Drc.md)||**_(BETA)_** Get the minimum wire length of a pad pair group|
|[getRegionRules()](./PCB_Drc.md)||**_(BETA)_** Get region rules|
|[getRuleConfiguration(configurationName)](./PCB_Drc.md)||Get Specify design rule configuration|
|[modifyDifferentialPairName(originalDifferentialPairName, differentialPairName)](./PCB_Drc.md)||**_(BETA)_** Modify the name of the differential pair|
|[modifyDifferentialPairNegativeNet(differentialPairName, negativeNet)](./PCB_Drc.md)||**_(BETA)_** Modify the negative net of the differential pair|
|[modifyDifferentialPairPositiveNet(differentialPairName, positiveNet)](./PCB_Drc.md)||**_(BETA)_** Modify the positive net of the differential pair|
|[modifyEqualLengthNetGroupName(originalEqualLengthNetGroupName, equalLengthNetGroupName)](./PCB_Drc.md)||**_(BETA)_** Modify the name of the equal-length net group|
|[modifyNetClassName(originalNetClassName, netClassName)](./PCB_Drc.md)||**_(BETA)_** Modify Net class name of|
|[modifyPadPairGroupName(originalPadPairGroupName, padPairGroupName)](./PCB_Drc.md)||**_(BETA)_** Modify the name of the pad pair group|
|[overwriteCurrentRuleConfiguration(ruleConfiguration)](./PCB_Drc.md)||**_(BETA)_** Overwrite current design rule configuration|
|[overwriteNetByNetRules(netByNetRules)](./PCB_Drc.md)||**_(BETA)_** Overwrite net - net rules|
|[overwriteNetRules(netRules)](./PCB_Drc.md)||**_(BETA)_** Overwrite net rules|
|[overwriteRegionRules(regionRules)](./PCB_Drc.md)||**_(BETA)_** Overwrite region rules|
|[removeNetFromEqualLengthNetGroup(equalLengthNetGroupName, net)](./PCB_Drc.md)||**_(BETA)_** Remove a net from an equal-length net group|
|[removeNetFromNetClass(netClassName, net)](./PCB_Drc.md)||**_(BETA)_** From net class in remove net|
|[removePadPairFromPadPairGroup(padPairGroupName, padPair)](./PCB_Drc.md)||**_(BETA)_** Remove a pad pair from a pad pair group|
|[renameRuleConfiguration(originalConfigurationName, configurationName)](./PCB_Drc.md)||**_(BETA)_** Rename the design rule configuration|
|[saveRuleConfiguration(ruleConfiguration, configurationName, allowOverwrite)](./PCB_Drc.md)||**_(BETA)_** Save Design rule configuration|
|[setAsDefaultRuleConfiguration(configurationName)](./PCB_Drc.md)||**_(BETA)_** Set as the default design rule configuration for new PCBs|

---

## 方法详情

### addnettoequallengthnetgroup

# PCB\_Drc.addNetToEqualLengthNetGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Add a net to an equal-length net group

## Signature

```typescript
function addNetToEqualLengthNetGroup(
	equalLengthNetGroupName: string,
	net: string | Array<string>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|equalLengthNetGroupName|string|Equal-length net group name|
|net|string \| Array&lt;string&gt;|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 准备三个真实网络（放带网络的测试焊盘，模拟一组数据总线）
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_D0', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_D1', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '3', x + 1000, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_D2', null, 0, 0, 0, false, 0);

// 2. 先建空等长组，再逐个/批量添加网络
await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_等长网络组', [], { r: 0, g: 255, b: 0, alpha: 1 });
const addedOne = await eda.pcb_Drc.addNetToEqualLengthNetGroup('嘉立创示例_等长网络组', 'JLC_DEMO_D0');
const addedBatch = await eda.pcb_Drc.addNetToEqualLengthNetGroup('嘉立创示例_等长网络组', ['JLC_DEMO_D1', 'JLC_DEMO_D2']);

console.log('addedOne:', addedOne);
console.log('addedBatch:', addedBatch);
```


### addnettonetclass

# PCB\_Drc.addNetToNetClass() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Will net add to net class

## Signature

```typescript
function addNetToNetClass(netClassName: string, net: string | Array<string>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netClassName|string|Net class name|
|net|string \| Array&lt;string&gt;|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 准备三个真实网络（放带网络的测试焊盘）
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_P', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_N', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '3', x + 1000, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_CLK', null, 0, 0, 0, false, 0);

// 2. 先建网络类，再逐个/批量添加网络
await eda.pcb_Drc.createNetClass('嘉立创示例_网络类', [], { r: 255, g: 0, b: 0, alpha: 1 });
const addedOne = await eda.pcb_Drc.addNetToNetClass('嘉立创示例_网络类', 'JLC_DEMO_P');
const addedBatch = await eda.pcb_Drc.addNetToNetClass('嘉立创示例_网络类', ['JLC_DEMO_N', 'JLC_DEMO_CLK']);

console.log('addedOne:', addedOne);
console.log('addedBatch:', addedBatch);
```


### addpadpairtopadpairgroup

# PCB\_Drc.addPadPairToPadPairGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Add a pad pair to a pad pair group

## Signature

```typescript
function addPadPairToPadPairGroup(
	padPairGroupName: string,
	padPair: [string, string] | Array<[string, string]>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|padPairGroupName|string|Pad pair group name|
|padPair|\[string, string\] \| Array&lt;\[string, string\]&gt;|Pad for|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

There are three different usages, and make sure the corresponding pads already exist on the canvas. They are: 1. Free pad - free pad; 2. Device pad - device pad; 3. Device pad - free pad await eda.pcb\_Drc.addPadPairToPadPairGroup('test',\['e0','e1'\]) // 游离焊盘-游离焊盘 await eda.pcb\_Drc.addPadPairToPadPairGroup('test',\['R1:1','R1:2'\]) // 器件焊盘 - 器件焊盘 await eda.pcb\_Drc.addPadPairToPadPairGroup('test',\['R1:1','e1'\]) // 器件焊盘 - 游离焊盘

### check

# PCB\_Drc.check() method

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
|strict|boolean|Whether strict checking is enabled. The current PCB is uniformly in strict checking mode|
|userInterface|boolean|Whether to show the UI (open the bottom DRC window)|
|includeVerboseError|false|Whether to include detailed error information in the return value. If it is `true`<!-- -->, the return value will always be an array|

## Returns

Promise&lt;boolean&gt;

Whether the DRC check passed

## Example

```javascript
// 1. 详细模式：返回全部违规项（含描述），无违规则为空数组
const details = await eda.pcb_Drc.check(true, false, true);
console.log('violationCount:', details.length);
details.forEach((d, i) => {
	console.log(`[${i}]`, typeof d === 'string' ? d : JSON.stringify(d));
});

// 2. 布尔模式：只返回是否全部通过
const passed = await eda.pcb_Drc.check(true, false, false);
console.log('allPassed:', passed);
```


### check_1

# PCB\_Drc.check() method

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
|strict|boolean|Whether strict checking is enabled. The current PCB is uniformly in strict checking mode|
|userInterface|boolean|Whether to show the UI (open the bottom DRC window)|
|includeVerboseError|true|Whether to include detailed error information in the return value. If it is `true`<!-- -->, the return value will always be an array|

## Returns

Promise&lt;Array&lt;any&gt;&gt;

Detailed results of the DRC check

### createdifferentialpair

# PCB\_Drc.createDifferentialPair() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create a differential pair

## Signature

```typescript
function createDifferentialPair(
	differentialPairName: string,
	positiveNet: string,
	negativeNet: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|differentialPairName|string|Differential pair name|
|positiveNet|string|Positive net name|
|negativeNet|string|Negative net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 生成本次运行专用的网络名和差分对名（差分对名和网络名不能与其他差分对重复）
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;

// 2. 放两个带差分网络的焊盘，让网络进入网表
const x = 3000 + Math.floor(Math.random() * 20000);
const padP = await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
const padN = await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);

// 3. 创建差分对（保留现场供观察）
const created = await eda.pcb_Drc.createDifferentialPair(`嘉立创示例_差分对_${ts}`, netP, netN);

console.log('pairName:', `嘉立创示例_差分对_${ts}`);
console.log('created:', created);
```


### createequallengthnetgroup

# PCB\_Drc.createEqualLengthNetGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create an equal-length net group

## Signature

```typescript
function createEqualLengthNetGroup(
	equalLengthNetGroupName: string,
	nets: Array<string>,
	color: IPCB_EqualLengthNetGroupItem['color'],
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|equalLengthNetGroupName|string|Equal-length net group name|
|nets|Array&lt;string&gt;|Net name array|
|color|[IPCB\_EqualLengthNetGroupItem](../interfaces/IPCB_EqualLengthNetGroupItem.md)<!-- -->\['color'\]|Equal-length net group color|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 创建一个空的等长网络组，指定面板显示颜色（保留现场供观察）
const created = await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_等长网络组', [], { r: 0, g: 255, b: 0, alpha: 1 });

console.log('created:', created);
```


### createnetclass

# PCB\_Drc.createNetClass() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create Net class

## Signature

```typescript
function createNetClass(
	netClassName: string,
	nets: Array<string>,
	color: IPCB_EqualLengthNetGroupItem['color'],
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netClassName|string|Net class name|
|nets|Array&lt;string&gt;|Net name array|
|color|[IPCB\_EqualLengthNetGroupItem](../interfaces/IPCB_EqualLengthNetGroupItem.md)<!-- -->\['color'\]|Net class color|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 放两个带网络的测试焊盘，让 JLC_DEMO_P / JLC_DEMO_N 进入网表
const x = 3000 + Math.floor(Math.random() * 20000);
const padP = await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_P', null, 0, 0, 0, false, 0);
const padN = await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_N', null, 0, 0, 0, false, 0);

// 2. 创建网络类并纳入这两个网络，颜色用于面板区分（保留现场供观察）
const created = await eda.pcb_Drc.createNetClass('嘉立创示例_网络类', ['JLC_DEMO_P', 'JLC_DEMO_N'], { r: 255, g: 0, b: 0, alpha: 1 });

console.log('created:', created);
```


### createpadpairgroup

# PCB\_Drc.createPadPairGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Create a pad pair group

## Signature

```typescript
function createPadPairGroup(
	padPairGroupName: string,
	padPairs: Array<[string, string]>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|padPairGroupName|string|Pad pair group name|
|padPairs|Array&lt;\[string, string\]&gt;|Pad for array|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

There are three different usages, and make sure the corresponding pads already exist on the canvas. They are: 1. Free pad - free pad; 2. Device pad - device pad; 3. Device pad - free pad await eda.pcb\_Drc.createPadPairGroup('test',\[\['e0','e1'\]\]) // 游离焊盘-游离焊盘 await eda.pcb\_Drc.createPadPairGroup('test',\[\['R1:1','R1:2'\],\['R2:1','R2:2'\]\]) // 器件焊盘 - 器件焊盘 await eda.pcb\_Drc.createPadPairGroup('test',\[\['R1:1','e0'\],\['R1:2','e1'\]\]) // 器件焊盘 - 游离焊盘

### deletedifferentialpair

# PCB\_Drc.deleteDifferentialPair() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete the differential pair

## Signature

```typescript
function deleteDifferentialPair(differentialPairName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|differentialPairName|string|Differential pair name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 生成本次运行专用的网络名和差分对名（网络不能属于其他差分对）
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;

// 2. 放带差分网络的焊盘并创建差分对
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);
const pairName = `嘉立创示例_待删差分对_${ts}`;
await eda.pcb_Drc.createDifferentialPair(pairName, netP, netN);

// 3. 删除该差分对
const result = await eda.pcb_Drc.deleteDifferentialPair(pairName);

console.log('result:', result);
```


### deleteequallengthnetgroup

# PCB\_Drc.deleteEqualLengthNetGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete the equal-length net group

## Signature

```typescript
function deleteEqualLengthNetGroup(equalLengthNetGroupName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|equalLengthNetGroupName|string|Equal-length net group name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 建一个待删除的等长网络组（重名创建是幂等的，重复运行也安全）
await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_待删等长组', [], { r: 0, g: 255, b: 0, alpha: 1 });

// 2. 删除该等长网络组
const result = await eda.pcb_Drc.deleteEqualLengthNetGroup('嘉立创示例_待删等长组');

console.log('result:', result);
```


### deletenetclass

# PCB\_Drc.deleteNetClass() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Net class

## Signature

```typescript
function deleteNetClass(netClassName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netClassName|string|Net class name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 建一个待删除的网络类（重名创建是幂等的，重复运行也安全）
await eda.pcb_Drc.createNetClass('嘉立创示例_待删网络类', [], { r: 255, g: 0, b: 0, alpha: 1 });

// 2. 删除该网络类
const result = await eda.pcb_Drc.deleteNetClass('嘉立创示例_待删网络类');

console.log('result:', result);
```


### deletepadpairgroup

# PCB\_Drc.deletePadPairGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete the pad pair group

## Signature

```typescript
function deletePadPairGroup(padPairGroupName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|padPairGroupName|string|Pad pair group name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

### deleteruleconfiguration

# PCB\_Drc.deleteRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete Design rule configuration

## Signature

```typescript
function deleteRuleConfiguration(configurationName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|configurationName|string|Configuration name|

## Returns

Promise&lt;boolean&gt;

Delete Whether Successful

## Remarks

The system configuration does not allow deletion

## Example

```javascript
// 1. 读取当前配置并保存为待删除的自定义配置
const current = await eda.pcb_Drc.getCurrentRuleConfiguration();
await eda.pcb_Drc.saveRuleConfiguration(current.config, '嘉立创示例_待删配置', true);

// 2. 删除该自定义配置
const result = await eda.pcb_Drc.deleteRuleConfiguration('嘉立创示例_待删配置');

console.log('result:', result);
```


### getalldifferentialpairs

# PCB\_Drc.getAllDifferentialPairs() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the detailed properties of all differential pairs

## Signature

```typescript
function getAllDifferentialPairs(): Promise<
	Array<IPCB_DifferentialPairItem> | { [key: string]: any }
>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_DifferentialPairItem](../interfaces/IPCB_DifferentialPairItem.md)<!-- -->&gt; \| { \[key: string\]: any }&gt;

Detailed properties of all differential pairs

## Remarks

- The return value type is changed to an object BREAKING CHANGE since EDA v3.4

## Example

```javascript
// 1. 生成本次运行专用的网络名和差分对名，创建测试差分对
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);
const pairName = `嘉立创示例_查询差分对_${ts}`;
await eda.pcb_Drc.createDifferentialPair(pairName, netP, netN);

// 2. 查询所有差分对（v3.4 起返回结构可能为数组或对象，先按数组遍历）
const pairs = await eda.pcb_Drc.getAllDifferentialPairs();
const list = Array.isArray(pairs) ? pairs : Object.values(pairs);
console.log('count:', list.length);
list.forEach((p, i) => {
	console.log(`[${i}] name:`, p.name, 'positiveNet:', p.positiveNet, 'negativeNet:', p.negativeNet);
});

// 3. 清理测试差分对（查询类清理现场）
await eda.pcb_Drc.deleteDifferentialPair(pairName);
```


### getallequallengthnetgroups

# PCB\_Drc.getAllEqualLengthNetGroups() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the detailed properties of all equal-length net groups

## Signature

```typescript
function getAllEqualLengthNetGroups(): Promise<Array<IPCB_EqualLengthNetGroupItem>>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_EqualLengthNetGroupItem](../interfaces/IPCB_EqualLengthNetGroupItem.md)<!-- -->&gt;&gt;

Detailed properties of all equal-length net groups

## Example

```javascript
// 1. 建一个测试等长组作为查询对象
await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_查询等长组', [], { r: 0, g: 255, b: 0, alpha: 1 });

// 2. 查询所有等长网络组
const groups = await eda.pcb_Drc.getAllEqualLengthNetGroups();
console.log('count:', groups.length);
groups.forEach((g, i) => {
	console.log(`[${i}] name:`, g.name);
});

// 3. 清理测试等长组（查询类清理现场）
await eda.pcb_Drc.deleteEqualLengthNetGroup('嘉立创示例_查询等长组');
```


### getallnetclasses

# PCB\_Drc.getAllNetClasses() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Net class detailed properties of

## Signature

```typescript
function getAllNetClasses(): Promise<Array<IPCB_NetClassItem>>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_NetClassItem](../interfaces/IPCB_NetClassItem.md)<!-- -->&gt;&gt;

Detailed properties of all net classes

## Example

```javascript
// 1. 建一个测试网络类作为查询对象
await eda.pcb_Drc.createNetClass('嘉立创示例_查询网络类', [], { r: 255, g: 0, b: 0, alpha: 1 });

// 2. 查询所有网络类
const classes = await eda.pcb_Drc.getAllNetClasses();
console.log('count:', classes.length);
classes.forEach((c, i) => {
	console.log(`[${i}] name:`, c.name);
});

// 3. 清理测试网络类（查询类清理现场）
await eda.pcb_Drc.deleteNetClass('嘉立创示例_查询网络类');
```


### getallpadpairgroups

# PCB\_Drc.getAllPadPairGroups() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the detailed properties of all pad pair groups

## Signature

```typescript
function getAllPadPairGroups(): Promise<Array<IPCB_PadPairGroupItem>>;
```

## Returns

Promise&lt;Array&lt;[IPCB\_PadPairGroupItem](../interfaces/IPCB_PadPairGroupItem.md)<!-- -->&gt;&gt;

Detailed properties of all pad pair groups

## Example

```javascript
// 1. 查询所有焊盘对组
const groups = await eda.pcb_Drc.getAllPadPairGroups();

// 2. 输出每个组的名称和焊盘对
console.log('count:', groups.length);
groups.forEach((g, i) => {
	console.log(`[${i}] name:`, g.name);
	g.padPairs.forEach((pair, j) => {
		console.log(`    pair[${j}]:`, pair[0], '↔', pair[1]);
	});
});
```


### getallruleconfigurations

# PCB\_Drc.getAllRuleConfigurations() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get all Design rule configuration

## Signature

```typescript
function getAllRuleConfigurations(includeSystem?: boolean): Promise<Array<{ [key: string]: any }>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|includeSystem|boolean|_(Optional)_ Whether Get System design rule configuration|

## Returns

Promise&lt;Array&lt;{ \[key: string\]: any }&gt;&gt;

All design rule configurations

## Example

```javascript
// 1. 查询全部设计规则配置（含系统配置）
const all = await eda.pcb_Drc.getAllRuleConfigurations(true);

// 2. 输出配置数量和名称
console.log('count:', all.length);
all.forEach((c, i) => {
	console.log(`[${i}] name:`, c.name);
});
```


### getcurrentruleconfiguration

# PCB\_Drc.getCurrentRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Current design rule configuration

## Signature

```typescript
function getCurrentRuleConfiguration(): Promise<{ [key: string]: any } | undefined>;
```

## Returns

Promise&lt;{ \[key: string\]: any } \| undefined&gt;

Current design rule configuration; `undefined` indicates that the retrieval failed

### getcurrentruleconfigurationname

# PCB\_Drc.getCurrentRuleConfigurationName() method

Get Current design rule configuration name

## Signature

```typescript
function getCurrentRuleConfigurationName(): Promise<string | undefined>;
```

## Returns

Promise&lt;string \| undefined&gt;

Current design rule configuration name; `undefined` indicates that the retrieval failed

### getdefaultruleconfigurationname

# PCB\_Drc.getDefaultRuleConfigurationName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the name of the default design rule configuration for new PCBs

## Signature

```typescript
function getDefaultRuleConfigurationName(): Promise<string | undefined>;
```

## Returns

Promise&lt;string \| undefined&gt;

Default design rule configuration name of; `undefined` indicates that the retrieval failed

### getnetbynetrules

# PCB\_Drc.getNetByNetRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Net - net rules

## Signature

```typescript
function getNetByNetRules(): Promise<{ [key: string]: any }>;
```

## Returns

Promise&lt;{ \[key: string\]: any }&gt;

All net-by-net rules of the current PCB

### getnetrules

# PCB\_Drc.getNetRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Net rules

## Signature

```typescript
function getNetRules(): Promise<Array<{ [key: string]: any }>>;
```

## Returns

Promise&lt;Array&lt;{ \[key: string\]: any }&gt;&gt;

All net rules of the current PCB

### getpadpairgroupminwirelength

# PCB\_Drc.getPadPairGroupMinWireLength() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the minimum wire length of a pad pair group

## Signature

```typescript
function getPadPairGroupMinWireLength(
	padPairGroupName: string,
): Promise<Array<IPCB_PadPairMinWireLengthItem>>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|padPairGroupName|string|Pad pair group name|

## Returns

Promise&lt;Array&lt;[IPCB\_PadPairMinWireLengthItem](../interfaces/IPCB_PadPairMinWireLengthItem.md)<!-- -->&gt;&gt;

The minimum wire lengths of all pad pairs

### getregionrules

# PCB\_Drc.getRegionRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get region rules

## Signature

```typescript
function getRegionRules(): Promise<Array<{ [key: string]: any }>>;
```

## Returns

Promise&lt;Array&lt;{ \[key: string\]: any }&gt;&gt;

- All region rules of the current PCB

### getruleconfiguration

# PCB\_Drc.getRuleConfiguration() method

Get Specify design rule configuration

## Signature

```typescript
function getRuleConfiguration(
	configurationName: string,
): Promise<{ [key: string]: any } | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|configurationName|string|Configuration name|

## Returns

Promise&lt;{ \[key: string\]: any } \| undefined&gt;

Design rule configuration, `undefined` is does not exist this design rules

### modifydifferentialpairname

# PCB\_Drc.modifyDifferentialPairName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify the name of the differential pair

## Signature

```typescript
function modifyDifferentialPairName(
	originalDifferentialPairName: string,
	differentialPairName: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|originalDifferentialPairName|string|Original differential pair name|
|differentialPairName|string|New differential pair name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 生成本次运行专用的网络名和差分对名（网络不能属于其他差分对）
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;

// 2. 放带差分网络的焊盘并创建差分对
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);
const pairName = `嘉立创示例_差分对_${ts}`;
await eda.pcb_Drc.createDifferentialPair(pairName, netP, netN);

// 3. 改名（保留现场供观察）
const newName = `嘉立创示例_差分对_改_${ts}`;
const result = await eda.pcb_Drc.modifyDifferentialPairName(pairName, newName);

console.log('newName:', newName);
console.log('result:', result);
```


### modifydifferentialpairnegativenet

# PCB\_Drc.modifyDifferentialPairNegativeNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify the negative net of the differential pair

## Signature

```typescript
function modifyDifferentialPairNegativeNet(
	differentialPairName: string,
	negativeNet: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|differentialPairName|string|Differential pair name|
|negativeNet|string|Negative net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 生成本次运行专用的网络名（避免与其他差分对冲突）
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;
const newNetN = `JLC_DEMO_DP_N2_${ts}`;

// 2. 放三个带网络的焊盘并创建差分对
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '3', x + 1000, 3000, 0, ['ELLIPSE', 60, 60], newNetN, null, 0, 0, 0, false, 0);
const pairName = `嘉立创示例_差分对_${ts}`;
await eda.pcb_Drc.createDifferentialPair(pairName, netP, netN);

// 3. 把负网络替换为 newNetN（保留现场供观察）
const result = await eda.pcb_Drc.modifyDifferentialPairNegativeNet(pairName, newNetN);

console.log('newNegativeNet:', newNetN);
console.log('result:', result);
```


### modifydifferentialpairpositivenet

# PCB\_Drc.modifyDifferentialPairPositiveNet() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify the positive net of the differential pair

## Signature

```typescript
function modifyDifferentialPairPositiveNet(
	differentialPairName: string,
	positiveNet: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|differentialPairName|string|Differential pair name|
|positiveNet|string|Positive net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 生成本次运行专用的网络名（避免与其他差分对冲突）
const ts = Date.now();
const netP = `JLC_DEMO_DP_P_${ts}`;
const netN = `JLC_DEMO_DP_N_${ts}`;
const newNetP = `JLC_DEMO_DP_P2_${ts}`;

// 2. 放三个带网络的焊盘并创建差分对
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], netP, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], netN, null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '3', x + 1000, 3000, 0, ['ELLIPSE', 60, 60], newNetP, null, 0, 0, 0, false, 0);
const pairName = `嘉立创示例_差分对_${ts}`;
await eda.pcb_Drc.createDifferentialPair(pairName, netP, netN);

// 3. 把正网络替换为 newNetP（保留现场供观察）
const result = await eda.pcb_Drc.modifyDifferentialPairPositiveNet(pairName, newNetP);

console.log('newPositiveNet:', newNetP);
console.log('result:', result);
```


### modifyequallengthnetgroupname

# PCB\_Drc.modifyEqualLengthNetGroupName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify the name of the equal-length net group

## Signature

```typescript
function modifyEqualLengthNetGroupName(
	originalEqualLengthNetGroupName: string,
	equalLengthNetGroupName: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|originalEqualLengthNetGroupName|string|Original equal-length net group name|
|equalLengthNetGroupName|string|New equal-length net group name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 建一个待改名的等长网络组
await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_等长网络组', [], { r: 0, g: 255, b: 0, alpha: 1 });

// 2. 改名（用时间戳后缀避免与之前保留的现场重名，保留现场供观察）
const newName = `嘉立创示例_等长网络组_改_${Date.now()}`;
const result = await eda.pcb_Drc.modifyEqualLengthNetGroupName('嘉立创示例_等长网络组', newName);

console.log('newName:', newName);
console.log('result:', result);
```


### modifynetclassname

# PCB\_Drc.modifyNetClassName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify Net class name of

## Signature

```typescript
function modifyNetClassName(originalNetClassName: string, netClassName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|originalNetClassName|string|Original net class name|
|netClassName|string|New net class name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 建一个待改名的网络类
await eda.pcb_Drc.createNetClass('嘉立创示例_网络类', [], { r: 255, g: 0, b: 0, alpha: 1 });

// 2. 改名（用时间戳后缀避免与之前保留的现场重名，保留现场供观察）
const newName = `嘉立创示例_网络类_改_${Date.now()}`;
const result = await eda.pcb_Drc.modifyNetClassName('嘉立创示例_网络类', newName);

console.log('newName:', newName);
console.log('result:', result);
```


### modifypadpairgroupname

# PCB\_Drc.modifyPadPairGroupName() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Modify the name of the pad pair group

## Signature

```typescript
function modifyPadPairGroupName(
	originalPadPairGroupName: string,
	padPairGroupName: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|originalPadPairGroupName|string|Original pad pair group name|
|padPairGroupName|string|New pad pair group name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

### overwritecurrentruleconfiguration

# PCB\_Drc.overwriteCurrentRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Overwrite current design rule configuration

## Signature

```typescript
function overwriteCurrentRuleConfiguration(ruleConfiguration: {
	[key: string]: any;
}): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|ruleConfiguration|\{ \[key: string\]: any \}|Design rule configuration|

## Returns

Promise&lt;boolean&gt;

Overwrite whether it is successful

## Remarks

It will overwrite the current design rule configuration of the PCB. Please note the risk of data loss

## Example

```javascript
// 1. 读取当前设计规则配置（返回 { config, name }，规则数据在 config 里）
const current = await eda.pcb_Drc.getCurrentRuleConfiguration();

// 2. 整体写回当前配置（原样写回演示覆写成功，实际使用时可先修改 config 中的字段）
const result = await eda.pcb_Drc.overwriteCurrentRuleConfiguration(current.config);

console.log('configName:', current.name);
console.log('result:', result);
```


### overwritenetbynetrules

# PCB\_Drc.overwriteNetByNetRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Overwrite net - net rules

## Signature

```typescript
function overwriteNetByNetRules(netByNetRules: { [key: string]: any }): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netByNetRules|\{ \[key: string\]: any \}|Net - net rules|

## Returns

Promise&lt;boolean&gt;

Overwrite whether it is successful

## Remarks

It will overwrite all net-by-net rules of the current PCB. Please note the risk of data loss

## Example

```javascript
// 1. 读取当前所有网络-网络规则（对象，键是规则类别名）
const netByNetRules = await eda.pcb_Drc.getNetByNetRules();

// 2. 整体写回（原样写回演示覆写成功，实际使用时可先修改对象字段）
const result = await eda.pcb_Drc.overwriteNetByNetRules(netByNetRules);

console.log('ruleKeys:', Object.keys(netByNetRules).join(', '));
console.log('result:', result);
```


### overwritenetrules

# PCB\_Drc.overwriteNetRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Overwrite net rules

## Signature

```typescript
function overwriteNetRules(netRules: Array<{ [key: string]: any }>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netRules|Array&lt;{ \[key: string\]: any }&gt;|Net rules|

## Returns

Promise&lt;boolean&gt;

Overwrite whether it is successful

## Remarks

It will overwrite all net rules of the current PCB. Please note the risk of data loss

## Example

```javascript
// 1. 读取当前所有网络规则（数组）
const netRules = await eda.pcb_Drc.getNetRules();

// 2. 整体写回（原样写回演示覆写成功，实际使用时可先增删改数组元素）
const result = await eda.pcb_Drc.overwriteNetRules(netRules);

console.log('ruleCount:', netRules.length);
console.log('result:', result);
```


### overwriteregionrules

# PCB\_Drc.overwriteRegionRules() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Overwrite region rules

## Signature

```typescript
function overwriteRegionRules(regionRules: Array<{ [key: string]: any }>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|regionRules|Array&lt;{ \[key: string\]: any }&gt;|Region rules|

## Returns

Promise&lt;boolean&gt;

Overwrite whether it is successful

## Remarks

It will overwrite all region rules of the current PCB. Please note the risk of data loss

## Example

```javascript
// 1. 读取当前所有区域规则（数组）
const regionRules = await eda.pcb_Drc.getRegionRules();

// 2. 整体写回（原样写回演示覆写成功，实际使用时可先增删改数组元素）
const result = await eda.pcb_Drc.overwriteRegionRules(regionRules);

console.log('ruleCount:', regionRules.length);
console.log('result:', result);
```


### removenetfromequallengthnetgroup

# PCB\_Drc.removeNetFromEqualLengthNetGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Remove a net from an equal-length net group

## Signature

```typescript
function removeNetFromEqualLengthNetGroup(
	equalLengthNetGroupName: string,
	net: string | Array<string>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|equalLengthNetGroupName|string|Equal-length net group name|
|net|string \| Array&lt;string&gt;|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 准备两个真实网络（放带网络的测试焊盘）
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_D0', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_D1', null, 0, 0, 0, false, 0);

// 2. 建等长组并纳入网络
await eda.pcb_Drc.createEqualLengthNetGroup('嘉立创示例_等长网络组', ['JLC_DEMO_D0', 'JLC_DEMO_D1'], { r: 0, g: 255, b: 0, alpha: 1 });

// 3. 先单个移除，再批量移除
const removedOne = await eda.pcb_Drc.removeNetFromEqualLengthNetGroup('嘉立创示例_等长网络组', 'JLC_DEMO_D0');
const removedBatch = await eda.pcb_Drc.removeNetFromEqualLengthNetGroup('嘉立创示例_等长网络组', ['JLC_DEMO_D1']);

console.log('removedOne:', removedOne);
console.log('removedBatch:', removedBatch);
```


### removenetfromnetclass

# PCB\_Drc.removeNetFromNetClass() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

From net class in remove net

## Signature

```typescript
function removeNetFromNetClass(netClassName: string, net: string | Array<string>): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|netClassName|string|Net class name|
|net|string \| Array&lt;string&gt;|Net name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 1. 准备两个真实网络（放带网络的测试焊盘）
const x = 3000 + Math.floor(Math.random() * 20000);
await eda.pcb_PrimitivePad.create(1, '1', x, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_P', null, 0, 0, 0, false, 0);
await eda.pcb_PrimitivePad.create(1, '2', x + 500, 3000, 0, ['ELLIPSE', 60, 60], 'JLC_DEMO_N', null, 0, 0, 0, false, 0);

// 2. 建网络类并纳入网络
await eda.pcb_Drc.createNetClass('嘉立创示例_网络类', ['JLC_DEMO_P', 'JLC_DEMO_N'], { r: 255, g: 0, b: 0, alpha: 1 });

// 3. 先单个移除，再批量移除
const removedOne = await eda.pcb_Drc.removeNetFromNetClass('嘉立创示例_网络类', 'JLC_DEMO_P');
const removedBatch = await eda.pcb_Drc.removeNetFromNetClass('嘉立创示例_网络类', ['JLC_DEMO_N']);

console.log('removedOne:', removedOne);
console.log('removedBatch:', removedBatch);
```


### removepadpairfrompadpairgroup

# PCB\_Drc.removePadPairFromPadPairGroup() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Remove a pad pair from a pad pair group

## Signature

```typescript
function removePadPairFromPadPairGroup(
	padPairGroupName: string,
	padPair: [string, string] | Array<[string, string]>,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|padPairGroupName|string|Pad pair group name|
|padPair|\[string, string\] \| Array&lt;\[string, string\]&gt;|Pad for|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

There are three different usages, and make sure the corresponding pads already exist on the canvas. They are: 1. Free pad - free pad; 2. Device pad - device pad; 3. Device pad - free pad await eda.pcb\_Drc.removePadPairFromPadPairGroup('test',\['e0','e1'\]) // 游离焊盘-游离焊盘 await eda.pcb\_Drc.removePadPairFromPadPairGroup('test',\['R1:1','R1:2'\]) // 器件焊盘 - 器件焊盘 await eda.pcb\_Drc.removePadPairFromPadPairGroup('test',\['R1:2','e1'\]) // 器件焊盘 - 游离焊盘

### renameruleconfiguration

# PCB\_Drc.renameRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Rename the design rule configuration

## Signature

```typescript
function renameRuleConfiguration(
	originalConfigurationName: string,
	configurationName: string,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|originalConfigurationName|string|Original design rule configuration name|
|configurationName|string|New design rule configuration name|

## Returns

Promise&lt;boolean&gt;

Whether the rename was successful

## Remarks

Only custom configurations can be renamed. System configurations cannot be renamed

## Example

```javascript
// 1. 读取当前配置并保存为待改名的自定义配置（allowOverwrite=true 重复运行安全）
const current = await eda.pcb_Drc.getCurrentRuleConfiguration();
await eda.pcb_Drc.saveRuleConfiguration(current.config, '嘉立创示例_待改配置', true);

// 2. 静默清掉上次运行保留的目标名（首次运行时目标不存在，删除返回 false 属正常）
await eda.pcb_Drc.deleteRuleConfiguration('嘉立创示例_改名后配置');

// 3. 重命名（保留现场供观察）
const result = await eda.pcb_Drc.renameRuleConfiguration('嘉立创示例_待改配置', '嘉立创示例_改名后配置');

console.log('result:', result);
```


### saveruleconfiguration

# PCB\_Drc.saveRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Save Design rule configuration

## Signature

```typescript
function saveRuleConfiguration(
	ruleConfiguration: { [key: string]: any },
	configurationName: string,
	allowOverwrite?: boolean,
): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|ruleConfiguration|\{ \[key: string\]: any \}|Design rule configuration|
|configurationName|string|Configuration name|
|allowOverwrite|boolean|_(Optional)_ Whether to allow overwriting a design rule configuration with the same name. If `false`<!-- -->, `false` will be returned when a configuration with the same name is encountered. Please note the possible risk of data loss|

## Returns

Promise&lt;boolean&gt;

Save Whether Successful

## Remarks

Only custom configurations can be overwritten and saved. System configurations cannot be modified or overwritten

## Example

```javascript
// 1. 读取当前设计规则配置作为数据源（规则数据在 config 字段里）
const current = await eda.pcb_Drc.getCurrentRuleConfiguration();

// 2. 另存为自定义配置，允许同名覆盖（保留现场供观察）
const saved = await eda.pcb_Drc.saveRuleConfiguration(current.config, '嘉立创示例_规则配置', true);

console.log('saved:', saved);
```


### setasdefaultruleconfiguration

# PCB\_Drc.setAsDefaultRuleConfiguration() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Set as the default design rule configuration for new PCBs

## Signature

```typescript
function setAsDefaultRuleConfiguration(configurationName: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|configurationName|string|Configuration name|

## Returns

Promise&lt;boolean&gt;

Set Whether Successful

## Remarks

The return value is result-oriented. Repeatedly setting the same design rule as the default will also return `true`

## Example

```javascript
// 1. 读取当前配置并保存为自定义配置（作为待指定的默认配置）
const current = await eda.pcb_Drc.getCurrentRuleConfiguration();
await eda.pcb_Drc.saveRuleConfiguration(current.config, '嘉立创示例_默认规则配置', true);

// 2. 把它设置为新建 PCB 的默认设计规则配置
const result = await eda.pcb_Drc.setAsDefaultRuleConfiguration('嘉立创示例_默认规则配置');

console.log('result:', result);
```
