# PCB\_ManufactureData class

PCB &amp; footprint / manufacture data class

## Signature

```typescript
class PCB_ManufactureData
```

## Remarks

Get the manufacture data files of the current PCB and quick ordering

## Methods

|Method|Modifiers|Description|
|---|---|---|
|[deleteBomTemplate(template)](./PCB_ManufactureData.md)||**_(BETA)_** Delete BOM template|
|[get3DFile(fileName, fileType, element, modelMode, autoGenerateModels)](./PCB_ManufactureData.md)||**_(BETA)_** Get 3D model file|
|[get3DShellFile(fileName, fileType)](./PCB_ManufactureData.md)||**_(BETA)_** Get the 3D shell file|
|[getAltiumDesignerFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get Altium Designer file|
|[getAutoLayoutJsonFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get Auto layout file (JSON)|
|[getAutoRouteJsonFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get Auto routing file (JSON)|
|[getAutoRouteJsonFileForJRouter(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get the JRouter-specific auto routing file (JSON)|
|[getBomFile(fileName, fileType, template, filterOptions, statistics, property, columns)](./PCB_ManufactureData.md)||**_(BETA)_** Get BOM file|
|[getBomTemplateFile(template)](./PCB_ManufactureData.md)||**_(BETA)_** Get BOM template file|
|[getBomTemplates()](./PCB_ManufactureData.md)||**_(BETA)_** Get BOM template list|
|[getDsnFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get Auto routing file (DSN)|
|[getDxfFile(fileName, layers, objects)](./PCB_ManufactureData.md)||**_(BETA)_** Get DXF file|
|[getFlyingProbeTestFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get the flying probe test file|
|[getGerberFile(fileName, colorSilkscreen, unit, digitalFormat, other, layers, objects)](./PCB_ManufactureData.md)||**_(BETA)_** Get the PCB fabrication file (Gerber)|
|[getIdxFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get IDX file|
|[getIpc2581CFile(fileName, fileType, unit, oemNumber)](./PCB_ManufactureData.md)||**_(BETA)_** Get IPC-2581C file|
|[getIpcD356AFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get IPC-D-356A file|
|[getManufactureData()](./PCB_ManufactureData.md)||**_(BETA)_** Export the manufacture data|
|[getNetlistFile(fileName, netlistType)](./PCB_ManufactureData.md)||**_(BETA)_** Get the netlist file (Netlist)|
|[getOpenDatabaseDoublePlusFile(fileName, unit, otherData, layers, objects)](./PCB_ManufactureData.md)||**_(BETA)_** Get ODB++ file|
|[getPadsFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get PADS file|
|[getPcbInfoFile(fileName)](./PCB_ManufactureData.md)||**_(BETA)_** Get PCB information file|
|[getPdfFile(fileName, outputMethod, contentConfig, watermark, graphPageConfig)](./PCB_ManufactureData.md)||**_(BETA)_** Get PDF file|
|[getPickAndPlaceFile(fileName, fileType, unit)](./PCB_ManufactureData.md)||**_(BETA)_** Get Coordinate file (PickAndPlace)|
|[getTestPointFile(fileName, fileType)](./PCB_ManufactureData.md)||**_(BETA)_** Get the test point report file|
|[place3DShellOrder(interactive, ignoreWarning)](./PCB_ManufactureData.md)||**_(BETA)_** 3D shell ordering|
|[placeComponentsOrder(interactive, ignoreWarning)](./PCB_ManufactureData.md)||**_(BETA)_** Component ordering|
|[placePcbOrder(interactive, ignoreWarning)](./PCB_ManufactureData.md)||**_(BETA)_** PCB ordering|
|[placeSmtComponentsOrder(interactive, ignoreWarning)](./PCB_ManufactureData.md)||**_(BETA)_** SMT component ordering|
|[uploadBomTemplateFile(templateFile, template)](./PCB_ManufactureData.md)||**_(BETA)_** Upload a BOM template file|

---

## 方法详情

### deletebomtemplate

# PCB\_ManufactureData.deleteBomTemplate() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Delete BOM template

## Signature

```typescript
function deleteBomTemplate(template: string): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|template|string|BOM template name|

## Returns

Promise&lt;boolean&gt;

Whether the operation is successful

## Example

```javascript
// 删除指定的 BOM 模板
const success = await eda.pcb_ManufactureData.deleteBomTemplate('MyCustomTemplate');
if (success) {
	console.log('BOM 模板删除成功');
}
else {
	console.log('删除失败，可能是默认模板或模板不存在');
}
```

### get3dfile

# PCB\_ManufactureData.get3DFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get 3D model file

## Signature

```typescript
function get3DFile(
	fileName?: string,
	fileType?: 'step' | 'obj',
	element?: Array<'Component Model' | 'Via' | 'Silkscreen' | 'Wire In Signal Layer'>,
	modelMode?: 'Outfit' | 'Parts',
	autoGenerateModels?: boolean,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'step' \| 'obj'|_(Optional)_ File type|
|element|Array&lt;'Component Model' \| 'Via' \| 'Silkscreen' \| 'Wire In Signal Layer'&gt;|_(Optional)_ Exported objects|
|modelMode|'Outfit' \| 'Parts'|_(Optional)_ Export mode. `Outfit` = assembly, `Parts` = parts|
|autoGenerateModels|boolean|_(Optional)_ Whether to automatically generate a 3D model for components not bound to a 3D model (based on the "height" property of the component)|

## Returns

Promise&lt;File \| undefined&gt;

3D model file data

## Remarks

Please note: only component models imported in STEP format can be reflected in the exported STEP file

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 导出装配体模式的 STEP 文件（包含元件模型）
const stepFile = await eda.pcb_ManufactureData.get3DFile(
	'MyBoard_3D',
	'step',
	['Component Model'],
	'Outfit',
	true
);
if (stepFile) {
	await eda.sys_FileSystem.saveFile(stepFile);
}

// 导出包含多种对象的完整 3D 模型
const full3DFile = await eda.pcb_ManufactureData.get3DFile(
	'Complete_3D_Model',
	'step',
	['Component Model', 'Via', 'Silkscreen', 'Wire In Signal Layer'],
	'Outfit',
	true
);

// 导出零件模式 OBJ 文件
const objFile = await eda.pcb_ManufactureData.get3DFile(
	'MyBoard_OBJ',
	'obj',
	['Component Model'],
	'Parts',
	false
);
```

### get3dshellfile

# PCB\_ManufactureData.get3DShellFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the 3D shell file

## Signature

```typescript
function get3DShellFile(
	fileName?: string,
	fileType?: 'stl' | 'step' | 'obj',
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'stl' \| 'step' \| 'obj'|_(Optional)_ File type|

## Returns

Promise&lt;File \| undefined&gt;

3D shell file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 导出 STL 格式 3D 外壳
const stlFile = await eda.pcb_ManufactureData.get3DShellFile('Board_Shell', 'stl');
if (stlFile) {
	await eda.sys_FileSystem.saveFile(stlFile);
}

// 导出 STEP 格式 3D 外壳
const stepShellFile = await eda.pcb_ManufactureData.get3DShellFile('Board_Shell_STEP', 'step');
if (stepShellFile) {
	await eda.sys_FileSystem.saveFile(stepShellFile);
}
```

### getaltiumdesignerfile

# PCB\_ManufactureData.getAltiumDesignerFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Altium Designer file

## Signature

```typescript
function getAltiumDesignerFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Altium Designer file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 获取 Altium Designer 格式文件
const adFile = await eda.pcb_ManufactureData.getAltiumDesignerFile('Converted_To_AD');
if (adFile) {
	await eda.sys_FileSystem.saveFile(adFile);
}
```

### getautolayoutjsonfile

# PCB\_ManufactureData.getAutoLayoutJsonFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Auto layout file (JSON)

## Signature

```typescript
function getAutoLayoutJsonFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Auto layout JSON file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const autoLayoutJson = await eda.pcb_ManufactureData.getAutoLayoutJsonFile('AutoLayout_Json');
if (autoLayoutJson) {
	await eda.sys_FileSystem.saveFile(autoLayoutJson);
}
```

### getautoroutejsonfile

# PCB\_ManufactureData.getAutoRouteJsonFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Auto routing file (JSON)

## Signature

```typescript
function getAutoRouteJsonFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Auto routing JSON file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const autoRouteJson = await eda.pcb_ManufactureData.getAutoRouteJsonFile('AutoRoute_Json');
if (autoRouteJson) {
	await eda.sys_FileSystem.saveFile(autoRouteJson);
}
```

### getautoroutejsonfileforjrouter

# PCB\_ManufactureData.getAutoRouteJsonFileForJRouter() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the JRouter-specific auto routing file (JSON)

## Signature

```typescript
function getAutoRouteJsonFileForJRouter(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Auto routing JSON file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 1. 导出 JRouter 专用自动布线 JSON 文件（参数为目标文件名）
const jrouterFile = await eda.pcb_ManufactureData.getAutoRouteJsonFileForJRouter('嘉立创示例_JRouter');

// 2. 查看导出结果
console.log('导出文件名：', jrouterFile?.name);
console.log('文件大小：', jrouterFile?.size);
```


### getbomfile

# PCB\_ManufactureData.getBomFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get BOM file

## Signature

```typescript
function getBomFile(
	fileName?: string,
	fileType?: 'xlsx' | 'csv',
	template?: string,
	filterOptions?: Array<{ property: string; includeValue: boolean | string }>,
	statistics?: Array<string>,
	property?: Array<string>,
	columns?: Array<IPCB_BomPropertiesTableColumns>,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'xlsx' \| 'csv'|_(Optional)_ File type|
|template|string|_(Optional)_ Template name|
|filterOptions|Array&lt;{ property: string; includeValue: boolean \| string }&gt;|_(Optional)_ Filter rules, which should only contain the rules to be enabled. `property` is the rule name, and `includeValue` is the matched value|
|statistics|Array&lt;string&gt;|_(Optional)_ Statistics, containing the names of all statistic items to be enabled|
|property|Array&lt;string&gt;|_(Optional)_ Properties, containing the names of all properties to be enabled|
|columns|Array&lt;[IPCB\_BomPropertiesTableColumns](../interfaces/IPCB_BomPropertiesTableColumns.md)<!-- -->&gt;|_(Optional)_ Column properties and sorting. If `title`<!-- -->, `sort`<!-- -->, `group`<!-- -->, and `orderWeight` are not passed in, default values are used. `null` means \*\*none\*\* or \*\*empty\*\*|

## Returns

Promise&lt;File \| undefined&gt;

BOM file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 使用默认配置导出 BOM
const bomFile = await eda.pcb_ManufactureData.getBomFile('MyBOM', 'xlsx');
if (bomFile) {
    await eda.sys_FileSystem.saveFile(bomFile);
}

// 自定义 BOM 过滤和列配置
const bomFile = await eda.pcb_ManufactureData.getBomFile(
    'Custom_Production_BOM',
    'xlsx',
    undefined,
    [
        { property: 'Add into BOM', includeValue: 'yes' },
        { property: 'Convert to PCB', includeValue: 'yes' }
    ],
    ['No.', 'Quantity', 'Comment'],
    ['Name', 'Device', 'Designator', 'Supplier'],
    [
        { property: 'Designator', title: '位号', sort: 'asc', group: 'No', orderWeight: 10 },
        { property: 'Quantity', title: '数量', sort: 'desc', group: 'Yes', orderWeight: 9 }
    ]
);

// 导出 CSV 格式 BOM
const csvBomFile = await eda.pcb_ManufactureData.getBomFile(
    'Simple_BOM',
    'csv',
    undefined,
    [{ property: 'Add into BOM', includeValue: 'yes' }],
    ['No.', 'Quantity'],
    ['Designator', 'Footprint', 'Value']
);
```

### getbomtemplatefile

# PCB\_ManufactureData.getBomTemplateFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get BOM template file

## Signature

```typescript
function getBomTemplateFile(template: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|template|string|BOM template name|

## Returns

Promise&lt;File \| undefined&gt;

BOM template file

## Example

```javascript
// 获取指定模板的文件
const templateFile = await eda.pcb_ManufactureData.getBomTemplateFile('MyCustomTemplate');
if (templateFile) {
	await eda.sys_FileSystem.saveFile(templateFile);
}
```

### getbomtemplates

# PCB\_ManufactureData.getBomTemplates() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get BOM template list

## Signature

```typescript
function getBomTemplates(): Promise<Array<string>>;
```

## Returns

Promise&lt;Array&lt;string&gt;&gt;

BOM template list

## Example

```javascript
// 获取所有可用的 BOM 模板
const templates = await eda.pcb_ManufactureData.getBomTemplates();
console.log('可用的 BOM 模板:', templates);
templates.forEach((template, index) => {
	console.log(`${index + 1}. ${template}`);
});
```

### getdsnfile

# PCB\_ManufactureData.getDsnFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Auto routing file (DSN)

## Signature

```typescript
function getDsnFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Auto routing DSN file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const dsnFile = await eda.pcb_ManufactureData.getDsnFile('AutoRoute_DSN');
if (dsnFile) {
	await eda.sys_FileSystem.saveFile(dsnFile);
}
```

### getdxffile

# PCB\_ManufactureData.getDxfFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get DXF file

## Signature

```typescript
function getDxfFile(
	fileName?: string,
	layers?: Array<{ layerId: EPCB_LayerId; mirror: boolean }>,
	objects?: Array<string>,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|layers|Array&lt;{ layerId: [EPCB\_LayerId](../enums/EPCB_LayerId.md)<!-- -->; mirror: boolean }&gt;|_(Optional)_ Exported layers|
|objects|Array&lt;string&gt;|_(Optional)_ Exported objects|

## Returns

Promise&lt;File \| undefined&gt;

DXF file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 1. 指定导出层：顶层铜层（layerId 1）和板框层（layerId 11），不镜像
const layers = [
	{ layerId: 1, mirror: false },
	{ layerId: 11, mirror: false }
];

// 2. 发起导出，25 秒内完成就输出文件信息
const dxfFile = await Promise.race([
	eda.pcb_ManufactureData.getDxfFile('嘉立创示例_DXF', layers),
	new Promise(resolve => setTimeout(() => resolve(undefined), 25000))
]);

// 3. 查看导出结果
if (dxfFile) {
	console.log('导出文件名：', dxfFile.name);
	console.log('文件大小：', dxfFile.size);
}
else {
	console.log('导出超过 25 秒仍在后台进行，真实使用直接 await 等待完成即可');
}
```


### getflyingprobetestfile

# PCB\_ManufactureData.getFlyingProbeTestFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the flying probe test file

## Signature

```typescript
function getFlyingProbeTestFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

Flying probe test file data

## Example

```javascript
// 保存飞针测试文件到本地
const flyingProbeFile = await eda.pcb_ManufactureData.getFlyingProbeTestFile('FlyingProbe_Test');
if (flyingProbeFile) {
	await eda.sys_FileSystem.saveFile(flyingProbeFile);
}
```

### getgerberfile

# PCB\_ManufactureData.getGerberFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the PCB fabrication file (Gerber)

## Signature

```typescript
function getGerberFile(
	fileName?: string,
	colorSilkscreen?: boolean,
	unit?: ESYS_Unit.MILLIMETER | ESYS_Unit.INCH,
	digitalFormat?: { integerNumber: number; decimalNumber: number },
	other?: {
		metallicDrillingInformation: boolean;
		nonMetallicDrillingInformation: boolean;
		drillTable: boolean;
		flyingProbeTestingFile: boolean;
	},
	layers?: Array<{ layerId: EPCB_LayerId; isMirror: boolean }>,
	objects?: Array<
		| 'Pad'
		| 'Via'
		| 'Track'
		| 'Text'
		| 'Image'
		| 'Dimension'
		| 'BoardOutline'
		| 'BoardCutout'
		| 'CopperFilled'
		| 'SolidRegion'
		| 'FPCStiffener'
		| 'Line'
		| 'PlaneZone'
		| 'ComponentProperty'
		| 'ComponentSilkscreen'
		| 'TearDrop'
	>,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|colorSilkscreen|boolean|_(Optional)_ Whether to generate a color silkscreen fabrication file (EasyEDA-specific file)|
|unit|[ESYS\_Unit.MILLIMETER](../enums/ESYS_Unit.md) \| [ESYS\_Unit.INCH](../enums/ESYS_Unit.md)|_(Optional)_ Unit|
|digitalFormat|\{ integerNumber: number; decimalNumber: number \}|_(Optional)_ Digital format|
|other|\{ metallicDrillingInformation: boolean; nonMetallicDrillingInformation: boolean; drillTable: boolean; flyingProbeTestingFile: boolean \}|_(Optional)_ Other|
|layers|Array&lt;{ layerId: [EPCB\_LayerId](../enums/EPCB_LayerId.md)<!-- -->; isMirror: boolean }&gt;|_(Optional)_ Exported layers. By default, they are exported according to EasyEDA production requirements|
|objects|Array&lt;'Pad' \| 'Via' \| 'Track' \| 'Text' \| 'Image' \| 'Dimension' \| 'BoardOutline' \| 'BoardCutout' \| 'CopperFilled' \| 'SolidRegion' \| 'FPCStiffener' \| 'Line' \| 'PlaneZone' \| 'ComponentProperty' \| 'ComponentSilkscreen' \| 'TearDrop'&gt;|_(Optional)_ Exported objects. By default, they are exported according to EasyEDA production requirements|

## Returns

Promise&lt;File \| undefined&gt;

PCB fabrication file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

默认参数与编辑器「导出 PCB 制版文件」弹窗的 \*\*一键导出\*\* 选项保持一致（单位 `MM`<!-- -->、数字格式 `4:5`<!-- -->、导出板内真实使用的层及钻孔图层等）

## Example

```javascript
// 导出默认的 Gerber 文件
const gerberFile = await eda.pcb_ManufactureData.getGerberFile('MyBoard_Gerber');
if (gerberFile) {
    console.log('Gerber 文件已生成:', gerberFile);
}

// 导出并保存到本地
const gerberFile = await eda.pcb_ManufactureData.getGerberFile(
    'MyBoard_Gerber',
    false,
    ESYS_Unit.MILLIMETER,
    { integerNumber: 4, decimalNumber: 6 }
);
if (gerberFile) {
    await eda.sys_FileSystem.saveFile(gerberFile,'Gerber.zip');
}

// 自定义导出层和对象
const gerberFile = await eda.pcb_ManufactureData.getGerberFile(
    'Custom_Gerber',
    false,
    ESYS_Unit.INCH,
    { integerNumber: 3, decimalNumber: 5 },
    { metallicDrillingInformation: true, nonMetallicDrillingInformation: true, drillTable: false, flyingProbeTestingFile: false },
    [{ layerId: EPCB_LayerId.TOP, isMirror: false }, { layerId: EPCB_LayerId.BOTTOM, isMirror: false }, { layerId: EPCB_LayerId.BOARD_OUTLINE, isMirror: false }],
    ['Pad', 'Via', 'Track', 'BoardOutline']
);
```


## Example (local)

```javascript
// 导出默认的 Gerber 文件
const gerberFile = await eda.pcb_ManufactureData.getGerberFile('MyBoard_Gerber');
if (gerberFile) {
    console.log('Gerber 文件已生成:', gerberFile);
}

// 导出并保存到本地
const gerberFile = await eda.pcb_ManufactureData.getGerberFile(
    'MyBoard_Gerber',
    false,
    ESYS_Unit.MILLIMETER,
    { integerNumber: 2, decimalNumber: 6 }
);
if (gerberFile) {
    await eda.sys_FileSystem.saveFile(gerberFile,'Gerber.zip');
}

// 自定义导出层和对象
const gerberFile = await eda.pcb_ManufactureData.getGerberFile(
    'Custom_Gerber',
    false,
    ESYS_Unit.INCH,
    { integerNumber: 3, decimalNumber: 5 },
    { metallicDrillingInformation: true, nonMetallicDrillingInformation: true, drillTable: false, flyingProbeTestingFile: false },
    [{ layerId: EPCB_LayerId.TOP, isMirror: false }, { layerId: EPCB_LayerId.BOTTOM, isMirror: false }, { layerId: EPCB_LayerId.BOARD_OUTLINE, isMirror: false }],
    ['Pad', 'Via', 'Track', 'BoardOutline']
);
```


### getidxfile

# PCB\_ManufactureData.getIdxFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get IDX file

## Signature

```typescript
function getIdxFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_|

## Returns

Promise&lt;File \| undefined&gt;

IDX file

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const idxFile = await eda.pcb_ManufactureData.getIdxFile('Design_Exchange');
if (idxFile) {
	await eda.sys_FileSystem.saveFile(idxFile);
}
```

### getipc2581cfile

# PCB\_ManufactureData.getIpc2581CFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get IPC-2581C file

## Signature

```typescript
function getIpc2581CFile(
	fileName?: string,
	fileType?: 'xml' | 'cvg' | '2581',
	unit?: ESYS_Unit.INCH | ESYS_Unit.MILLIMETER,
	oemNumber?: 'Device' | 'Manufacturer Part' | 'Supplier Part' | 'Comment',
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'xml' \| 'cvg' \| '2581'|_(Optional)_|
|unit|[ESYS\_Unit.INCH](../enums/ESYS_Unit.md) \| [ESYS\_Unit.MILLIMETER](../enums/ESYS_Unit.md)|_(Optional)_|
|oemNumber|'Device' \| 'Manufacturer Part' \| 'Supplier Part' \| 'Comment'|_(Optional)_|

## Returns

Promise&lt;File \| undefined&gt;

IPC-2581C file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 1. 发起导出（XML 格式、毫米单位、OEM 编号取元件的 Device 属性），
// 25 秒内完成就输出文件信息
const ipcFile = await Promise.race([
	eda.pcb_ManufactureData.getIpc2581CFile('嘉立创示例_IPC2581C', 'xml', 'mm', 'Device'),
	new Promise(resolve => setTimeout(() => resolve(undefined), 25000))
]);

// 2. 查看导出结果
if (ipcFile) {
	console.log('导出文件名：', ipcFile.name);
	console.log('文件大小：', ipcFile.size);
}
else {
	console.log('导出超过 25 秒仍在后台进行，真实使用直接 await 等待完成即可');
}
```


### getipcd356afile

# PCB\_ManufactureData.getIpcD356AFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get IPC-D-356A file

## Signature

```typescript
function getIpcD356AFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

IPC-D-356A file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const ipcFile = await eda.pcb_ManufactureData.getIpcD356AFile('IPC_D356A_Test');
if (ipcFile) {
	await eda.sys_FileSystem.saveFile(ipcFile);
}
```

### getmanufacturedata

# PCB\_ManufactureData.getManufactureData() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Export the manufacture data

## Signature

```typescript
function getManufactureData(): Promise<File | undefined>;
```

## Returns

Promise&lt;File \| undefined&gt;

Manufacture data

## Remarks

This API corresponds to the one-click manufacture data export function of the private deployment edition

It will obtain the file data according to the configuration of the one-click manufacture data export popup on the front end

Note: This API is only valid for the private deployment edition. Calling it in other editions will always `throw Error`

## Example

```javascript
// 1. 按弹窗当前配置一键导出制造文件
try {
	const manufactureFile = await eda.pcb_ManufactureData.getManufactureData();
	console.log('制造文件大小：', manufactureFile?.size);
}
catch (e) {
	// 非私有化部署版本调用会直接抛错，属预期行为
	console.log('当前版本不支持一键导出制造文件（仅私有化部署版本有效）');
}
```


### getnetlistfile

# PCB\_ManufactureData.getNetlistFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the netlist file (Netlist)

## Signature

```typescript
function getNetlistFile(
	fileName?: string,
	netlistType?: ESYS_NetlistType,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|netlistType|[ESYS\_NetlistType](../enums/ESYS_NetlistType.md)|_(Optional)_ Netlist type|

## Returns

Promise&lt;File \| undefined&gt;

Netlist file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 导出嘉立创 EDA 专业版格式网表
const netlistFile = await eda.pcb_ManufactureData.getNetlistFile(
	'MyNetlist',
	ESYS_NetlistType.JLCEDA_PRO
);
if (netlistFile) {
	await eda.sys_FileSystem.saveFile(netlistFile);
}

// 导出 Altium Designer 格式
const altiumNetlist = await eda.pcb_ManufactureData.getNetlistFile(
	'Netlist_Altium',
	ESYS_NetlistType.ALTIUM_DESIGNER
);

// 导出 PADS 格式
const padsNetlist = await eda.pcb_ManufactureData.getNetlistFile(
	'Netlist_PADS',
	ESYS_NetlistType.PADS
);
```

### getopendatabasedoubleplusfile

# PCB\_ManufactureData.getOpenDatabaseDoublePlusFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get ODB++ file

## Signature

```typescript
function getOpenDatabaseDoublePlusFile(
	fileName?: string,
	unit?: ESYS_Unit.INCH,
	otherData?: {
		metallizedDrilledHoles?: boolean;
		nonMetallizedDrilledHoles?: boolean;
		drillTable?: boolean;
		flyingProbeTestFile?: boolean;
	},
	layers?: Array<{ layerId: EPCB_LayerId; mirror: boolean }>,
	objects?: Array<{ objectName: string }>,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|unit|[ESYS\_Unit.INCH](../enums/ESYS_Unit.md)|_(Optional)_ Unit|
|otherData|\{ metallizedDrilledHoles?: boolean; nonMetallizedDrilledHoles?: boolean; drillTable?: boolean; flyingProbeTestFile?: boolean \}|_(Optional)_ Other|
|layers|Array&lt;{ layerId: [EPCB\_LayerId](../enums/EPCB_LayerId.md)<!-- -->; mirror: boolean }&gt;|_(Optional)_ Exported layers. By default, they are exported according to EasyEDA production requirements|
|objects|Array&lt;{ objectName: string }&gt;|_(Optional)_ Exported objects. By default, they are exported according to EasyEDA production requirements|

## Returns

Promise&lt;File \| undefined&gt;

ODB++ file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 导出 ODB++ 文件，自定义单位和选项
const odbFile = await eda.pcb_ManufactureData.getOpenDatabaseDoublePlusFile(
	'MyBoard_ODB',
	ESYS_Unit.INCH,
	{
		metallizedDrilledHoles: true,
		nonMetallizedDrilledHoles: true,
		drillTable: true,
		flyingProbeTestFile: false
	}
);
if (odbFile) {
	await eda.sys_FileSystem.saveFile(odbFile);
}
```

### getpadsfile

# PCB\_ManufactureData.getPadsFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get PADS file

## Signature

```typescript
function getPadsFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

PADS file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 获取 PADS 格式文件
const padsFile = await eda.pcb_ManufactureData.getPadsFile('Converted_To_PADS');
if (padsFile) {
	await eda.sys_FileSystem.saveFile(padsFile);
}
```

### getpcbinfofile

# PCB\_ManufactureData.getPcbInfoFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get PCB information file

## Signature

```typescript
function getPcbInfoFile(fileName?: string): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|

## Returns

Promise&lt;File \| undefined&gt;

PCB information file

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
const pcbInfoFile = await eda.pcb_ManufactureData.getPcbInfoFile('Board_Information');
if (pcbInfoFile) {
	await eda.sys_FileSystem.saveFile(pcbInfoFile);
}
```

### getpdffile

# PCB\_ManufactureData.getPdfFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get PDF file

## Signature

```typescript
function getPdfFile(
	fileName?: string,
	outputMethod?: EPCB_PdfOutputMethod,
	contentConfig?: { displayAttributesAsMenu: boolean; showOutlineOnly: boolean },
	watermark?: {
		show?: boolean;
		content?: string;
		styleConfig?: {
			color: string;
			transparency: 'Opaque' | '75%' | '50%' | '25%';
			font: string;
			fontSize: string;
			style: { blood: boolean; italic: boolean; underline: boolean };
			slope: 0 | 45 | 90;
			denseness: 'Single' | 'Sparse' | 'Std' | 'Dense';
		};
	},
	graphPageConfig?: Array<{ [key: string]: any }>,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|outputMethod|[EPCB\_PdfOutputMethod](../enums/EPCB_PdfOutputMethod.md)|_(Optional)_ Output method. ADD since EDA v4.2|
|contentConfig|\{ displayAttributesAsMenu: boolean; showOutlineOnly: boolean \}|_(Optional)_ Content configuration. ADD since EDA v4.2|
|watermark|{ show?: boolean; content?: string; styleConfig?: { color: string; transparency: 'Opaque' \| '75%' \| '50%' \| '25%'; font: string; fontSize: string; style: { blood: boolean; italic: boolean; underline: boolean }; slope: 0 \| 45 \| 90; denseness: 'Single' \| 'Sparse' \| 'Std' \| 'Dense' } }|_(Optional)_ Watermark. ADD since EDA v4.2|
|graphPageConfig|Array&lt;{ \[key: string\]: any }&gt;|_(Optional)_ Graph page configuration. ADD since EDA v4.2|

## Returns

Promise&lt;File \| undefined&gt;

PDF file data (or archive)

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

REFACTOR since EDA v4.2

## Example

```javascript
// 导出多页 PDF（包含所有图层）
const pdfFile = await eda.pcb_ManufactureData.getPdfFile(
	'PCB_Documentation',
	EPCB_PdfOutputMethod.MULTI_PAGE_PDF
);
if (pdfFile) {
	await eda.sys_FileSystem.saveFile(pdfFile);
}
```

### getpickandplacefile

# PCB\_ManufactureData.getPickAndPlaceFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get Coordinate file (PickAndPlace)

## Signature

```typescript
function getPickAndPlaceFile(
	fileName?: string,
	fileType?: 'xlsx' | 'csv',
	unit?: ESYS_Unit.MILLIMETER | ESYS_Unit.MIL,
): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'xlsx' \| 'csv'|_(Optional)_ File type|
|unit|[ESYS\_Unit.MILLIMETER](../enums/ESYS_Unit.md) \| [ESYS\_Unit.MIL](../enums/ESYS_Unit.md)|_(Optional)_ Unit|

## Returns

Promise&lt;File \| undefined&gt;

Coordinate file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 导出毫米单位的 Excel 格式坐标文件
const pnpFile = await eda.pcb_ManufactureData.getPickAndPlaceFile(
	'PickAndPlace',
	'xlsx',
	ESYS_Unit.MILLIMETER
);
if (pnpFile) {
	await eda.sys_FileSystem.saveFile(pnpFile);
}
```

### gettestpointfile

# PCB\_ManufactureData.getTestPointFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Get the test point report file

## Signature

```typescript
function getTestPointFile(fileName?: string, fileType?: 'xlsx' | 'csv'): Promise<File | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|fileName|string|_(Optional)_ File name|
|fileType|'xlsx' \| 'csv'|_(Optional)_ File type|

## Returns

Promise&lt;File \| undefined&gt;

Test point report file data

## Remarks

You can use [SYS\_FileSystem.saveFile()](./SYS_FileSystem.md) API export the file to the local file system

## Example

```javascript
// 保存测试点报告文件到本地
const testPointFile = await eda.pcb_ManufactureData.getTestPointFile('Test_Point_Report', 'xlsx');
if (testPointFile) {
	await eda.sys_FileSystem.saveFile(testPointFile);
}
```

### place3dshellorder

# PCB\_ManufactureData.place3DShellOrder() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

3D shell ordering

## Signature

```typescript
function place3DShellOrder(interactive?: boolean, ignoreWarning?: boolean): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|interactive|boolean|_(Optional)_ Whether to enable interactive checking. If enabled, a popup will wait for user interaction, and the `ignoreWarning` parameter cannot be used to ignore warnings; that is, the `ignoreWarning` parameter will be ignored. If disabled, no EDA internal popup will appear after the call, and the program performs a silent check. If the ordering conditions are met, `true` will be returned and the ordering page will be opened in a new tab|
|ignoreWarning|boolean|_(Optional)_ Ignore warnings during non-interactive checking. If set to `true`<!-- -->, all check warning items will be ignored and the ordering data will be generated as much as possible; if set to `false`<!-- -->, any warning will interrupt execution and return `false`|

## Returns

Promise&lt;boolean&gt;

Whether the ordering check passed. Until the input parameters are fully developed, the return value has no practical effect and does not wait for the execution result

## Remarks

This API currently only supports interactive checking. The input parameters have no effect for now and are reserved for future development

## Example

```javascript
// 1. 交互式下单检查：弹出检查弹窗等待确认，确认后打开下单页面
// const passed = await eda.pcb_ManufactureData.place3DShellOrder(true);
// 2. 静默检查：不弹任何弹窗，忽略警告并直接生成下单资料
// const passed = await eda.pcb_ManufactureData.place3DShellOrder(false, true);
// console.log('下单检查结果 ' + passed);
// 下单会真实打开订单页面并产生订单数据，案例中不实际执行
console.log('演示调用：place3DShellOrder(true) 交互式检查，或 place3DShellOrder(false, true) 静默下单');
```


### placecomponentsorder

# PCB\_ManufactureData.placeComponentsOrder() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Component ordering

## Signature

```typescript
function placeComponentsOrder(interactive?: boolean, ignoreWarning?: boolean): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|interactive|boolean|_(Optional)_ Whether to enable interactive checking. If enabled, a popup will wait for user interaction, and the `ignoreWarning` parameter cannot be used to ignore warnings; that is, the `ignoreWarning` parameter will be ignored. If disabled, no EDA internal popup will appear after the call, and the program performs a silent check. If the ordering conditions are met, `true` will be returned and the ordering page will be opened in a new tab|
|ignoreWarning|boolean|_(Optional)_ Ignore warnings during non-interactive checking. If set to `true`<!-- -->, all check warning items will be ignored and the ordering data will be generated as much as possible; if set to `false`<!-- -->, any warning will interrupt execution and return `false`|

## Returns

Promise&lt;boolean&gt;

Whether the ordering check passed. Until the input parameters are fully developed, the return value has no practical effect and does not wait for the execution result

## Remarks

This API currently only supports interactive checking. The input parameters have no effect for now and are reserved for future development

## Example

```javascript
// 1. 交互式下单检查：弹出检查弹窗等待确认，确认后打开购买页面
// const passed = await eda.pcb_ManufactureData.placeComponentsOrder(true);
// 2. 静默检查：不弹任何弹窗，忽略警告并直接生成下单资料
// const passed = await eda.pcb_ManufactureData.placeComponentsOrder(false, true);
// console.log('下单检查结果 ' + passed);
// 下单会真实打开订单页面并产生订单数据，案例中不实际执行
console.log('演示调用：placeComponentsOrder(true) 交互式检查，或 placeComponentsOrder(false, true) 静默下单');
```


### placepcborder

# PCB\_ManufactureData.placePcbOrder() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

PCB ordering

## Signature

```typescript
function placePcbOrder(interactive?: boolean, ignoreWarning?: boolean): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|interactive|boolean|_(Optional)_ Whether to enable interactive checking. If enabled, a popup will wait for user interaction, and the `ignoreWarning` parameter cannot be used to ignore warnings; that is, the `ignoreWarning` parameter will be ignored. If disabled, no EDA internal popup will appear after the call, and the program performs a silent check. If the ordering conditions are met, `true` will be returned and the ordering page will be opened in a new tab|
|ignoreWarning|boolean|_(Optional)_ Ignore warnings during non-interactive checking. If set to `true`<!-- -->, all check warning items will be ignored and the ordering data will be generated as much as possible; if set to `false`<!-- -->, any warning will interrupt execution and return `false`|

## Returns

Promise&lt;boolean&gt;

Whether the ordering check passed. Until the input parameters are fully developed, the return value has no practical effect and does not wait for the execution result

## Remarks

This API currently only supports interactive checking. The input parameters have no effect for now and are reserved for future development

## Example

```javascript
// 1. 交互式下单检查：弹出检查弹窗等待确认，确认后打开下单页面
// const passed = await eda.pcb_ManufactureData.placePcbOrder(true);
// 2. 静默检查：不弹任何弹窗，忽略警告并直接生成下单资料
// const passed = await eda.pcb_ManufactureData.placePcbOrder(false, true);
// console.log('下单检查结果 ' + passed);
// 下单会真实打开订单页面并产生订单数据，案例中不实际执行
console.log('演示调用：placePcbOrder(true) 交互式检查，或 placePcbOrder(false, true) 静默下单');
```


### placesmtcomponentsorder

# PCB\_ManufactureData.placeSmtComponentsOrder() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

SMT component ordering

## Signature

```typescript
function placeSmtComponentsOrder(interactive?: boolean, ignoreWarning?: boolean): Promise<boolean>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|interactive|boolean|_(Optional)_ Whether to enable interactive checking. If enabled, a popup will wait for user interaction, and the `ignoreWarning` parameter cannot be used to ignore warnings; that is, the `ignoreWarning` parameter will be ignored. If disabled, no EDA internal popup will appear after the call, and the program performs a silent check. If the ordering conditions are met, `true` will be returned and the ordering page will be opened in a new tab|
|ignoreWarning|boolean|_(Optional)_ Ignore warnings during non-interactive checking. If set to `true`<!-- -->, all check warning items will be ignored and the ordering data will be generated as much as possible; if set to `false`<!-- -->, any warning will interrupt execution and return `false`|

## Returns

Promise&lt;boolean&gt;

Whether the ordering check passed. Until the input parameters are fully developed, the return value has no practical effect and does not wait for the execution result

## Remarks

This API currently only supports interactive checking. The input parameters have no effect for now and are reserved for future development

## Example

```javascript
// 1. 交互式下单检查：弹出检查弹窗等待确认，确认后打开下单页面
// const passed = await eda.pcb_ManufactureData.placeSmtComponentsOrder(true);
// 2. 静默检查：不弹任何弹窗，忽略警告并直接生成下单资料
// const passed = await eda.pcb_ManufactureData.placeSmtComponentsOrder(false, true);
// console.log('下单检查结果 ' + passed);
// 下单会真实打开订单页面并产生订单数据，案例中不实际执行
console.log('演示调用：placeSmtComponentsOrder(true) 交互式检查，或 placeSmtComponentsOrder(false, true) 静默下单');
```


### uploadbomtemplatefile

# PCB\_ManufactureData.uploadBomTemplateFile() method

> This API is provided as a beta preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.

Upload a BOM template file

## Signature

```typescript
function uploadBomTemplateFile(templateFile: File, template?: string): Promise<string | undefined>;
```

## Parameters

|Parameter|Type|Description|
|---|---|---|
|templateFile|File|BOM template file|
|template|string|_(Optional)_ BOM template name. If it is `undefined`<!-- -->, the value is automatically taken from `templateFile`|

## Returns

Promise&lt;string \| undefined&gt;

BOM template name

## Example

```javascript
// 从文件选择器读取模板文件
const templateFile = await eda.sys_FileSystem.openReadFileDialog('.xlsx');
if (templateFile) {
	const templateName = await eda.pcb_ManufactureData.uploadBomTemplateFile(
		templateFile,
		'MyCustomTemplate'
	);
	if (templateName) {
		console.log('模板上传成功:', templateName);
	}
}
```
