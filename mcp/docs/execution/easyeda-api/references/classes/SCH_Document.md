# SCH\_Document class

Schematic &amp; symbol / document operation class

## Signature

```typescript
class SCH_Document
```

## Remarks

Operations performed on the design document as a whole

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[autoLayout(props)](./SCH_Document.md)||**_(BETA)_** Auto layout|
|[autoRouting(props)](./SCH_Document.md)||**_(BETA)_** Auto routing|
|[importChanges()](./SCH_Document.md)||Import changes from the PCB|
|[save()](./SCH_Document.md)||Save Document|

---

## 方法详情

### autolayout

# SCH\_Document.autoLayout() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Auto layout

## Signature

```typescript
function autoLayout(props?: {
	uuids?: Array<string>;
	netlist?: {
		component: {
			[uniqueId: string]: {
				pinInfoMap: {
					[key: string]: {
						name: string;
						number: string;
						net: string;
						props: { 'Pin Number': string };
					};
				};
			};
		};
	};
	designatorDeviceTypeMap?: {
		[designator: string]:
			| 'resistor'
			| 'capacitor'
			| 'inductive'
			| 'diode'
			| 'triode'
			| 'oscillator'
			| 'chip'
			| 'otherDevice';
	};
}): Promise<any>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|props|{ uuids?: Array&lt;string&gt;; netlist?: { component: { \[uniqueId: string\]: { pinInfoMap: { \[key: string\]: { name: string; number: string; net: string; props: { 'Pin Number': string } } } } } }; designatorDeviceTypeMap?: { \[designator: string\]: 'resistor' \| 'capacitor' \| 'inductive' \| 'diode' \| 'triode' \| 'oscillator' \| 'chip' \| 'otherDevice' } }|_(Optional)_ Auto layout parameter|

## Returns

Promise&lt;any&gt;

Auto layout result

## Remarks

If no parameters are passed in, auto layout will be performed for all devices

## Example

```javascript
// 1. 创建测试原理图并打开（文档级 API 作用于当前激活的原理图）
const schematicUuid = await eda.dmt_Schematic.createSchematic();
await new Promise(r => setTimeout(r, 1500));
const schInfo = await eda.dmt_Schematic.getSchematicInfo(schematicUuid);
await eda.dmt_EditorControl.openDocument(schInfo.page[0].uuid);
await new Promise(r => setTimeout(r, 1000));

// 2. 对所有器件执行自动布局（空原理图无器件，立即返回结果对象）
const result = await eda.sch_Document.autoLayout();
console.log('result:', result);

// 3. 清理测试原理图
await new Promise(r => setTimeout(r, 1500));
await eda.dmt_Schematic.deleteSchematic(schematicUuid);
```


### autorouting

# SCH\_Document.autoRouting() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Auto routing

## Signature

```typescript
function autoRouting(props?: {
	uuids?: Array<string>;
	netlist?: {
		component: {
			[uniqueId: string]: {
				pinInfoMap: {
					[key: string]: {
						name: string;
						number: string;
						net: string;
						props: { 'Pin Number': string };
					};
				};
			};
		};
	};
	designatorDeviceTypeMap?: {
		[designator: string]:
			| 'resistor'
			| 'capacitor'
			| 'inductive'
			| 'diode'
			| 'triode'
			| 'oscillator'
			| 'chip'
			| 'otherDevice';
	};
}): Promise<any>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|props|{ uuids?: Array&lt;string&gt;; netlist?: { component: { \[uniqueId: string\]: { pinInfoMap: { \[key: string\]: { name: string; number: string; net: string; props: { 'Pin Number': string } } } } } }; designatorDeviceTypeMap?: { \[designator: string\]: 'resistor' \| 'capacitor' \| 'inductive' \| 'diode' \| 'triode' \| 'oscillator' \| 'chip' \| 'otherDevice' } }|_(Optional)_ Auto routing parameter|

## Returns

Promise&lt;any&gt;

Auto routing result

## Remarks

If no parameters are passed in, auto routing will be performed for all unrouted nets

## Example

```javascript
// 1. 创建测试原理图并打开
const schematicUuid = await eda.dmt_Schematic.createSchematic();
await new Promise(r => setTimeout(r, 1000));
const schInfo = await eda.dmt_Schematic.getSchematicInfo(schematicUuid);
await eda.dmt_EditorControl.openDocument(schInfo.page[0].uuid);
await new Promise(r => setTimeout(r, 800));

// 2. 放置两个测试器件并取第一个引脚的坐标（关键字搜索当前版本异常，按 C 编号反查器件）
const devices = await eda.lib_Device.searchByProperties({ supplierId: 'C1523' }, undefined, undefined, undefined, 5, 1);
const sysLibUuid = await eda.lib_LibrariesList.getSystemLibraryUuid();
const device = { libraryUuid: sysLibUuid, uuid: devices[0].uuid };
const comp1 = await eda.sch_PrimitiveComponent.create(device, 800, 800);
const comp2 = await eda.sch_PrimitiveComponent.create(device, 1600, 800);
const pin1 = (await comp1.getAllPins())[0];
const pin2 = (await comp2.getAllPins())[0];

// 3. 在两个引脚上放同名接地标志，构成一个跨器件的 GND 网络
const flag1 = await eda.sch_PrimitiveComponent.createNetFlag('Ground', 'GND', pin1.getState_X(), pin1.getState_Y());
const flag2 = await eda.sch_PrimitiveComponent.createNetFlag('Ground', 'GND', pin2.getState_X(), pin2.getState_Y());
console.log('netFlagIds:', flag1.getState_PrimitiveId(), flag2.getState_PrimitiveId());

// 4. 统计布线前导线数，执行自动布线后再统计一次
const wiresBefore = (await eda.sch_PrimitiveWire.getAllPrimitiveId()).length;
const result = await eda.sch_Document.autoRouting();
const wiresAfter = (await eda.sch_PrimitiveWire.getAllPrimitiveId()).length;
console.log('result:', result);
console.log('wiresBefore:', wiresBefore, 'wiresAfter:', wiresAfter);

// 5. 清理测试原理图（器件与网络标志随文档一起删除）
await new Promise(r => setTimeout(r, 1500));
await eda.dmt_Schematic.deleteSchematic(schematicUuid);
```


### importchanges

# SCH\_Document.importChanges() method

Import changes from the PCB

## Signature

```typescript
function importChanges(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether the import operation is successful, import failed or a free schematic return `false`

## Example

```javascript
// 1. 创建测试原理图和测试 PCB
const schematicUuid = await eda.dmt_Schematic.createSchematic();
await new Promise(r => setTimeout(r, 1500));
const pcbUuid = await eda.dmt_Pcb.createPcb();
await new Promise(r => setTimeout(r, 1500));

// 2. 创建板子把原理图与 PCB 关联起来（返回板子名称）
const boardName = await eda.dmt_Board.createBoard(schematicUuid, pcbUuid);
await new Promise(r => setTimeout(r, 1500));
console.log('boardName:', boardName);

// 3. 打开原理图（图页级 UUID），从关联 PCB 导入变更
const schInfo = await eda.dmt_Schematic.getSchematicInfo(schematicUuid);
await eda.dmt_EditorControl.openDocument(schInfo.page[0].uuid);
await new Promise(r => setTimeout(r, 1000));
const imported = await eda.sch_Document.importChanges();
console.log('imported:', imported);

// 4. 清理：删板子、删 PCB、删原理图
await new Promise(r => setTimeout(r, 1500));
await eda.dmt_Board.deleteBoard(boardName);
await new Promise(r => setTimeout(r, 1000));
await eda.dmt_Pcb.deletePcb(pcbUuid);
await new Promise(r => setTimeout(r, 500));
await eda.dmt_Schematic.deleteSchematic(schematicUuid);
```


### save

# SCH\_Document.save() method

Save Document

## Signature

```typescript
function save(): Promise<boolean>;
```

## Returns

Promise&lt;boolean&gt;

Whether the save operation was successful. Errors such as save failure and upload failure all return `false`

## Example

```javascript
// 1. 创建测试原理图并打开（保存作用于当前激活的原理图，openDocument 传图页级 UUID）
const schematicUuid = await eda.dmt_Schematic.createSchematic();
await new Promise(r => setTimeout(r, 1500));
const schInfo = await eda.dmt_Schematic.getSchematicInfo(schematicUuid);
await eda.dmt_EditorControl.openDocument(schInfo.page[0].uuid);
await new Promise(r => setTimeout(r, 1000));

// 2. 保存当前原理图
const saved = await eda.sch_Document.save();
console.log('saved:', saved);

// 3. 清理测试原理图（删除前等 1.5s 让保存变更同步落地）
await new Promise(r => setTimeout(r, 1500));
await eda.dmt_Schematic.deleteSchematic(schematicUuid);
```
